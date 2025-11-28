import type { Review, Vote } from '../types/review.js';
import type { CorrumConfig, AgentName, ConsensusResult, ConsensusMode } from '../types/index.js';

export interface EvaluateConsensusOptions {
  /** Override the consensus mode from config */
  consensusModeOverride?: ConsensusMode;
}

export function evaluateConsensus(
  reviews: Review[],
  config: CorrumConfig,
  options?: EvaluateConsensusOptions
): ConsensusResult {
  if (reviews.length === 0) {
    return {
      hasConsensus: false,
      outcome: null,
      votes: []
    };
  }

  const votes = reviews.map(r => ({ agent: r.agent, vote: r.vote }));
  const voteCounts: Record<Vote, number> = {
    APPROVE: 0,
    REJECT: 0,
    REVISE: 0
  };

  for (const review of reviews) {
    voteCounts[review.vote]++;
  }

  const totalVotes = reviews.length;

  // Determine consensus mode: override > config.consensusMode > legacy requireUnanimous
  const consensusMode: ConsensusMode = options?.consensusModeOverride
    ?? config.rules.consensusMode
    ?? (config.rules.requireUnanimous ? 'unanimous' : 'majority');

  // Check for unanimous approval/rejection (always accepted regardless of mode)
  if (voteCounts.APPROVE === totalVotes) {
    return { hasConsensus: true, outcome: 'approved', votes };
  }
  if (voteCounts.REJECT === totalVotes) {
    return { hasConsensus: true, outcome: 'rejected', votes };
  }

  // Check for any REVISE votes - always trigger revision
  if (voteCounts.REVISE > 0) {
    return { hasConsensus: true, outcome: 'revise', votes };
  }

  // For majority mode, use simple majority
  if (consensusMode === 'majority') {
    if (voteCounts.APPROVE > voteCounts.REJECT) {
      return { hasConsensus: true, outcome: 'approved', votes };
    }
    if (voteCounts.REJECT > voteCounts.APPROVE) {
      return { hasConsensus: true, outcome: 'rejected', votes };
    }
  }

  // For unanimous mode (or tie in majority mode) - no consensus, disputed
  return { hasConsensus: false, outcome: 'disputed', votes };
}

/**
 * Simple consensus evaluation from raw votes and a consensus mode
 * Used by workflow orchestration commands that already have extracted votes
 */
export interface SimpleConsensusResult {
  consensusReached: boolean;
  outcome: 'approved' | 'rejected' | 'revision' | 'disputed' | 'pending';
  summary: string;
}

export function evaluateConsensusSimple(
  votes: Vote[],
  mode: ConsensusMode = 'majority'
): SimpleConsensusResult {
  if (votes.length === 0) {
    return {
      consensusReached: false,
      outcome: 'pending',
      summary: 'No votes received'
    };
  }

  const voteCounts: Record<Vote, number> = {
    APPROVE: 0,
    REJECT: 0,
    REVISE: 0
  };

  for (const vote of votes) {
    voteCounts[vote]++;
  }

  const totalVotes = votes.length;

  // Check for unanimous approval
  if (voteCounts.APPROVE === totalVotes) {
    return {
      consensusReached: true,
      outcome: 'approved',
      summary: `All ${totalVotes} vote(s) APPROVE`
    };
  }

  // Check for unanimous rejection
  if (voteCounts.REJECT === totalVotes) {
    return {
      consensusReached: true,
      outcome: 'rejected',
      summary: `All ${totalVotes} vote(s) REJECT`
    };
  }

  // Any REVISE votes trigger revision
  if (voteCounts.REVISE > 0) {
    return {
      consensusReached: true,
      outcome: 'revision',
      summary: `${voteCounts.REVISE} vote(s) request REVISE`
    };
  }

  // For majority mode
  if (mode === 'majority') {
    if (voteCounts.APPROVE > voteCounts.REJECT) {
      return {
        consensusReached: true,
        outcome: 'approved',
        summary: `Majority APPROVE (${voteCounts.APPROVE}/${totalVotes})`
      };
    }
    if (voteCounts.REJECT > voteCounts.APPROVE) {
      return {
        consensusReached: true,
        outcome: 'rejected',
        summary: `Majority REJECT (${voteCounts.REJECT}/${totalVotes})`
      };
    }
  }

  // No consensus - disputed
  return {
    consensusReached: false,
    outcome: 'disputed',
    summary: `Split vote: ${voteCounts.APPROVE} APPROVE, ${voteCounts.REJECT} REJECT`
  };
}
