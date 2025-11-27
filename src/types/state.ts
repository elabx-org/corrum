import type { AgentName, ConsensusMode, ModelName } from './config.js';
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

// Expertise-based agent assignment
export interface ExpertiseAssignment {
  agentProfile: string;
  model: ModelName;
  expertise: string;
  reason: string;
  promptFocus: string;
}

// Expertise match details
export interface ExpertiseMatchInfo {
  expertise: string;
  score: number;
  matchedKeywords: string[];
  matchedFilePatterns: string[];
}

export interface AnalysisResult {
  requiresCorrum: boolean;
  reason: string;
  confidence: number;
  matchedRules: {
    keywords: string[];
    filePatterns: string[];
    complexity: number | null;
  };
  // Legacy role assignments (for backwards compatibility)
  assignedRoles: {
    planner: AgentName;
    reviewers: AgentName[];
    arbiter: AgentName | null;
    implementer: AgentName;
  };
  // New expertise-based assignments
  expertiseMatches?: ExpertiseMatchInfo[];
  expertiseAssignments?: {
    planner: ExpertiseAssignment | null;
    reviewers: ExpertiseAssignment[];
    arbiter: ExpertiseAssignment | null;
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
