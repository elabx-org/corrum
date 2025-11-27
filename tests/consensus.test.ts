import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateConsensus } from '../src/core/consensus.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import type { Review } from '../src/types/review.js';
import type { CorrumConfig } from '../src/types/index.js';

function createReview(agent: 'claude' | 'codex' | 'gemini', vote: 'APPROVE' | 'REJECT' | 'REVISE'): Review {
  return {
    id: `review-${agent}`,
    proposalId: 'test-proposal',
    agent,
    vote,
    content: 'Test review',
    recordedAt: new Date().toISOString(),
    filePath: `reviews/${agent}.md`
  };
}

describe('evaluateConsensus', () => {
  let config: CorrumConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };
  });

  describe('with no reviews', () => {
    it('should return no consensus', () => {
      const result = evaluateConsensus([], config);

      expect(result.hasConsensus).toBe(false);
      expect(result.outcome).toBeNull();
      expect(result.votes).toHaveLength(0);
    });
  });

  describe('unanimous votes', () => {
    it('should return approved when all votes are APPROVE', () => {
      const reviews = [
        createReview('codex', 'APPROVE'),
        createReview('gemini', 'APPROVE')
      ];

      const result = evaluateConsensus(reviews, config);

      expect(result.hasConsensus).toBe(true);
      expect(result.outcome).toBe('approved');
    });

    it('should return rejected when all votes are REJECT', () => {
      const reviews = [
        createReview('codex', 'REJECT'),
        createReview('gemini', 'REJECT')
      ];

      const result = evaluateConsensus(reviews, config);

      expect(result.hasConsensus).toBe(true);
      expect(result.outcome).toBe('rejected');
    });

    it('should return approved for single APPROVE vote', () => {
      const reviews = [createReview('codex', 'APPROVE')];

      const result = evaluateConsensus(reviews, config);

      expect(result.hasConsensus).toBe(true);
      expect(result.outcome).toBe('approved');
    });
  });

  describe('REVISE votes', () => {
    it('should return revise when any vote is REVISE', () => {
      const reviews = [
        createReview('codex', 'APPROVE'),
        createReview('gemini', 'REVISE')
      ];

      const result = evaluateConsensus(reviews, config);

      expect(result.hasConsensus).toBe(true);
      expect(result.outcome).toBe('revise');
    });

    it('should return revise even when majority approves', () => {
      const reviews = [
        createReview('claude', 'APPROVE'),
        createReview('codex', 'APPROVE'),
        createReview('gemini', 'REVISE')
      ];

      const result = evaluateConsensus(reviews, config);

      expect(result.hasConsensus).toBe(true);
      expect(result.outcome).toBe('revise');
    });
  });

  describe('mixed APPROVE/REJECT votes', () => {
    it('should return disputed when votes are split', () => {
      config.rules.requireUnanimous = true;
      const reviews = [
        createReview('codex', 'APPROVE'),
        createReview('gemini', 'REJECT')
      ];

      const result = evaluateConsensus(reviews, config);

      expect(result.hasConsensus).toBe(false);
      expect(result.outcome).toBe('disputed');
    });

    it('should return approved when majority approves and not requiring unanimous', () => {
      config.rules.requireUnanimous = false;
      const reviews = [
        createReview('claude', 'APPROVE'),
        createReview('codex', 'APPROVE'),
        createReview('gemini', 'REJECT')
      ];

      const result = evaluateConsensus(reviews, config);

      expect(result.hasConsensus).toBe(true);
      expect(result.outcome).toBe('approved');
    });

    it('should return rejected when majority rejects and not requiring unanimous', () => {
      config.rules.requireUnanimous = false;
      const reviews = [
        createReview('claude', 'REJECT'),
        createReview('codex', 'REJECT'),
        createReview('gemini', 'APPROVE')
      ];

      const result = evaluateConsensus(reviews, config);

      expect(result.hasConsensus).toBe(true);
      expect(result.outcome).toBe('rejected');
    });
  });

  describe('vote tracking', () => {
    it('should include all votes in result', () => {
      const reviews = [
        createReview('codex', 'APPROVE'),
        createReview('gemini', 'REJECT')
      ];

      const result = evaluateConsensus(reviews, config);

      expect(result.votes).toHaveLength(2);
      expect(result.votes).toContainEqual({ agent: 'codex', vote: 'APPROVE' });
      expect(result.votes).toContainEqual({ agent: 'gemini', vote: 'REJECT' });
    });
  });

  describe('consensus mode', () => {
    describe('majority mode', () => {
      beforeEach(() => {
        config.rules.consensusMode = 'majority';
      });

      it('should approve when majority approves', () => {
        const reviews = [
          createReview('claude', 'APPROVE'),
          createReview('codex', 'APPROVE'),
          createReview('gemini', 'REJECT')
        ];

        const result = evaluateConsensus(reviews, config);

        expect(result.hasConsensus).toBe(true);
        expect(result.outcome).toBe('approved');
      });

      it('should reject when majority rejects', () => {
        const reviews = [
          createReview('claude', 'REJECT'),
          createReview('codex', 'REJECT'),
          createReview('gemini', 'APPROVE')
        ];

        const result = evaluateConsensus(reviews, config);

        expect(result.hasConsensus).toBe(true);
        expect(result.outcome).toBe('rejected');
      });

      it('should be disputed on tie', () => {
        const reviews = [
          createReview('codex', 'APPROVE'),
          createReview('gemini', 'REJECT')
        ];

        const result = evaluateConsensus(reviews, config);

        expect(result.hasConsensus).toBe(false);
        expect(result.outcome).toBe('disputed');
      });
    });

    describe('unanimous mode', () => {
      beforeEach(() => {
        config.rules.consensusMode = 'unanimous';
      });

      it('should approve only when all approve', () => {
        const reviews = [
          createReview('claude', 'APPROVE'),
          createReview('codex', 'APPROVE'),
          createReview('gemini', 'APPROVE')
        ];

        const result = evaluateConsensus(reviews, config);

        expect(result.hasConsensus).toBe(true);
        expect(result.outcome).toBe('approved');
      });

      it('should reject only when all reject', () => {
        const reviews = [
          createReview('claude', 'REJECT'),
          createReview('codex', 'REJECT'),
          createReview('gemini', 'REJECT')
        ];

        const result = evaluateConsensus(reviews, config);

        expect(result.hasConsensus).toBe(true);
        expect(result.outcome).toBe('rejected');
      });

      it('should be disputed when majority approves but not unanimous', () => {
        const reviews = [
          createReview('claude', 'APPROVE'),
          createReview('codex', 'APPROVE'),
          createReview('gemini', 'REJECT')
        ];

        const result = evaluateConsensus(reviews, config);

        expect(result.hasConsensus).toBe(false);
        expect(result.outcome).toBe('disputed');
      });

      it('should be disputed when majority rejects but not unanimous', () => {
        const reviews = [
          createReview('claude', 'REJECT'),
          createReview('codex', 'REJECT'),
          createReview('gemini', 'APPROVE')
        ];

        const result = evaluateConsensus(reviews, config);

        expect(result.hasConsensus).toBe(false);
        expect(result.outcome).toBe('disputed');
      });
    });

    describe('consensus mode override', () => {
      beforeEach(() => {
        config.rules.consensusMode = 'majority';
      });

      it('should use override when provided', () => {
        const reviews = [
          createReview('claude', 'APPROVE'),
          createReview('codex', 'APPROVE'),
          createReview('gemini', 'REJECT')
        ];

        // With majority (default), this would approve
        const majorityResult = evaluateConsensus(reviews, config);
        expect(majorityResult.hasConsensus).toBe(true);
        expect(majorityResult.outcome).toBe('approved');

        // With unanimous override, this should be disputed
        const unanimousResult = evaluateConsensus(reviews, config, { consensusModeOverride: 'unanimous' });
        expect(unanimousResult.hasConsensus).toBe(false);
        expect(unanimousResult.outcome).toBe('disputed');
      });

      it('should override unanimous config with majority', () => {
        config.rules.consensusMode = 'unanimous';
        const reviews = [
          createReview('claude', 'APPROVE'),
          createReview('codex', 'APPROVE'),
          createReview('gemini', 'REJECT')
        ];

        // With unanimous (config), this would be disputed
        const configResult = evaluateConsensus(reviews, config);
        expect(configResult.hasConsensus).toBe(false);
        expect(configResult.outcome).toBe('disputed');

        // With majority override, this should approve
        const overrideResult = evaluateConsensus(reviews, config, { consensusModeOverride: 'majority' });
        expect(overrideResult.hasConsensus).toBe(true);
        expect(overrideResult.outcome).toBe('approved');
      });
    });

    describe('REVISE votes in any mode', () => {
      it('should always trigger revise in majority mode', () => {
        config.rules.consensusMode = 'majority';
        const reviews = [
          createReview('claude', 'APPROVE'),
          createReview('codex', 'APPROVE'),
          createReview('gemini', 'REVISE')
        ];

        const result = evaluateConsensus(reviews, config);

        expect(result.hasConsensus).toBe(true);
        expect(result.outcome).toBe('revise');
      });

      it('should always trigger revise in unanimous mode', () => {
        config.rules.consensusMode = 'unanimous';
        const reviews = [
          createReview('claude', 'APPROVE'),
          createReview('codex', 'APPROVE'),
          createReview('gemini', 'REVISE')
        ];

        const result = evaluateConsensus(reviews, config);

        expect(result.hasConsensus).toBe(true);
        expect(result.outcome).toBe('revise');
      });
    });
  });
});
