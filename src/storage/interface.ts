import type { Proposal, CreateProposalInput, ProposalStatus } from '../types/proposal.js';
import type { Review, AddReviewInput } from '../types/review.js';
import type { Decision, AgentName } from '../types/index.js';

export interface StorageBackend {
  // Proposal operations
  createProposal(input: CreateProposalInput & { id: string; filePath: string; status: ProposalStatus; planner: AgentName; reviewers: AgentName[] }): Proposal;
  getProposal(id: string): Proposal | null;
  updateProposal(id: string, updates: Partial<Proposal>): Proposal | null;
  listProposals(filter?: ProposalFilter): Proposal[];

  // Review operations
  addReview(input: AddReviewInput & { id: string; filePath: string }): Review;
  getReviewsForProposal(proposalId: string): Review[];

  // Decision operations
  recordDecision(decision: Decision): Decision;
  getDecision(proposalId: string): Decision | null;

  // Stats
  getStats(since?: Date): StorageStats;

  // Lifecycle
  initialize(): void;
  close(): void;
}

export interface ProposalFilter {
  status?: ProposalStatus | ProposalStatus[];
  planner?: AgentName;
  since?: Date;
  notImplemented?: boolean;
}

export interface StorageStats {
  totalProposals: number;
  byStatus: Record<ProposalStatus, number>;
  totalReviews: number;
  avgReviewsPerProposal: number;
  arbiterInvocations: number;
  issuesBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byAgent: Record<AgentName, { proposals: number; reviews: number; arbitrations: number }>;
}
