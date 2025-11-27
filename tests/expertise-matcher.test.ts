import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchExpertise,
  findAgentForExpertise,
  matchExpertiseAndAssignAgents
} from '../src/core/expertise-matcher.js';
import { DEFAULT_CONFIG, DEFAULT_EXPERTISE, DEFAULT_AGENT_PROFILES } from '../src/config/defaults.js';
import type { CorrumConfig, ExpertiseProfile } from '../src/types/index.js';

describe('matchExpertise', () => {
  describe('keyword matching', () => {
    it('should match security keywords', () => {
      const expertise = DEFAULT_EXPERTISE.security;
      const result = matchExpertise('Add JWT authentication to user endpoints', [], expertise);

      expect(result.expertise).toBe('security');
      expect(result.matchedKeywords).toContain('jwt');
      expect(result.matchedKeywords).toContain('authentication');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should match database keywords', () => {
      const expertise = DEFAULT_EXPERTISE.database;
      const result = matchExpertise('Add new migration for user schema', [], expertise);

      expect(result.expertise).toBe('database');
      expect(result.matchedKeywords).toContain('migration');
      expect(result.matchedKeywords).toContain('schema');
    });

    it('should match api keywords', () => {
      const expertise = DEFAULT_EXPERTISE.api;
      const result = matchExpertise('Add new REST endpoint for users', [], expertise);

      expect(result.expertise).toBe('api');
      expect(result.matchedKeywords).toContain('endpoint');
    });

    it('should match performance keywords', () => {
      const expertise = DEFAULT_EXPERTISE.performance;
      const result = matchExpertise('Optimize caching strategy for API responses', [], expertise);

      expect(result.expertise).toBe('performance');
      // Note: 'caching' matches the 'cache' keyword via substring match (task.includes)
      expect(result.matchedKeywords).toContain('optimize');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should match frontend keywords', () => {
      const expertise = DEFAULT_EXPERTISE.frontend;
      const result = matchExpertise('Add new React component with accessibility support', [], expertise);

      expect(result.expertise).toBe('frontend');
      expect(result.matchedKeywords).toContain('react');
      expect(result.matchedKeywords).toContain('component');
      expect(result.matchedKeywords).toContain('accessibility');
    });

    it('should match payments keywords', () => {
      const expertise = DEFAULT_EXPERTISE.payments;
      const result = matchExpertise('Add Stripe payment integration for subscriptions', [], expertise);

      expect(result.expertise).toBe('payments');
      expect(result.matchedKeywords).toContain('payment');
      expect(result.matchedKeywords).toContain('stripe');
      expect(result.matchedKeywords).toContain('subscription');
    });

    it('should be case insensitive', () => {
      const expertise = DEFAULT_EXPERTISE.security;
      const result = matchExpertise('Add JWT AUTHENTICATION', [], expertise);

      expect(result.matchedKeywords).toContain('jwt');
      expect(result.matchedKeywords).toContain('authentication');
    });
  });

  describe('file pattern matching', () => {
    it('should match security file patterns', () => {
      const expertise = DEFAULT_EXPERTISE.security;
      const result = matchExpertise('Update login', ['src/auth/login.ts'], expertise);

      expect(result.matchedFilePatterns).toContain('**/auth/**');
    });

    it('should match database file patterns', () => {
      const expertise = DEFAULT_EXPERTISE.database;
      const result = matchExpertise('Add migration', ['alembic/versions/001_add_users.py'], expertise);

      expect(result.matchedFilePatterns).toContain('alembic/versions/**');
    });

    it('should match api file patterns', () => {
      const expertise = DEFAULT_EXPERTISE.api;
      const result = matchExpertise('Add endpoint', ['src/routers/users.py'], expertise);

      expect(result.matchedFilePatterns).toContain('**/routers/**');
    });

    it('should match frontend file patterns', () => {
      const expertise = DEFAULT_EXPERTISE.frontend;
      const result = matchExpertise('Add component', ['src/components/Button.tsx'], expertise);

      expect(result.matchedFilePatterns).toContain('**/components/**');
    });
  });

  describe('score calculation', () => {
    it('should weight keywords higher than file patterns', () => {
      const expertise = DEFAULT_EXPERTISE.security;

      // Only keyword match - 'authentication' and 'auth' are both keywords
      const keywordResult = matchExpertise('Add authentication', [], expertise);

      // Only file pattern match
      const fileResult = matchExpertise('Update file', ['src/auth/login.ts'], expertise);

      // Keyword is weighted 2x - 'authentication' matches 'authentication' AND 'auth' substring
      // So we get 2 keywords * 2 = 4 (because 'authentication' contains 'auth')
      expect(keywordResult.score).toBeGreaterThan(fileResult.score);
      expect(fileResult.score).toBe(1);    // 1 file pattern * 1
    });

    it('should accumulate scores for multiple matches', () => {
      const expertise = DEFAULT_EXPERTISE.security;
      const result = matchExpertise(
        'Add JWT authentication with session management',
        ['src/auth/login.ts', 'src/security/middleware.ts'],
        expertise
      );

      // Multiple keywords match: jwt, auth, authentication, session
      // Plus file patterns: **/auth/**, **/security/**
      // The exact count depends on how keywords overlap
      expect(result.score).toBeGreaterThan(5);
      expect(result.matchedKeywords.length).toBeGreaterThan(2);
      expect(result.matchedFilePatterns.length).toBe(2);
    });
  });

  describe('general expertise', () => {
    it('should return zero score for general expertise (no keywords)', () => {
      const expertise = DEFAULT_EXPERTISE.general;
      const result = matchExpertise('Add some feature', [], expertise);

      expect(result.expertise).toBe('general');
      expect(result.score).toBe(0);
      expect(result.matchedKeywords).toHaveLength(0);
    });
  });
});

describe('findAgentForExpertise', () => {
  let config: CorrumConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };
  });

  it('should find an agent for security expertise', () => {
    const result = findAgentForExpertise('security', config);

    expect(result).not.toBeNull();
    // Agent profile is model-agnostic - returns any available agent
    expect(result!.agentProfile).toBeDefined();
    expect(result!.expertise).toBe('security');
  });

  it('should find an agent for database expertise', () => {
    const result = findAgentForExpertise('database', config);

    expect(result).not.toBeNull();
    expect(result!.expertise).toBe('database');
  });

  it('should return null for unknown expertise', () => {
    const result = findAgentForExpertise('unknown', config);

    // No matching expertise profile
    expect(result).toBeNull();
  });

  it('should exclude specified agents', () => {
    const result = findAgentForExpertise('security', config, ['claude-reviewer']);

    // Should find a different agent since claude-reviewer is excluded
    expect(result).not.toBeNull();
    expect(result!.agentProfile).not.toBe('claude-reviewer');
  });

  it('should include promptFocus in result', () => {
    const result = findAgentForExpertise('security', config);

    expect(result!.promptFocus).toContain('OWASP');
  });
});

describe('matchExpertiseAndAssignAgents', () => {
  let config: CorrumConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };
  });

  it('should match expertise and assign agents for security task', () => {
    const result = matchExpertiseAndAssignAgents(
      'Add JWT authentication to user endpoints',
      [],
      config
    );

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].expertise).toBe('security');
    expect(result.recommendedPlanner).not.toBeNull();
    expect(result.recommendedPlanner!.expertise).toBe('security');
  });

  it('should match expertise and assign agents for database task', () => {
    const result = matchExpertiseAndAssignAgents(
      'Add database migration for new schema',
      [],
      config
    );

    expect(result.matches.some(m => m.expertise === 'database')).toBe(true);
  });

  it('should assign multiple reviewers from different expertise', () => {
    const result = matchExpertiseAndAssignAgents(
      'Add authentication to the API endpoint',
      [],
      config
    );

    // Should have at least one reviewer
    expect(result.recommendedReviewers.length).toBeGreaterThanOrEqual(1);
  });

  it('should assign arbiter', () => {
    const result = matchExpertiseAndAssignAgents(
      'Add authentication',
      [],
      config
    );

    expect(result.recommendedArbiter).not.toBeNull();
    expect(result.recommendedArbiter!.agentProfile).toBe('arbiter');
  });

  it('should fall back to general expertise when no matches', () => {
    const result = matchExpertiseAndAssignAgents(
      'Add a simple feature',
      [],
      config
    );

    // Should have at least general expertise in matches
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].expertise).toBe('general');
  });

  it('should include file pattern matches', () => {
    const result = matchExpertiseAndAssignAgents(
      'Update login handler',
      ['src/auth/login.ts'],
      config
    );

    expect(result.matches.some(m => m.matchedFilePatterns.length > 0)).toBe(true);
  });

  it('should sort matches by score (highest first)', () => {
    const result = matchExpertiseAndAssignAgents(
      'Add JWT authentication to database with SQL migration',
      [],
      config
    );

    // Verify sorted by score descending
    for (let i = 1; i < result.matches.length; i++) {
      expect(result.matches[i - 1].score).toBeGreaterThanOrEqual(result.matches[i].score);
    }
  });

  it('should not duplicate agents across roles', () => {
    const result = matchExpertiseAndAssignAgents(
      'Add authentication',
      [],
      config
    );

    const allAgents = [
      result.recommendedPlanner?.agentProfile,
      ...result.recommendedReviewers.map(r => r.agentProfile)
    ].filter(Boolean);

    const uniqueAgents = new Set(allAgents);
    expect(uniqueAgents.size).toBe(allAgents.length);
  });
});

describe('expertise matching in analyzer', () => {
  let config: CorrumConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };
  });

  it('should include expertise matches in analysis result', async () => {
    const { analyzeTask } = await import('../src/core/analyzer.js');

    const result = analyzeTask({ task: 'Add JWT authentication' }, config);

    expect(result.expertiseMatches).toBeDefined();
    expect(result.expertiseMatches!.length).toBeGreaterThan(0);
    expect(result.expertiseMatches![0].expertise).toBe('security');
  });

  it('should include expertise assignments in analysis result', async () => {
    const { analyzeTask } = await import('../src/core/analyzer.js');

    const result = analyzeTask({ task: 'Add JWT authentication' }, config);

    expect(result.expertiseAssignments).toBeDefined();
    expect(result.expertiseAssignments!.planner).not.toBeNull();
    expect(result.expertiseAssignments!.reviewers.length).toBeGreaterThan(0);
  });

  it('should enhance instructions with expertise focus', async () => {
    const { analyzeTask } = await import('../src/core/analyzer.js');

    const result = analyzeTask({ task: 'Add JWT authentication' }, config);

    expect(result.instructions).toContain('Expertise focus');
  });
});
