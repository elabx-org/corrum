import type { AgentName } from './config.js';

export type ProposalStatus =
  | 'draft'
  | 'pending_review'
  | 'revision'
  | 'disputed'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'implemented';

export interface Proposal {
  id: string;
  title: string;
  content: string;
  status: ProposalStatus;
  planner: AgentName;
  reviewers: AgentName[];
  arbiter?: AgentName;
  iterations: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  filePath: string;
}

export interface CreateProposalInput {
  title: string;
  content: string;
  planner?: AgentName;
  reviewers?: AgentName[];
}
