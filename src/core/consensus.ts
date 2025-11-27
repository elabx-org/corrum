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
