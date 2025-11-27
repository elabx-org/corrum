import type { AgentName, ConsensusMode } from './config.js';
import type { Proposal, ProposalStatus } from './proposal.js';
import type { Review, Vote } from './review.js';

export type NextAction =
  | 'create_proposal'
  | 'request_review'
  | 'revise_proposal'
  | 'invoke_arbiter'
  | 'implement'
  | 'escalate_human'
  | 'mark_complete';

export interface AnalysisResult {
  requiresCorrum: boolean;
  reason: string;
  confidence: number;
  matchedRules: {
    keywords: string[];
    filePatterns: string[];
    complexity: number | null;
  };
  assignedRoles: {
    planner: AgentName;
    reviewers: AgentName[];
    arbiter: AgentName | null;
    implementer: AgentName;
  };
  consensusMode: ConsensusMode;
  nextAction: NextAction;
  instructions: string;
}

export interface NextActionResult {
  proposalId: string;
  status: ProposalStatus;
  nextAction: NextAction;
  agent?: AgentName;
  command?: string;
  instructions: string;
}

export interface ConsensusResult {
  hasConsensus: boolean;
  outcome: 'approved' | 'rejected' | 'revise' | 'disputed' | null;
  votes: Array<{ agent: AgentName; vote: Vote }>;
}

export interface Decision {
  id: string;
  proposalId: string;
  outcome: 'approved' | 'rejected' | 'deferred';
  summary: string;
  recordedAt: string;
  filePath: string;
}
