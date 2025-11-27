import type { AgentName } from './config.js';

export type Vote = 'APPROVE' | 'REJECT' | 'REVISE';

export interface Review {
  id: string;
  proposalId: string;
  agent: AgentName;
  vote: Vote;
  content: string;
  severity?: SeverityCounts;
  recordedAt: string;
  filePath: string;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface AddReviewInput {
  proposalId: string;
  agent: AgentName;
  vote: Vote;
  content: string;
  severity?: SeverityCounts;
}
