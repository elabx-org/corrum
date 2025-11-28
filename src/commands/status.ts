import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { getNextActionForState } from '../core/state-machine.js';
import { evaluateConsensusSimple } from '../core/consensus.js';
import { workflowEvents } from '../core/events.js';
import { logger } from '../utils/logger.js';
import type { Vote } from '../types/review.js';
import type { WorkflowPhase } from '../core/events.js';

export const statusCommand = new Command('status')
  .description('Check status of a proposal or all proposals')
  .option('--proposal <id>', 'Specific proposal ID')
  .option('--json', 'Output as JSON')
  .option('--progress', 'Emit progress events to stderr (NDJSON format)')
  .action(async (options) => {
    const { proposal: proposalId, json, progress } = options;

    // Enable progress events if requested
    if (progress) {
      workflowEvents.setEnabled(true);
    }

    try {
      const config = loadConfig();
      const storage = createStorage(config.storage);

      if (proposalId) {
        // Single proposal status
        const proposal = storage.getProposal(proposalId);
        if (!proposal) {
          if (json) {
            logger.json({ error: `Proposal not found: ${proposalId}` });
          } else {
            logger.error(`Proposal not found: ${proposalId}`);
          }
          storage.close();
          process.exit(1);
        }

        const reviews = storage.getReviewsForProposal(proposalId);
        const votes = reviews.map(r => ({ agent: r.agent, vote: r.vote }));
        const nextAction = getNextActionForState(proposal.status, {
          proposalId: proposal.id,
          iterations: proposal.iterations,
          maxIterations: config.rules.maxIterations,
          votes,
          arbiter: proposal.arbiter ?? null,
          requireUnanimous: config.rules.requireUnanimous
        });

        // Calculate workflow progress
        const phase = statusToPhase(proposal.status);
        const expectedReviewers = proposal.reviewers?.length || 1;
        const receivedReviews = reviews.length;
        const progressPct = calculateProgressPct(phase, receivedReviews, expectedReviewers);

        // Evaluate consensus
        const consensusMode = proposal.consensusMode || config.rules.consensusMode || 'majority';
        let consensusResult = null;
        if (votes.length > 0) {
          consensusResult = evaluateConsensusSimple(
            votes.map(v => v.vote as Vote),
            consensusMode
          );
        }

        // Emit progress events if enabled
        if (progress) {
          workflowEvents.phaseStarted(phase, { proposalId, status: proposal.status });
          if (consensusResult) {
            workflowEvents.consensusChecked(votes, consensusMode);
            if (consensusResult.consensusReached) {
              workflowEvents.consensusReached(
                consensusResult.outcome as 'approved' | 'rejected' | 'revision' | 'disputed',
                consensusMode
              );
            }
          }
        }

        storage.close();

        if (json) {
          logger.json({
            proposal_id: proposal.id,
            title: proposal.title,
            status: proposal.status,
            created_at: proposal.createdAt,
            planner: proposal.planner,
            reviewers: proposal.reviewers,
            votes,
            iterations: proposal.iterations,
            next_action: nextAction,
            // Workflow progress info
            workflow: {
              current_phase: phase,
              phases_complete: getPhasesComplete(phase),
              phases_pending: getPhasesPending(phase),
              progress_pct: progressPct,
              reviews_received: receivedReviews,
              reviews_expected: expectedReviewers
            },
            consensus: consensusResult ? {
              reached: consensusResult.consensusReached,
              outcome: consensusResult.outcome,
              mode: consensusMode,
              summary: consensusResult.summary
            } : null
          });
        } else {
          console.log('');
          logger.info(`Proposal: ${proposal.id}`);
          logger.dim(`Title: ${proposal.title}`);
          logger.dim(`Status: ${proposal.status}`);
          logger.dim(`Created: ${proposal.createdAt}`);
          logger.dim(`Planner: ${proposal.planner}`);
          logger.dim(`Reviewers: ${proposal.reviewers.join(', ')}`);
          logger.dim(`Iterations: ${proposal.iterations}`);
          console.log('');
          if (votes.length > 0) {
            logger.info('Votes:');
            votes.forEach(v => {
              const icon = v.vote === 'APPROVE' ? '✓' : v.vote === 'REJECT' ? '✗' : '↻';
              console.log(`  ${v.agent}: ${icon} ${v.vote}`);
            });
            console.log('');
          }
          logger.success(`Next action: ${nextAction}`);
        }
      } else {
        // All proposals status (table format)
        const proposals = storage.listProposals();
        storage.close();

        if (json) {
          logger.json(proposals.map(p => ({
            proposal_id: p.id,
            status: p.status,
            planner: p.planner,
            created_at: p.createdAt
          })));
        } else {
          if (proposals.length === 0) {
            logger.info('No proposals found');
            return;
          }

          const headers = ['ID', 'Status', 'Planner', 'Created'];
          const rows = proposals.map(p => [
            p.id.length > 35 ? p.id.substring(0, 35) + '...' : p.id,
            p.status,
            p.planner,
            p.createdAt.split('T')[0]
          ]);

          console.log('');
          logger.table(headers, rows);
        }
      }
    } catch (error) {
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Failed to get status: ${error}`);
      }
      process.exit(1);
    }
  });

// Helper functions for workflow progress

function statusToPhase(status: string): WorkflowPhase {
  switch (status) {
    case 'draft':
      return 'planning';
    case 'pending_review':
      return 'review';
    case 'revision':
      return 'review';
    case 'disputed':
      return 'arbitration';
    case 'escalated':
      return 'arbitration';
    case 'approved':
      return 'implementation';
    case 'rejected':
      return 'complete';
    case 'implemented':
      return 'complete';
    default:
      return 'analysis';
  }
}

function calculateProgressPct(phase: WorkflowPhase, reviewsReceived: number, reviewsExpected: number): number {
  const phaseWeights: Record<WorkflowPhase, number> = {
    analysis: 10,
    planning: 25,
    review: 50,
    consensus: 70,
    arbitration: 80,
    implementation: 90,
    complete: 100
  };

  let basePct = phaseWeights[phase] || 0;

  // Add review progress within review phase
  if (phase === 'review' && reviewsExpected > 0) {
    const reviewProgress = (reviewsReceived / reviewsExpected) * 20;
    basePct = 25 + reviewProgress;
  }

  return Math.round(basePct);
}

function getPhasesComplete(currentPhase: WorkflowPhase): string[] {
  const allPhases: WorkflowPhase[] = ['analysis', 'planning', 'review', 'consensus', 'implementation', 'complete'];
  const currentIndex = allPhases.indexOf(currentPhase);
  return allPhases.slice(0, currentIndex);
}

function getPhasesPending(currentPhase: WorkflowPhase): string[] {
  const allPhases: WorkflowPhase[] = ['analysis', 'planning', 'review', 'consensus', 'implementation', 'complete'];
  const currentIndex = allPhases.indexOf(currentPhase);
  return allPhases.slice(currentIndex + 1);
}
