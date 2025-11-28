import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { analyzeTask } from '../core/analyzer.js';
import { createStorage, type StorageBackend } from '../storage/index.js';
import { evaluateConsensusSimple } from '../core/consensus.js';
import { logger } from '../utils/logger.js';
import { workflowEvents, enableProgressEvents, type WorkflowPhase } from '../core/events.js';
import type { AgentName, ConsensusMode, CorrumConfig, StorageConfig } from '../types/index.js';
import type { Vote } from '../types/review.js';

interface WorkflowState {
  phase: WorkflowPhase;
  proposalId: string | null;
  task: string;
  expertise: string;
  consensusMode: ConsensusMode;
  reviewsReceived: number;
  reviewsExpected: number;
  votes: Array<{ agent: string; vote: string }>;
  outcome: 'pending' | 'approved' | 'rejected' | 'revision' | 'disputed' | 'escalated' | 'implemented';
}

export const workflowCommand = new Command('workflow')
  .description('Get current workflow state or advance workflow (with progress events)')
  .option('--task <description>', 'Task description (starts new workflow)')
  .option('--proposal <id>', 'Get workflow state for existing proposal')
  .option('--advance', 'Advance to next phase (requires --proposal)')
  .option('--files <files...>', 'Files that will be modified')
  .option('--consensus-mode <mode>', 'Consensus mode: majority or unanimous')
  .option('--progress', 'Emit progress events to stderr (NDJSON format)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { task, proposal, advance, files, consensusMode, progress, json } = options;

    // Enable progress events if requested
    if (progress) {
      enableProgressEvents();
    }

    try {
      const config = loadConfig();

      if (!config.corrum.enabled) {
        if (json) {
          logger.json({ error: 'Corrum is disabled in configuration' });
        } else {
          logger.warn('Corrum is disabled in configuration');
        }
        process.exit(0);
      }

      const storage = createStorage(config.storage);

      if (task && !proposal) {
        // Start new workflow with analysis
        await handleNewWorkflow(task, files, consensusMode, config, storage, json, progress);
      } else if (proposal) {
        // Get or advance existing workflow
        await handleExistingWorkflow(proposal, advance, config, storage, json, progress);
      } else {
        // List active workflows
        await listActiveWorkflows(storage, json);
      }

      storage.close();
    } catch (error) {
      if (progress) {
        workflowEvents.workflowError(String(error), 'analysis');
      }
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Workflow error: ${error}`);
      }
      process.exit(1);
    }
  });

async function handleNewWorkflow(
  task: string,
  files: string[] | undefined,
  consensusModeOverride: ConsensusMode | undefined,
  config: CorrumConfig,
  storage: StorageBackend,
  json: boolean,
  progress: boolean
): Promise<void> {
  // Start workflow
  if (progress) {
    workflowEvents.workflowStarted(task);
    workflowEvents.phaseStarted('analysis', { task });
  }

  // Analyze task
  const analysis = analyzeTask({
    task,
    files,
    consensusMode: consensusModeOverride
  }, config);

  if (progress) {
    if (analysis.expertiseMatches && analysis.expertiseMatches.length > 0) {
      const topMatch = analysis.expertiseMatches[0];
      const promptFocus = analysis.expertiseAssignments?.planner?.promptFocus || '';
      workflowEvents.expertiseMatched(topMatch.expertise, topMatch.score, promptFocus);
    }

    workflowEvents.analysisComplete(
      analysis.requiresCorrum,
      analysis.expertiseMatches?.[0]?.expertise || 'general',
      analysis.matchedRules.keywords,
      analysis.consensusMode
    );

    workflowEvents.phaseComplete('analysis', {
      requiresCorrum: analysis.requiresCorrum
    });
  }

  const state: WorkflowState = {
    phase: 'analysis',
    proposalId: null,
    task,
    expertise: analysis.expertiseMatches?.[0]?.expertise || 'general',
    consensusMode: analysis.consensusMode,
    reviewsReceived: 0,
    reviewsExpected: analysis.assignedRoles.reviewers.length,
    votes: [],
    outcome: 'pending'
  };

  if (!analysis.requiresCorrum) {
    state.phase = 'complete';
    state.outcome = 'approved'; // No review needed = auto-approved
  }

  const output = {
    workflow_state: {
      phase: state.phase,
      proposal_id: state.proposalId,
      task: state.task,
      expertise: state.expertise,
      consensus_mode: state.consensusMode,
      reviews_received: state.reviewsReceived,
      reviews_expected: state.reviewsExpected,
      votes: state.votes,
      outcome: state.outcome
    },
    analysis: {
      requires_corrum: analysis.requiresCorrum,
      reason: analysis.reason,
      confidence: analysis.confidence,
      matched_keywords: analysis.matchedRules.keywords,
      matched_patterns: analysis.matchedRules.filePatterns
    },
    assigned_agents: {
      planner: analysis.assignedRoles.planner,
      reviewers: analysis.assignedRoles.reviewers,
      arbiter: analysis.assignedRoles.arbiter,
      implementer: analysis.assignedRoles.implementer
    },
    expertise_focus: analysis.expertiseAssignments?.planner?.promptFocus ||
                     analysis.expertiseAssignments?.reviewers[0]?.promptFocus || null,
    next_action: analysis.requiresCorrum ? 'create_proposal' : 'proceed_without_review',
    instructions: analysis.instructions
  };

  if (json) {
    logger.json(output);
  } else {
    console.log('');
    logger.info('Workflow Analysis');
    console.log('');
    logger.dim(`Task: ${task}`);
    logger.dim(`Requires Corrum: ${analysis.requiresCorrum ? 'YES' : 'NO'}`);
    logger.dim(`Expertise: ${state.expertise}`);
    logger.dim(`Consensus mode: ${state.consensusMode}`);
    console.log('');
    if (analysis.requiresCorrum) {
      logger.info('Next: Create a proposal using `corrum propose`');
    } else {
      logger.success('No multi-agent review required. Proceed with implementation.');
    }
  }
}

async function handleExistingWorkflow(
  proposalId: string,
  advance: boolean,
  config: CorrumConfig,
  storage: StorageBackend,
  json: boolean,
  progress: boolean
): Promise<void> {
  const proposal = storage.getProposal(proposalId);

  if (!proposal) {
    if (json) {
      logger.json({ error: `Proposal not found: ${proposalId}` });
    } else {
      logger.error(`Proposal not found: ${proposalId}`);
    }
    process.exit(1);
  }

  const reviews = storage.getReviewsForProposal(proposalId);
  const votes = reviews.map(r => ({ agent: r.agent, vote: r.vote }));

  // Determine current phase based on status
  let phase: WorkflowPhase;
  switch (proposal.status) {
    case 'draft':
      phase = 'planning';
      break;
    case 'pending_review':
      phase = 'review';
      break;
    case 'revision':
      phase = 'review';
      break;
    case 'disputed':
      phase = 'arbitration';
      break;
    case 'escalated':
      phase = 'arbitration';
      break;
    case 'approved':
      phase = 'implementation';
      break;
    case 'rejected':
      phase = 'complete';
      break;
    case 'implemented':
      phase = 'complete';
      break;
    default:
      phase = 'analysis';
  }

  // Calculate progress
  const expectedReviewers = proposal.reviewers?.length || 1;
  const receivedReviews = reviews.length;
  const progressPct = calculateProgressPct(phase, receivedReviews, expectedReviewers);

  // Evaluate consensus if we have reviews
  let consensusResult = null;
  if (votes.length > 0) {
    consensusResult = evaluateConsensusSimple(
      votes.map(v => v.vote as Vote),
      proposal.consensusMode || 'majority'
    );
  }

  // Determine next action
  const nextAction = getNextAction(phase, proposal.status, consensusResult);

  const state: WorkflowState = {
    phase,
    proposalId: proposal.id,
    task: proposal.title,
    expertise: 'general', // TODO: Store expertise in proposal
    consensusMode: proposal.consensusMode || 'majority',
    reviewsReceived: receivedReviews,
    reviewsExpected: expectedReviewers,
    votes,
    outcome: mapStatusToOutcome(proposal.status)
  };

  if (progress) {
    // Emit current state as events
    workflowEvents.phaseStarted(phase, { proposalId, status: proposal.status });
    if (consensusResult) {
      workflowEvents.consensusChecked(votes, state.consensusMode);
    }
  }

  const output = {
    workflow_state: {
      phase: state.phase,
      proposal_id: state.proposalId,
      task: state.task,
      expertise: state.expertise,
      consensus_mode: state.consensusMode,
      reviews_received: state.reviewsReceived,
      reviews_expected: state.reviewsExpected,
      votes: state.votes,
      outcome: state.outcome,
      progress_pct: progressPct
    },
    proposal: {
      id: proposal.id,
      title: proposal.title,
      status: proposal.status,
      planner: proposal.planner,
      reviewers: proposal.reviewers,
      iterations: proposal.iterations,
      created_at: proposal.createdAt,
      updated_at: proposal.updatedAt
    },
    consensus: consensusResult ? {
      reached: consensusResult.consensusReached,
      outcome: consensusResult.outcome,
      summary: consensusResult.summary
    } : null,
    next_action: nextAction,
    phases_complete: getPhasesComplete(phase),
    phases_pending: getPhasesPending(phase)
  };

  if (json) {
    logger.json(output);
  } else {
    console.log('');
    logger.info(`Workflow Status: ${proposal.id}`);
    console.log('');
    logger.dim(`Phase: ${phase}`);
    logger.dim(`Status: ${proposal.status}`);
    logger.dim(`Progress: ${progressPct}%`);
    logger.dim(`Reviews: ${receivedReviews}/${expectedReviewers}`);
    console.log('');
    if (votes.length > 0) {
      logger.info('Votes:');
      for (const v of votes) {
        logger.dim(`  ${v.agent}: ${v.vote}`);
      }
      console.log('');
    }
    if (consensusResult) {
      logger.dim(`Consensus: ${consensusResult.consensusReached ? 'REACHED' : 'PENDING'}`);
      if (consensusResult.consensusReached) {
        logger.dim(`Outcome: ${consensusResult.outcome}`);
      }
      console.log('');
    }
    logger.info(`Next action: ${nextAction}`);
  }
}

async function listActiveWorkflows(
  storage: StorageBackend,
  json: boolean
): Promise<void> {
  const activeStatuses = ['draft', 'pending_review', 'revision', 'disputed', 'escalated', 'approved'];
  const proposals = storage.listProposals()
    .filter(p => activeStatuses.includes(p.status));

  if (json) {
    logger.json({
      active_workflows: proposals.map(p => ({
        proposal_id: p.id,
        title: p.title,
        status: p.status,
        created_at: p.createdAt
      }))
    });
  } else {
    if (proposals.length === 0) {
      logger.info('No active workflows');
    } else {
      console.log('');
      logger.info('Active Workflows:');
      console.log('');
      for (const p of proposals) {
        logger.dim(`  ${p.id} - ${p.title} (${p.status})`);
      }
    }
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
    const reviewProgress = (reviewsReceived / reviewsExpected) * 20; // 20% of total for reviews
    basePct = 25 + reviewProgress; // Start after planning (25%)
  }

  return Math.round(basePct);
}

function mapStatusToOutcome(status: string): WorkflowState['outcome'] {
  switch (status) {
    case 'approved': return 'approved';
    case 'rejected': return 'rejected';
    case 'revision': return 'revision';
    case 'disputed': return 'disputed';
    case 'escalated': return 'escalated';
    case 'implemented': return 'implemented';
    default: return 'pending';
  }
}

function getNextAction(phase: WorkflowPhase, status: string, consensusResult: any): string {
  switch (status) {
    case 'draft':
      return 'submit_proposal';
    case 'pending_review':
      return 'request_review';
    case 'revision':
      return 'revise_proposal';
    case 'disputed':
      return 'invoke_arbiter';
    case 'escalated':
      return 'escalate_to_human';
    case 'approved':
      return 'implement_changes';
    case 'rejected':
      return 'workflow_complete';
    case 'implemented':
      return 'workflow_complete';
    default:
      return 'unknown';
  }
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
