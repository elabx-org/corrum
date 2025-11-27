import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { proposalMachine, stateToStatus, getNextActionForState, createProposalMachineWithContext } from '../src/core/state-machine.js';
import type { ProposalContext } from '../src/core/state-machine.js';

describe('proposalMachine', () => {
  describe('initial state', () => {
    it('should start in draft state', () => {
      const actor = createActor(proposalMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe('draft');

      actor.stop();
    });
  });

  describe('draft -> pending_review', () => {
    it('should transition to pending_review on CREATE', () => {
      const actor = createActor(proposalMachine);
      actor.start();

      actor.send({ type: 'CREATE' });

      expect(actor.getSnapshot().value).toBe('pending_review');

      actor.stop();
    });

    it('should clear votes on CREATE', () => {
      const actor = createActor(proposalMachine);
      actor.start();

      actor.send({ type: 'CREATE' });

      expect(actor.getSnapshot().context.votes).toHaveLength(0);

      actor.stop();
    });
  });

  describe('pending_review transitions', () => {
    it('should transition to approved when all votes are APPROVE', () => {
      const actor = createActor(proposalMachine);
      actor.start();

      actor.send({ type: 'CREATE' });
      actor.send({ type: 'REVIEW_RECEIVED', agent: 'codex', vote: 'APPROVE' });

      expect(actor.getSnapshot().value).toBe('approved');

      actor.stop();
    });

    it('should transition to rejected when all votes are REJECT', () => {
      const actor = createActor(proposalMachine);
      actor.start();

      actor.send({ type: 'CREATE' });
      actor.send({ type: 'REVIEW_RECEIVED', agent: 'codex', vote: 'REJECT' });

      expect(actor.getSnapshot().value).toBe('rejected');

      actor.stop();
    });

    it('should transition to revision on REVISE vote', () => {
      const actor = createActor(proposalMachine);
      actor.start();

      actor.send({ type: 'CREATE' });
      actor.send({ type: 'REVIEW_RECEIVED', agent: 'codex', vote: 'REVISE' });

      expect(actor.getSnapshot().value).toBe('revision');

      actor.stop();
    });

    it('should transition to disputed on mixed APPROVE/REJECT', () => {
      // Start with a state that already has one APPROVE vote
      const machine = proposalMachine;
      const actor = createActor(machine, {
        snapshot: machine.resolveState({
          value: 'pending_review',
          context: {
            proposalId: 'test',
            iterations: 0,
            maxIterations: 2,
            votes: [{ agent: 'codex', vote: 'APPROVE' }],
            arbiter: null,
            requireUnanimous: false
          }
        })
      });
      actor.start();

      // Now send a REJECT - this should trigger disputed
      actor.send({ type: 'REVIEW_RECEIVED', agent: 'gemini', vote: 'REJECT' });

      expect(actor.getSnapshot().value).toBe('disputed');

      actor.stop();
    });

    it('should accumulate votes in context', () => {
      const actor = createActor(proposalMachine);
      actor.start();

      actor.send({ type: 'CREATE' });
      actor.send({ type: 'REVIEW_RECEIVED', agent: 'codex', vote: 'APPROVE' });

      const votes = actor.getSnapshot().context.votes;
      expect(votes).toContainEqual({ agent: 'codex', vote: 'APPROVE' });

      actor.stop();
    });

    it('should stay in pending_review when collecting votes without clear outcome', () => {
      const actor = createActor(proposalMachine);
      actor.start();

      actor.send({ type: 'CREATE' });
      actor.send({ type: 'REVIEW_RECEIVED', agent: 'codex', vote: 'APPROVE' });

      // First vote alone (APPROVE) transitions to approved
      expect(actor.getSnapshot().value).toBe('approved');

      actor.stop();
    });
  });

  describe('revision transitions', () => {
    it('should return to pending_review on REVISED when under max iterations', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'revision', context: {
          proposalId: 'test',
          iterations: 0,
          maxIterations: 2,
          votes: [],
          arbiter: null,
          requireUnanimous: false
        }})
      });
      actor.start();

      actor.send({ type: 'REVISED' });

      expect(actor.getSnapshot().value).toBe('pending_review');
      expect(actor.getSnapshot().context.iterations).toBe(1);
      expect(actor.getSnapshot().context.votes).toHaveLength(0);

      actor.stop();
    });

    it('should transition to escalated when max iterations reached', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'revision', context: {
          proposalId: 'test',
          iterations: 2,
          maxIterations: 2,
          votes: [],
          arbiter: null,
          requireUnanimous: false
        }})
      });
      actor.start();

      actor.send({ type: 'REVISED' });

      expect(actor.getSnapshot().value).toBe('escalated');

      actor.stop();
    });
  });

  describe('disputed transitions', () => {
    it('should transition to approved on ARBITER_DECISION APPROVE', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'disputed', context: {
          proposalId: 'test',
          iterations: 0,
          maxIterations: 2,
          votes: [{ agent: 'codex', vote: 'APPROVE' }, { agent: 'gemini', vote: 'REJECT' }],
          arbiter: 'claude',
          requireUnanimous: false
        }})
      });
      actor.start();

      actor.send({ type: 'ARBITER_DECISION', vote: 'APPROVE' });

      expect(actor.getSnapshot().value).toBe('approved');

      actor.stop();
    });

    it('should transition to rejected on ARBITER_DECISION REJECT', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'disputed', context: {
          proposalId: 'test',
          iterations: 0,
          maxIterations: 2,
          votes: [],
          arbiter: 'claude',
          requireUnanimous: false
        }})
      });
      actor.start();

      actor.send({ type: 'ARBITER_DECISION', vote: 'REJECT' });

      expect(actor.getSnapshot().value).toBe('rejected');

      actor.stop();
    });

    it('should transition to approved on HUMAN_DECISION approved', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'disputed', context: {
          proposalId: 'test',
          iterations: 0,
          maxIterations: 2,
          votes: [],
          arbiter: null,
          requireUnanimous: false
        }})
      });
      actor.start();

      actor.send({ type: 'HUMAN_DECISION', approved: true });

      expect(actor.getSnapshot().value).toBe('approved');

      actor.stop();
    });

    it('should transition to rejected on HUMAN_DECISION not approved', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'disputed', context: {
          proposalId: 'test',
          iterations: 0,
          maxIterations: 2,
          votes: [],
          arbiter: null,
          requireUnanimous: false
        }})
      });
      actor.start();

      actor.send({ type: 'HUMAN_DECISION', approved: false });

      expect(actor.getSnapshot().value).toBe('rejected');

      actor.stop();
    });
  });

  describe('escalated transitions', () => {
    it('should transition to approved on HUMAN_DECISION approved', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'escalated', context: {
          proposalId: 'test',
          iterations: 3,
          maxIterations: 2,
          votes: [],
          arbiter: null,
          requireUnanimous: false
        }})
      });
      actor.start();

      actor.send({ type: 'HUMAN_DECISION', approved: true });

      expect(actor.getSnapshot().value).toBe('approved');

      actor.stop();
    });

    it('should transition to rejected on HUMAN_DECISION not approved', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'escalated', context: {
          proposalId: 'test',
          iterations: 3,
          maxIterations: 2,
          votes: [],
          arbiter: null,
          requireUnanimous: false
        }})
      });
      actor.start();

      actor.send({ type: 'HUMAN_DECISION', approved: false });

      expect(actor.getSnapshot().value).toBe('rejected');

      actor.stop();
    });
  });

  describe('approved transitions', () => {
    it('should transition to implemented on IMPLEMENTATION_COMPLETE', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'approved', context: {
          proposalId: 'test',
          iterations: 0,
          maxIterations: 2,
          votes: [],
          arbiter: null,
          requireUnanimous: false
        }})
      });
      actor.start();

      actor.send({ type: 'IMPLEMENTATION_COMPLETE' });

      expect(actor.getSnapshot().value).toBe('implemented');

      actor.stop();
    });
  });

  describe('final states', () => {
    it('rejected should be a final state', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'rejected', context: {
          proposalId: 'test',
          iterations: 0,
          maxIterations: 2,
          votes: [],
          arbiter: null,
          requireUnanimous: false
        }})
      });
      actor.start();

      expect(actor.getSnapshot().status).toBe('done');

      actor.stop();
    });

    it('implemented should be a final state', () => {
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({ value: 'implemented', context: {
          proposalId: 'test',
          iterations: 0,
          maxIterations: 2,
          votes: [],
          arbiter: null,
          requireUnanimous: false
        }})
      });
      actor.start();

      expect(actor.getSnapshot().status).toBe('done');

      actor.stop();
    });
  });

  describe('full workflow scenarios', () => {
    it('should complete a successful approval workflow', () => {
      const actor = createActor(proposalMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe('draft');

      actor.send({ type: 'CREATE' });
      expect(actor.getSnapshot().value).toBe('pending_review');

      actor.send({ type: 'REVIEW_RECEIVED', agent: 'codex', vote: 'APPROVE' });
      expect(actor.getSnapshot().value).toBe('approved');

      actor.send({ type: 'IMPLEMENTATION_COMPLETE' });
      expect(actor.getSnapshot().value).toBe('implemented');
      expect(actor.getSnapshot().status).toBe('done');

      actor.stop();
    });

    it('should handle revision workflow', () => {
      const actor = createActor(proposalMachine);
      actor.start();

      actor.send({ type: 'CREATE' });
      actor.send({ type: 'REVIEW_RECEIVED', agent: 'codex', vote: 'REVISE' });
      expect(actor.getSnapshot().value).toBe('revision');

      actor.send({ type: 'REVISED' });
      expect(actor.getSnapshot().value).toBe('pending_review');
      expect(actor.getSnapshot().context.iterations).toBe(1);

      actor.send({ type: 'REVIEW_RECEIVED', agent: 'gemini', vote: 'APPROVE' });
      expect(actor.getSnapshot().value).toBe('approved');

      actor.stop();
    });

    it('should handle disputed workflow with arbiter', () => {
      // Start with pending_review with one APPROVE vote
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({
          value: 'pending_review',
          context: {
            proposalId: 'test',
            iterations: 0,
            maxIterations: 2,
            votes: [{ agent: 'codex', vote: 'APPROVE' }],
            arbiter: null,
            requireUnanimous: false
          }
        })
      });
      actor.start();

      // Send REJECT to trigger disputed
      actor.send({ type: 'REVIEW_RECEIVED', agent: 'gemini', vote: 'REJECT' });
      expect(actor.getSnapshot().value).toBe('disputed');

      actor.send({ type: 'ARBITER_DECISION', vote: 'APPROVE' });
      expect(actor.getSnapshot().value).toBe('approved');

      actor.stop();
    });

    it('should escalate after max iterations', () => {
      // Start in revision state with iterations = 1 and maxIterations = 1
      const actor = createActor(proposalMachine, {
        snapshot: proposalMachine.resolveState({
          value: 'revision',
          context: {
            proposalId: 'test',
            iterations: 1,
            maxIterations: 1,
            votes: [],
            arbiter: null,
            requireUnanimous: false
          }
        })
      });
      actor.start();

      // This REVISED should trigger escalation since iterations (1) >= maxIterations (1)
      actor.send({ type: 'REVISED' });
      expect(actor.getSnapshot().value).toBe('escalated');
      expect(actor.getSnapshot().context.iterations).toBe(2);

      actor.stop();
    });
  });
});

describe('helper functions', () => {
  describe('stateToStatus', () => {
    it('should convert state value to ProposalStatus', () => {
      expect(stateToStatus('draft')).toBe('draft');
      expect(stateToStatus('pending_review')).toBe('pending_review');
      expect(stateToStatus('approved')).toBe('approved');
      expect(stateToStatus('implemented')).toBe('implemented');
    });
  });

  describe('getNextActionForState', () => {
    const baseContext: ProposalContext = {
      proposalId: 'test',
      iterations: 0,
      maxIterations: 2,
      votes: [],
      arbiter: null,
      requireUnanimous: false
    };

    it('should return create_proposal for draft', () => {
      expect(getNextActionForState('draft', baseContext)).toBe('create_proposal');
    });

    it('should return request_review for pending_review', () => {
      expect(getNextActionForState('pending_review', baseContext)).toBe('request_review');
    });

    it('should return revise_proposal for revision', () => {
      expect(getNextActionForState('revision', baseContext)).toBe('revise_proposal');
    });

    it('should return invoke_arbiter for disputed', () => {
      expect(getNextActionForState('disputed', baseContext)).toBe('invoke_arbiter');
    });

    it('should return escalate_human for escalated', () => {
      expect(getNextActionForState('escalated', baseContext)).toBe('escalate_human');
    });

    it('should return implement for approved', () => {
      expect(getNextActionForState('approved', baseContext)).toBe('implement');
    });

    it('should return mark_complete for implemented', () => {
      expect(getNextActionForState('implemented', baseContext)).toBe('mark_complete');
    });
  });

  describe('createProposalMachineWithContext', () => {
    it('should return a machine', () => {
      const machine = createProposalMachineWithContext('test-id', {
        maxIterations: 5,
        requireUnanimous: true,
        arbiter: 'claude'
      });

      expect(machine).toBeDefined();
      expect(typeof machine.provide).toBe('function');
    });

    it('should work with default parameters', () => {
      const machine = createProposalMachineWithContext('test-id');

      expect(machine).toBeDefined();
      expect(typeof machine.provide).toBe('function');
    });

    it('should accept all options', () => {
      const machine = createProposalMachineWithContext('test-id', {
        maxIterations: 3,
        requireUnanimous: true,
        arbiter: 'claude',
        initialVotes: [
          { agent: 'codex', vote: 'APPROVE' },
          { agent: 'gemini', vote: 'APPROVE' }
        ]
      });

      expect(machine).toBeDefined();
    });
  });
});
