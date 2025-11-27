import { createMachine, assign, type StateFrom } from 'xstate';
import type { ProposalStatus } from '../types/proposal.js';
import type { Vote } from '../types/review.js';
import type { AgentName } from '../types/config.js';
import type { NextAction } from '../types/state.js';

// Context for the state machine
export interface ProposalContext {
  proposalId: string;
  iterations: number;
  maxIterations: number;
  votes: Array<{ agent: AgentName; vote: Vote }>;
  arbiter: AgentName | null;
  requireUnanimous: boolean;
}

// Events that can be sent to the machine
export type ProposalEvent =
  | { type: 'CREATE' }
  | { type: 'REVIEW_RECEIVED'; agent: AgentName; vote: Vote }
  | { type: 'REVISED' }
  | { type: 'ARBITER_DECISION'; vote: Vote }
  | { type: 'HUMAN_DECISION'; approved: boolean }
  | { type: 'IMPLEMENTATION_COMPLETE' };

// Create the proposal lifecycle state machine
export const proposalMachine = createMachine({
  id: 'proposal',
  initial: 'draft',
  types: {} as {
    context: ProposalContext;
    events: ProposalEvent;
  },
  context: {
    proposalId: '',
    iterations: 0,
    maxIterations: 2,
    votes: [],
    arbiter: null,
    requireUnanimous: false
  },
  states: {
    draft: {
      on: {
        CREATE: {
          target: 'pending_review',
          actions: assign({
            votes: () => []
          })
        }
      }
    },

    pending_review: {
      on: {
        REVIEW_RECEIVED: [
          {
            // All approve -> approved
            guard: ({ context, event }) => {
              const newVotes = [...context.votes, { agent: event.agent, vote: event.vote }];
              const allApprove = newVotes.every(v => v.vote === 'APPROVE');
              return allApprove && newVotes.length > 0;
            },
            target: 'approved',
            actions: assign({
              votes: ({ context, event }) => [...context.votes, { agent: event.agent, vote: event.vote }]
            })
          },
          {
            // Any REVISE -> revision
            guard: ({ event }) => event.vote === 'REVISE',
            target: 'revision',
            actions: assign({
              votes: ({ context, event }) => [...context.votes, { agent: event.agent, vote: event.vote }]
            })
          },
          {
            // Mixed votes -> disputed
            guard: ({ context, event }) => {
              const newVotes = [...context.votes, { agent: event.agent, vote: event.vote }];
              const hasApprove = newVotes.some(v => v.vote === 'APPROVE');
              const hasReject = newVotes.some(v => v.vote === 'REJECT');
              return hasApprove && hasReject;
            },
            target: 'disputed',
            actions: assign({
              votes: ({ context, event }) => [...context.votes, { agent: event.agent, vote: event.vote }]
            })
          },
          {
            // All reject -> rejected
            guard: ({ context, event }) => {
              const newVotes = [...context.votes, { agent: event.agent, vote: event.vote }];
              const allReject = newVotes.every(v => v.vote === 'REJECT');
              return allReject && newVotes.length > 0;
            },
            target: 'rejected',
            actions: assign({
              votes: ({ context, event }) => [...context.votes, { agent: event.agent, vote: event.vote }]
            })
          },
          {
            // Default: just add the vote
            actions: assign({
              votes: ({ context, event }) => [...context.votes, { agent: event.agent, vote: event.vote }]
            })
          }
        ]
      }
    },

    revision: {
      on: {
        REVISED: [
          {
            // Max iterations reached -> escalated
            guard: ({ context }) => context.iterations >= context.maxIterations,
            target: 'escalated',
            actions: assign({
              iterations: ({ context }) => context.iterations + 1
            })
          },
          {
            // Can still iterate -> back to pending_review
            target: 'pending_review',
            actions: assign({
              iterations: ({ context }) => context.iterations + 1,
              votes: () => []
            })
          }
        ]
      }
    },

    disputed: {
      on: {
        ARBITER_DECISION: [
          {
            guard: ({ event }) => event.vote === 'APPROVE',
            target: 'approved'
          },
          {
            guard: ({ event }) => event.vote === 'REJECT',
            target: 'rejected'
          }
        ],
        HUMAN_DECISION: [
          {
            guard: ({ event }) => event.approved,
            target: 'approved'
          },
          {
            target: 'rejected'
          }
        ]
      }
    },

    escalated: {
      on: {
        HUMAN_DECISION: [
          {
            guard: ({ event }) => event.approved,
            target: 'approved'
          },
          {
            target: 'rejected'
          }
        ]
      }
    },

    approved: {
      on: {
        IMPLEMENTATION_COMPLETE: {
          target: 'implemented'
        }
      }
    },

    rejected: {
      type: 'final'
    },

    implemented: {
      type: 'final'
    }
  }
});

// Helper to get the ProposalStatus from state value
export function stateToStatus(stateValue: string): ProposalStatus {
  return stateValue as ProposalStatus;
}

// Helper to get the next action based on current state
export function getNextActionForState(
  stateValue: string,
  context: ProposalContext
): NextAction {
  switch (stateValue) {
    case 'draft':
      return 'create_proposal';
    case 'pending_review':
      return 'request_review';
    case 'revision':
      return 'revise_proposal';
    case 'disputed':
      return context.arbiter ? 'invoke_arbiter' : 'invoke_arbiter';
    case 'escalated':
      return 'escalate_human';
    case 'approved':
      return 'implement';
    case 'implemented':
      return 'mark_complete';
    case 'rejected':
      return 'escalate_human'; // Could also be a terminal state
    default:
      return 'create_proposal';
  }
}

// Create a machine instance with specific context
export function createProposalMachineWithContext(
  proposalId: string,
  options: {
    maxIterations?: number;
    requireUnanimous?: boolean;
    initialState?: ProposalStatus;
    initialVotes?: Array<{ agent: AgentName; vote: Vote }>;
    arbiter?: AgentName;
  } = {}
) {
  return proposalMachine.provide({
    // Custom implementations can be added here
  });
}

export type ProposalMachineState = StateFrom<typeof proposalMachine>;
