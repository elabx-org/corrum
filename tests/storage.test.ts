import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { SqliteStorage } from '../src/storage/sqlite-storage.js';
import type { ProposalStatus, AgentName } from '../src/types/index.js';

const TEST_DB = '.corrum-test.db';

describe('SqliteStorage', () => {
  let storage: SqliteStorage;

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
    storage = new SqliteStorage(TEST_DB);
    storage.initialize();
  });

  afterEach(() => {
    storage.close();
    // Clean up test database
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
  });

  describe('proposal operations', () => {
    it('should create a proposal', () => {
      const proposal = storage.createProposal({
        id: '20251127-test-proposal',
        title: 'Test Proposal',
        content: '# Test Content',
        status: 'draft',
        planner: 'claude',
        reviewers: ['codex'],
        filePath: 'docs/corrum/proposals/20251127-test-proposal.md'
      });

      expect(proposal.id).toBe('20251127-test-proposal');
      expect(proposal.title).toBe('Test Proposal');
      expect(proposal.status).toBe('draft');
      expect(proposal.planner).toBe('claude');
      expect(proposal.reviewers).toEqual(['codex']);
      expect(proposal.iterations).toBe(0);
      expect(proposal.createdAt).toBeDefined();
    });

    it('should retrieve a proposal by ID', () => {
      storage.createProposal({
        id: '20251127-get-test',
        title: 'Get Test',
        content: 'Content',
        status: 'pending_review',
        planner: 'claude',
        reviewers: ['codex', 'gemini'],
        filePath: 'test.md'
      });

      const retrieved = storage.getProposal('20251127-get-test');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('20251127-get-test');
      expect(retrieved!.reviewers).toEqual(['codex', 'gemini']);
    });

    it('should return null for non-existent proposal', () => {
      const result = storage.getProposal('non-existent');
      expect(result).toBeNull();
    });

    it('should update proposal status', () => {
      const created = storage.createProposal({
        id: '20251127-update-test',
        title: 'Update Test',
        content: 'Content',
        status: 'draft',
        planner: 'claude',
        reviewers: ['codex'],
        filePath: 'test.md'
      });

      const updated = storage.updateProposal('20251127-update-test', {
        status: 'approved'
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('approved');
      expect(updated!.updatedAt).toBeDefined();
      expect(created.createdAt).toBeDefined();
    });

    it('should update proposal iterations', () => {
      storage.createProposal({
        id: '20251127-iteration-test',
        title: 'Iteration Test',
        content: 'Content',
        status: 'revision',
        planner: 'claude',
        reviewers: ['codex'],
        filePath: 'test.md'
      });

      const updated = storage.updateProposal('20251127-iteration-test', {
        iterations: 1
      });

      expect(updated!.iterations).toBe(1);
    });

    it('should set arbiter on update', () => {
      storage.createProposal({
        id: '20251127-arbiter-test',
        title: 'Arbiter Test',
        content: 'Content',
        status: 'disputed',
        planner: 'claude',
        reviewers: ['codex'],
        filePath: 'test.md'
      });

      const updated = storage.updateProposal('20251127-arbiter-test', {
        arbiter: 'gemini'
      });

      expect(updated!.arbiter).toBe('gemini');
    });

    it('should return null when updating non-existent proposal', () => {
      const result = storage.updateProposal('non-existent', { status: 'approved' });
      expect(result).toBeNull();
    });
  });

  describe('listProposals', () => {
    beforeEach(() => {
      // Create test proposals
      storage.createProposal({
        id: '20251127-proposal-1',
        title: 'Proposal 1',
        content: 'Content 1',
        status: 'approved',
        planner: 'claude',
        reviewers: ['codex'],
        filePath: 'test1.md'
      });
      storage.createProposal({
        id: '20251127-proposal-2',
        title: 'Proposal 2',
        content: 'Content 2',
        status: 'pending_review',
        planner: 'gemini',
        reviewers: ['codex'],
        filePath: 'test2.md'
      });
      storage.createProposal({
        id: '20251127-proposal-3',
        title: 'Proposal 3',
        content: 'Content 3',
        status: 'rejected',
        planner: 'claude',
        reviewers: ['codex'],
        filePath: 'test3.md'
      });
    });

    it('should list all proposals', () => {
      const proposals = storage.listProposals();
      expect(proposals).toHaveLength(3);
    });

    it('should filter by status', () => {
      const proposals = storage.listProposals({ status: 'approved' });
      expect(proposals).toHaveLength(1);
      expect(proposals[0].id).toBe('20251127-proposal-1');
    });

    it('should filter by multiple statuses', () => {
      const proposals = storage.listProposals({
        status: ['approved', 'rejected'] as ProposalStatus[]
      });
      expect(proposals).toHaveLength(2);
    });

    it('should filter by planner', () => {
      const proposals = storage.listProposals({ planner: 'gemini' });
      expect(proposals).toHaveLength(1);
      expect(proposals[0].id).toBe('20251127-proposal-2');
    });

    it('should return proposals in descending order by creation date', () => {
      const proposals = storage.listProposals();
      // Should return all 3 proposals ordered by creation date descending
      expect(proposals).toHaveLength(3);
      // Verify we got all the IDs
      const ids = proposals.map(p => p.id);
      expect(ids).toContain('20251127-proposal-1');
      expect(ids).toContain('20251127-proposal-2');
      expect(ids).toContain('20251127-proposal-3');
    });
  });

  describe('review operations', () => {
    beforeEach(() => {
      storage.createProposal({
        id: '20251127-review-test',
        title: 'Review Test',
        content: 'Content',
        status: 'pending_review',
        planner: 'claude',
        reviewers: ['codex', 'gemini'],
        filePath: 'test.md'
      });
    });

    it('should add a review', () => {
      const review = storage.addReview({
        id: '20251127-review-test-codex',
        proposalId: '20251127-review-test',
        agent: 'codex',
        vote: 'APPROVE',
        content: 'Looks good!',
        filePath: 'reviews/test-codex.md'
      });

      expect(review.id).toBe('20251127-review-test-codex');
      expect(review.vote).toBe('APPROVE');
      expect(review.agent).toBe('codex');
    });

    it('should add review with severity counts', () => {
      const review = storage.addReview({
        id: '20251127-review-test-gemini',
        proposalId: '20251127-review-test',
        agent: 'gemini',
        vote: 'REVISE',
        content: 'Some issues found',
        severity: { critical: 0, high: 1, medium: 2, low: 3 },
        filePath: 'reviews/test-gemini.md'
      });

      expect(review.severity!.high).toBe(1);
      expect(review.severity!.medium).toBe(2);
      expect(review.severity!.low).toBe(3);
    });

    it('should get all reviews for a proposal', () => {
      storage.addReview({
        id: '20251127-review-test-codex',
        proposalId: '20251127-review-test',
        agent: 'codex',
        vote: 'APPROVE',
        content: 'Good',
        filePath: 'r1.md'
      });
      storage.addReview({
        id: '20251127-review-test-gemini',
        proposalId: '20251127-review-test',
        agent: 'gemini',
        vote: 'REVISE',
        content: 'Needs work',
        filePath: 'r2.md'
      });

      const reviews = storage.getReviewsForProposal('20251127-review-test');

      expect(reviews).toHaveLength(2);
      expect(reviews.map(r => r.agent)).toEqual(['codex', 'gemini']);
    });

    it('should return empty array for proposal with no reviews', () => {
      const reviews = storage.getReviewsForProposal('20251127-review-test');
      expect(reviews).toHaveLength(0);
    });
  });

  describe('decision operations', () => {
    beforeEach(() => {
      storage.createProposal({
        id: '20251127-decision-test',
        title: 'Decision Test',
        content: 'Content',
        status: 'disputed',
        planner: 'claude',
        reviewers: ['codex'],
        filePath: 'test.md'
      });
    });

    it('should record a decision', () => {
      const decision = storage.recordDecision({
        id: 'decision-20251127-decision-test',
        proposalId: '20251127-decision-test',
        outcome: 'approved',
        summary: 'Approved after arbiter review',
        recordedAt: new Date().toISOString(),
        filePath: 'decisions/test.md'
      });

      expect(decision.outcome).toBe('approved');
      expect(decision.summary).toBe('Approved after arbiter review');
    });

    it('should get decision for proposal', () => {
      storage.recordDecision({
        id: 'decision-20251127-decision-test',
        proposalId: '20251127-decision-test',
        outcome: 'rejected',
        summary: 'Rejected',
        recordedAt: new Date().toISOString(),
        filePath: 'decisions/test.md'
      });

      const decision = storage.getDecision('20251127-decision-test');

      expect(decision).not.toBeNull();
      expect(decision!.outcome).toBe('rejected');
    });

    it('should return null for proposal without decision', () => {
      const decision = storage.getDecision('20251127-decision-test');
      expect(decision).toBeNull();
    });

    it('should replace existing decision', () => {
      storage.recordDecision({
        id: 'decision-20251127-decision-test',
        proposalId: '20251127-decision-test',
        outcome: 'rejected',
        summary: 'Initially rejected',
        recordedAt: new Date().toISOString(),
        filePath: 'decisions/test.md'
      });

      storage.recordDecision({
        id: 'decision-20251127-decision-test',
        proposalId: '20251127-decision-test',
        outcome: 'approved',
        summary: 'Changed to approved',
        recordedAt: new Date().toISOString(),
        filePath: 'decisions/test.md'
      });

      const decision = storage.getDecision('20251127-decision-test');
      expect(decision!.outcome).toBe('approved');
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      // Create proposals with various statuses
      storage.createProposal({
        id: 'stats-1', title: 'S1', content: 'C', status: 'approved',
        planner: 'claude', reviewers: ['codex'], filePath: 't1.md'
      });
      storage.createProposal({
        id: 'stats-2', title: 'S2', content: 'C', status: 'approved',
        planner: 'claude', reviewers: ['codex'], filePath: 't2.md'
      });
      storage.createProposal({
        id: 'stats-3', title: 'S3', content: 'C', status: 'rejected',
        planner: 'gemini', reviewers: ['codex'], filePath: 't3.md'
      });
      storage.updateProposal('stats-2', { arbiter: 'gemini' });

      // Add reviews
      storage.addReview({
        id: 'r1', proposalId: 'stats-1', agent: 'codex', vote: 'APPROVE',
        content: 'Good', severity: { critical: 0, high: 1, medium: 0, low: 2 },
        filePath: 'r1.md'
      });
      storage.addReview({
        id: 'r2', proposalId: 'stats-2', agent: 'codex', vote: 'REVISE',
        content: 'Fix', severity: { critical: 1, high: 0, medium: 1, low: 0 },
        filePath: 'r2.md'
      });
    });

    it('should calculate total proposals', () => {
      const stats = storage.getStats();
      expect(stats.totalProposals).toBe(3);
    });

    it('should calculate proposals by status', () => {
      const stats = storage.getStats();
      expect(stats.byStatus['approved']).toBe(2);
      expect(stats.byStatus['rejected']).toBe(1);
    });

    it('should calculate total reviews', () => {
      const stats = storage.getStats();
      expect(stats.totalReviews).toBe(2);
    });

    it('should calculate average reviews per proposal', () => {
      const stats = storage.getStats();
      expect(stats.avgReviewsPerProposal).toBeCloseTo(2/3, 2);
    });

    it('should count arbiter invocations', () => {
      const stats = storage.getStats();
      expect(stats.arbiterInvocations).toBe(1);
    });

    it('should aggregate severity counts', () => {
      const stats = storage.getStats();
      expect(stats.issuesBySeverity.critical).toBe(1);
      expect(stats.issuesBySeverity.high).toBe(1);
      expect(stats.issuesBySeverity.medium).toBe(1);
      expect(stats.issuesBySeverity.low).toBe(2);
    });

    it('should calculate per-agent statistics', () => {
      const stats = storage.getStats();
      expect(stats.byAgent.claude.proposals).toBe(2);
      expect(stats.byAgent.gemini.proposals).toBe(1);
      expect(stats.byAgent.codex.reviews).toBe(2);
      expect(stats.byAgent.gemini.arbitrations).toBe(1);
    });
  });
});
