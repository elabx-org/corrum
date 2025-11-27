import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeTask, type AnalyzeInput } from '../src/core/analyzer.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import type { CorrumConfig } from '../src/types/index.js';

describe('analyzeTask', () => {
  let config: CorrumConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };
  });

  describe('keyword matching', () => {
    it('should require Corrum for security-related keywords', () => {
      const input: AnalyzeInput = {
        task: 'Add authentication to the API'
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(true);
      expect(result.matchedRules.keywords).toContain('authentication');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should require Corrum for database-related keywords', () => {
      const input: AnalyzeInput = {
        task: 'Add new migration for user table schema'
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(true);
      expect(result.matchedRules.keywords).toEqual(expect.arrayContaining(['migration', 'schema']));
    });

    it('should require Corrum for rate limiting keywords', () => {
      const input: AnalyzeInput = {
        task: 'Implement rate limit for photo uploads'
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(true);
      expect(result.matchedRules.keywords).toContain('rate limit');
    });

    it('should not require Corrum for simple tasks without keywords', () => {
      const input: AnalyzeInput = {
        task: 'Update button color to blue'
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(false);
      expect(result.matchedRules.keywords).toHaveLength(0);
    });

    it('should match keywords case-insensitively', () => {
      const input: AnalyzeInput = {
        task: 'Add JWT Authentication'
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(true);
      expect(result.matchedRules.keywords).toEqual(expect.arrayContaining(['jwt', 'authentication']));
    });
  });

  describe('file pattern matching', () => {
    it('should require Corrum for auth file patterns', () => {
      const input: AnalyzeInput = {
        task: 'Update login function',
        files: ['src/auth/login.ts']
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(true);
      expect(result.matchedRules.filePatterns.length).toBeGreaterThan(0);
    });

    it('should require Corrum for router file patterns', () => {
      const input: AnalyzeInput = {
        task: 'Add new endpoint',
        files: ['backend/app/routers/users.py']
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(true);
    });

    it('should require Corrum for SQL files', () => {
      const input: AnalyzeInput = {
        task: 'Update query',
        files: ['queries/users.sql']
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(true);
    });

    it('should have higher confidence when both keywords and files match', () => {
      const inputKeywordOnly: AnalyzeInput = {
        task: 'Add authentication'
      };
      const inputBoth: AnalyzeInput = {
        task: 'Add authentication',
        files: ['src/auth/handler.ts']
      };

      const resultKeyword = analyzeTask(inputKeywordOnly, config);
      const resultBoth = analyzeTask(inputBoth, config);

      expect(resultBoth.confidence).toBeGreaterThan(resultKeyword.confidence);
    });
  });

  describe('force and skip flags', () => {
    it('should require Corrum when --force is set', () => {
      const input: AnalyzeInput = {
        task: 'Simple button change',
        force: true
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toContain('Forced');
    });

    it('should not require Corrum when --skip is set', () => {
      const input: AnalyzeInput = {
        task: 'Add authentication to API',
        skip: true
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toContain('skipped');
    });
  });

  describe('trivial task detection', () => {
    it('should skip trivial tasks like typo fixes', () => {
      const input: AnalyzeInput = {
        task: 'Fix typo in README'
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(false);
      expect(result.reason).toContain('trivial');
    });

    it('should skip documentation-only changes', () => {
      const input: AnalyzeInput = {
        task: 'Update documentation for getting started guide'
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(false);
      expect(result.reason).toContain('trivial');
    });

    it('should skip formatting changes', () => {
      const input: AnalyzeInput = {
        task: 'Apply formatting to codebase'
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(false);
    });

    it('should not skip trivial when autoSkipTrivial is false', () => {
      config.rules.autoSkipTrivial = false;
      const input: AnalyzeInput = {
        task: 'Fix typo in README'
      };
      const result = analyzeTask(input, config);

      expect(result.requiresCorrum).toBe(false); // Still no keywords match
    });

    it('should require Corrum for security typos when keyword matches', () => {
      const input: AnalyzeInput = {
        task: 'Fix typo in authentication module'
      };
      const result = analyzeTask(input, config);

      // Security keywords take priority over trivial patterns
      // "authentication" keyword triggers Corrum even with "typo" in task
      expect(result.requiresCorrum).toBe(true);
      expect(result.matchedRules.keywords).toContain('authentication');
    });
  });

  describe('role assignment', () => {
    it('should assign default planner when not specified', () => {
      const input: AnalyzeInput = {
        task: 'Add authentication'
      };
      const result = analyzeTask(input, config);

      expect(result.assignedRoles.planner).toBe('claude');
      expect(result.assignedRoles.reviewers).toContain('codex');
    });

    it('should use override planner when specified', () => {
      const input: AnalyzeInput = {
        task: 'Add authentication',
        planner: 'gemini'
      };
      const result = analyzeTask(input, config);

      expect(result.assignedRoles.planner).toBe('gemini');
    });
  });

  describe('instructions generation', () => {
    it('should include security implications for auth tasks', () => {
      const input: AnalyzeInput = {
        task: 'Add JWT token authentication'
      };
      const result = analyzeTask(input, config);

      expect(result.instructions).toContain('security');
    });

    it('should include performance for rate limiting tasks', () => {
      const input: AnalyzeInput = {
        task: 'Add rate limiting to API'
      };
      const result = analyzeTask(input, config);

      expect(result.instructions).toContain('performance');
    });

    it('should include data integrity for database tasks', () => {
      const input: AnalyzeInput = {
        task: 'Add database migration'
      };
      const result = analyzeTask(input, config);

      expect(result.instructions).toContain('data integrity');
    });
  });

  describe('next action', () => {
    it('should set next action to create_proposal when Corrum required', () => {
      const input: AnalyzeInput = {
        task: 'Add authentication'
      };
      const result = analyzeTask(input, config);

      expect(result.nextAction).toBe('create_proposal');
    });

    it('should set next action to create_proposal even when not required', () => {
      const input: AnalyzeInput = {
        task: 'Update button color'
      };
      const result = analyzeTask(input, config);

      expect(result.nextAction).toBe('create_proposal');
    });
  });

  describe('consensus mode detection', () => {
    it('should default to majority consensus mode', () => {
      const input: AnalyzeInput = {
        task: 'Add authentication'
      };
      const result = analyzeTask(input, config);

      expect(result.consensusMode).toBe('majority');
    });

    it('should detect unanimous mode from "all agree"', () => {
      const input: AnalyzeInput = {
        task: 'use corrum to review this, I need all agents to agree'
      };
      const result = analyzeTask(input, config);

      expect(result.consensusMode).toBe('unanimous');
    });

    it('should detect unanimous mode from "unanimous"', () => {
      const input: AnalyzeInput = {
        task: 'review this auth change with unanimous approval'
      };
      const result = analyzeTask(input, config);

      expect(result.consensusMode).toBe('unanimous');
    });

    it('should detect unanimous mode from "must all agree"', () => {
      const input: AnalyzeInput = {
        task: 'code review this feature, reviewers must all agree'
      };
      const result = analyzeTask(input, config);

      expect(result.consensusMode).toBe('unanimous');
    });

    it('should detect unanimous mode from "all reviewers agree"', () => {
      const input: AnalyzeInput = {
        task: 'review this api change, need all reviewers agree on approach'
      };
      const result = analyzeTask(input, config);

      expect(result.consensusMode).toBe('unanimous');
    });

    it('should detect majority mode from "majority vote"', () => {
      const input: AnalyzeInput = {
        task: 'review this change, majority vote decides'
      };
      const result = analyzeTask(input, config);

      expect(result.consensusMode).toBe('majority');
    });

    it('should detect majority mode from "majority wins"', () => {
      const input: AnalyzeInput = {
        task: 'use corrum to review, majority wins'
      };
      const result = analyzeTask(input, config);

      expect(result.consensusMode).toBe('majority');
    });

    it('should allow explicit override via consensusMode parameter', () => {
      const input: AnalyzeInput = {
        task: 'Add auth with unanimous agreement',  // natural language says unanimous
        consensusMode: 'majority'  // but explicit override says majority
      };
      const result = analyzeTask(input, config);

      expect(result.consensusMode).toBe('majority');  // explicit override wins
    });

    it('should use config default when no natural language or override', () => {
      config.rules.consensusMode = 'unanimous';
      const input: AnalyzeInput = {
        task: 'Add simple feature'  // no consensus language
      };
      const result = analyzeTask(input, config);

      expect(result.consensusMode).toBe('unanimous');  // uses config default
    });
  });
});
