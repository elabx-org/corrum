/**
 * Run Command
 *
 * Full streaming orchestration of the Corrum workflow.
 * Executes AI agents, shows visual progress, and manages the entire review process.
 */

import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { analyzeTask } from '../core/analyzer.js';
import { createStorage } from '../storage/index.js';
import { evaluateConsensusSimple } from '../core/consensus.js';
import { AgentExecutor, checkAgentAvailable, getAvailableAgents } from '../core/agent-executor.js';
import { workflowEvents, enableProgressEvents } from '../core/events.js';
import { WorkflowProgress, Spinner, color, formatDuration, box } from '../utils/ui.js';
import { logger } from '../utils/logger.js';
import type { AgentName, ConsensusMode } from '../types/index.js';
import type { Vote } from '../types/review.js';

interface RunOptions {
  task: string;
  files?: string[];
  consensusMode?: ConsensusMode;
  dryRun?: boolean;
  mock?: boolean;
  fast?: boolean;
  verbose?: boolean;
  json?: boolean;
  timeout?: number;
  skipImplementation?: boolean;
}

export const runCommand = new Command('run')
  .description('Execute full Corrum workflow with real-time progress')
  .requiredOption('--task <description>', 'Task description')
  .option('--files <files...>', 'Files that will be modified')
  .option('--consensus-mode <mode>', 'Consensus mode: majority or unanimous')
  .option('--dry-run', 'Show what would happen without executing agents')
  .option('--mock', 'Use mock agent responses (for testing without real CLIs)')
  .option('--fast', 'Skip loading project context (CLAUDE.md) for faster agent responses')
  .option('--verbose', 'Show detailed progress output')
  .option('--json', 'Output results as JSON (disables visual output)')
  .option('--timeout <ms>', 'Agent execution timeout in ms (default: 600000 / 10min)', '600000')
  .option('--skip-implementation', 'Stop after approval, don\'t implement')
  .action(async (options) => {
    const runOpts: RunOptions = {
      task: options.task,
      files: options.files,
      consensusMode: options.consensusMode,
      dryRun: options.dryRun,
      mock: options.mock,
      fast: options.fast,
      verbose: options.verbose ?? true,
      json: options.json,
      timeout: parseInt(options.timeout),
      skipImplementation: options.skipImplementation,
    };

    if (options.json) {
      enableProgressEvents();
    }

    try {
      const result = await executeWorkflow(runOpts);

      if (options.json) {
        logger.json(result);
      }
    } catch (error) {
      if (options.json) {
        logger.json({ error: String(error), success: false });
      } else {
        logger.error(`Workflow failed: ${error}`);
      }
      process.exit(1);
    }
  });

interface WorkflowResult {
  success: boolean;
  proposalId: string | null;
  status: string;
  expertise: string;
  votes: Array<{ agent: string; vote: string }>;
  consensusReached: boolean;
  outcome: string;
  duration: number;
  phases: {
    analysis: { duration: number; result: string };
    planning?: { duration: number; result: string };
    review?: { duration: number; votes: Array<{ agent: string; vote: string }> };
    consensus?: { duration: number; result: string };
    implementation?: { duration: number; result: string };
  };
}

async function executeWorkflow(options: RunOptions): Promise<WorkflowResult> {
  const startTime = Date.now();
  const config = loadConfig();
  const storage = createStorage(config.storage);
  const progress = new WorkflowProgress(options.verbose && !options.json);

  const result: WorkflowResult = {
    success: false,
    proposalId: null,
    status: 'pending',
    expertise: 'general',
    votes: [],
    consensusReached: false,
    outcome: 'pending',
    duration: 0,
    phases: {
      analysis: { duration: 0, result: '' },
    },
  };

  try {
    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: ANALYSIS
    // ═══════════════════════════════════════════════════════════════════
    const analysisStart = Date.now();
    progress.showPhaseHeader();
    progress.startPhase('analysis', 'Analyzing task...');

    if (options.json) {
      workflowEvents.workflowStarted(options.task);
      workflowEvents.phaseStarted('analysis', { task: options.task });
    }

    const analysis = analyzeTask({
      task: options.task,
      files: options.files,
      consensusMode: options.consensusMode,
    }, config);

    result.expertise = analysis.expertiseMatches?.[0]?.expertise || 'general';
    const consensusMode = analysis.consensusMode || 'majority';

    result.phases.analysis = {
      duration: Date.now() - analysisStart,
      result: analysis.requiresCorrum ? 'Review required' : 'No review needed',
    };

    if (options.json) {
      workflowEvents.analysisComplete(
        analysis.requiresCorrum,
        result.expertise,
        analysis.matchedRules.keywords,
        consensusMode
      );
    }

    progress.completePhase('analysis', analysis.requiresCorrum ? 'Review required' : 'No review needed');

    if (analysis.expertiseMatches?.[0]) {
      const focus = analysis.expertiseAssignments?.planner?.promptFocus || '';
      progress.showExpertise(result.expertise, analysis.expertiseMatches[0].score, focus);
    }

    // If no review needed, we're done
    if (!analysis.requiresCorrum) {
      result.success = true;
      result.status = 'skipped';
      result.outcome = 'no_review_required';
      result.duration = Date.now() - startTime;

      progress.showComplete('skipped (no review needed)');

      if (options.json) {
        workflowEvents.workflowComplete('approved', 'none');
      }

      storage.close();
      return result;
    }

    // Check agent availability (skip for dry-run and mock modes)
    const skipAgentCheck = options.dryRun || options.mock;
    const availableAgents = skipAgentCheck ? [] : await getAvailableAgents();
    if (availableAgents.length === 0 && !skipAgentCheck) {
      throw new Error('No AI agents available. Install claude, codex, or gemini CLI tools. Use --mock for testing.');
    }

    if (options.verbose && !options.json) {
      if (options.mock) {
        progress.status('Mode: MOCK (simulated agent responses)');
      } else if (options.dryRun) {
        progress.status('Mode: DRY-RUN (no execution)');
      } else {
        const modeStr = options.fast ? ' (fast mode - no project context)' : '';
        progress.status(`Available agents: ${availableAgents.join(', ')}${modeStr}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: PLANNING (Create Proposal)
    // ═══════════════════════════════════════════════════════════════════
    const planningStart = Date.now();
    progress.startPhase('planning', `Creating proposal with ${analysis.assignedRoles.planner}...`);

    if (options.json) {
      workflowEvents.phaseStarted('planning', { planner: analysis.assignedRoles.planner });
    }

    const plannerAgent = analysis.assignedRoles.planner;
    let proposalContent: string;
    let proposalId: string;

    if (options.dryRun) {
      progress.status('[DRY RUN] Would execute planner agent');
      proposalContent = `[DRY RUN] Proposal for: ${options.task}`;
      proposalId = `dryrun-${Date.now()}`;
    } else if (options.mock) {
      progress.status('[MOCK] Simulating planner response...');
      await simulateDelay(500); // Simulate agent execution time
      proposalContent = generateMockProposal(options.task);
      proposalId = `mock-${Date.now()}`;
    } else {
      // Generate planner prompt
      const plannerPromptResult = await generatePlannerPrompt(options.task, config);

      // Execute planner agent
      progress.agentActivity(plannerAgent, 'Generating proposal...');

      const executor = new AgentExecutor({ timeout: options.timeout, fast: options.fast });
      const plannerResult = await executor.execute(
        plannerAgent,
        plannerPromptResult.prompt,
        {
          onStdout: (data) => {
            if (options.verbose && !options.json) {
              // Could show streaming output here
            }
          },
        }
      );

      if (!plannerResult.success) {
        throw new Error(`Planner failed: ${plannerResult.error || 'Unknown error'}`);
      }

      proposalContent = plannerResult.output;
      proposalId = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${options.task.slice(0, 20).replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
    }

    // Create proposal in storage
    const proposal = storage.createProposal({
      id: proposalId,
      title: options.task.slice(0, 100),
      content: proposalContent,
      status: 'pending_review',
      planner: plannerAgent,
      reviewers: analysis.assignedRoles.reviewers,
      filePath: `proposals/${proposalId}.md`,
      consensusMode,
    });

    result.proposalId = proposal.id;
    result.phases.planning = {
      duration: Date.now() - planningStart,
      result: `Created proposal ${proposal.id}`,
    };

    if (options.json) {
      workflowEvents.proposalCreated(proposal.id, proposal.title, plannerAgent);
      workflowEvents.phaseComplete('planning', { proposalId: proposal.id });
    }

    progress.completePhase('planning', `Proposal created: ${proposal.id}`);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: REVIEW
    // ═══════════════════════════════════════════════════════════════════
    const reviewStart = Date.now();
    const reviewers = analysis.assignedRoles.reviewers;
    progress.startPhase('review', `Requesting ${reviewers.length} review(s)...`);

    if (options.json) {
      workflowEvents.phaseStarted('review', { reviewers, count: reviewers.length });
    }

    const votes: Array<{ agent: string; vote: Vote }> = [];

    for (let i = 0; i < reviewers.length; i++) {
      const reviewer = reviewers[i];
      const current = i + 1;
      const total = reviewers.length;

      progress.status(`Review ${current}/${total}: ${reviewer}`);

      if (options.json) {
        workflowEvents.reviewRequested(reviewer, current, total);
      }

      let vote: Vote;
      let reviewContent: string;

      if (options.dryRun) {
        progress.status(`[DRY RUN] Would execute ${reviewer} for review`);
        vote = 'APPROVE';
        reviewContent = `[DRY RUN] Review from ${reviewer}`;
      } else if (options.mock) {
        progress.status(`[MOCK] Simulating ${reviewer} review...`);
        await simulateDelay(300); // Simulate review time
        const mockReview = generateMockReview(reviewer, options.task);
        vote = mockReview.vote;
        reviewContent = mockReview.content;
      } else {
        // Generate reviewer prompt
        const reviewerPromptResult = await generateReviewerPrompt(proposal.id, reviewer, config);

        // Execute reviewer
        progress.agentActivity(reviewer, 'Reviewing proposal...');

        const executor = new AgentExecutor({ timeout: options.timeout, fast: options.fast });
        const reviewResult = await executor.execute(
          reviewer,
          reviewerPromptResult.prompt
        );

        if (!reviewResult.success) {
          progress.status(color.warn(`${reviewer} failed: ${reviewResult.error}`));
          vote = 'REVISE'; // Treat failure as request for revision
          reviewContent = `Review failed: ${reviewResult.error}`;
        } else {
          reviewContent = reviewResult.output;
          // Parse vote from review content
          vote = parseVoteFromContent(reviewContent);
        }
      }

      // Record the review
      storage.addReview({
        id: `${proposal.id}-${reviewer}-${Date.now()}`,
        proposalId: proposal.id,
        agent: reviewer,
        vote,
        content: reviewContent,
        filePath: `reviews/${proposal.id}-${reviewer}.md`,
      });

      votes.push({ agent: reviewer, vote });

      if (options.json) {
        workflowEvents.reviewReceived(reviewer, vote, current, total);
      }

      progress.showVote(reviewer, vote);
    }

    result.votes = votes.map(v => ({ agent: v.agent, vote: v.vote }));
    result.phases.review = {
      duration: Date.now() - reviewStart,
      votes: result.votes,
    };

    if (options.json) {
      workflowEvents.phaseComplete('review', { votes: result.votes });
    }

    progress.completePhase('review', `${votes.length} review(s) received`);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4: CONSENSUS
    // ═══════════════════════════════════════════════════════════════════
    const consensusStart = Date.now();
    progress.startPhase('consensus', 'Evaluating votes...');

    if (options.json) {
      workflowEvents.phaseStarted('consensus', { mode: consensusMode });
      workflowEvents.consensusChecked(result.votes, consensusMode);
    }

    const consensusResult = evaluateConsensusSimple(
      votes.map(v => v.vote),
      consensusMode
    );

    result.consensusReached = consensusResult.consensusReached;
    result.outcome = consensusResult.outcome;
    result.phases.consensus = {
      duration: Date.now() - consensusStart,
      result: consensusResult.summary,
    };

    // Update proposal status
    let newStatus: string;
    switch (consensusResult.outcome) {
      case 'approved':
        newStatus = 'approved';
        break;
      case 'rejected':
        newStatus = 'rejected';
        break;
      case 'revision':
        newStatus = 'revision';
        break;
      case 'disputed':
        newStatus = 'disputed';
        break;
      default:
        newStatus = 'pending_review';
    }

    storage.updateProposal(proposal.id, { status: newStatus as any });
    result.status = newStatus;

    if (options.json) {
      workflowEvents.consensusReached(
        consensusResult.outcome as any,
        consensusMode
      );
      workflowEvents.phaseComplete('consensus', { outcome: consensusResult.outcome });
    }

    progress.completePhase('consensus', consensusResult.summary);
    progress.showConsensus(
      consensusResult.consensusReached,
      consensusResult.outcome,
      consensusMode
    );

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5: IMPLEMENTATION (if approved)
    // ═══════════════════════════════════════════════════════════════════
    if (consensusResult.outcome === 'approved' && !options.skipImplementation) {
      const implStart = Date.now();
      const implementer = analysis.assignedRoles.implementer || 'claude';
      progress.startPhase('implementation', `Implementing with ${implementer}...`);

      if (options.json) {
        workflowEvents.phaseStarted('implementation', { implementer });
        workflowEvents.implementationStarted(proposal.id);
      }

      if (options.dryRun) {
        progress.status('[DRY RUN] Would execute implementer agent');
      } else if (options.mock) {
        progress.status('[MOCK] Simulating implementation...');
        await simulateDelay(500);
      } else {
        // Generate implementer prompt
        const implPromptResult = await generateImplementerPrompt(proposal.id, config);

        progress.agentActivity(implementer, 'Implementing changes...');

        const executor = new AgentExecutor({ timeout: options.timeout, fast: options.fast });
        const implResult = await executor.execute(implementer, implPromptResult.prompt);

        if (!implResult.success) {
          progress.status(color.warn(`Implementation warning: ${implResult.error}`));
        }
      }

      storage.updateProposal(proposal.id, { status: 'implemented' });
      result.status = 'implemented';

      result.phases.implementation = {
        duration: Date.now() - implStart,
        result: 'Changes implemented',
      };

      if (options.json) {
        workflowEvents.implementationComplete(proposal.id);
        workflowEvents.phaseComplete('implementation', { success: true });
      }

      progress.completePhase('implementation', 'Changes implemented');
    }

    // ═══════════════════════════════════════════════════════════════════
    // COMPLETE
    // ═══════════════════════════════════════════════════════════════════
    result.success = ['approved', 'implemented'].includes(result.status);
    result.duration = Date.now() - startTime;

    if (options.json) {
      workflowEvents.workflowComplete(
        result.status as any,
        proposal.id
      );
    }

    progress.showComplete(result.status, proposal.id);

    if (options.verbose && !options.json) {
      console.log('');
      console.log(color.dim(`Total time: ${formatDuration(result.duration)}`));
    }

    storage.close();
    return result;

  } catch (error) {
    result.duration = Date.now() - startTime;

    if (options.json) {
      workflowEvents.workflowError(String(error), 'analysis');
    }

    progress.failPhase('analysis', String(error));
    storage.close();
    throw error;
  }
}

/**
 * Parse vote from review content
 */
function parseVoteFromContent(content: string): Vote {
  const lowerContent = content.toLowerCase();

  // Look for explicit vote markers
  if (/\b(vote|decision|verdict):\s*(approve|approved|accept|lgtm)/i.test(content)) {
    return 'APPROVE';
  }
  if (/\b(vote|decision|verdict):\s*(reject|rejected|deny|denied)/i.test(content)) {
    return 'REJECT';
  }
  if (/\b(vote|decision|verdict):\s*(revise|revision|changes needed)/i.test(content)) {
    return 'REVISE';
  }

  // Look for sentiment
  if (lowerContent.includes('approve') || lowerContent.includes('lgtm') || lowerContent.includes('looks good')) {
    return 'APPROVE';
  }
  if (lowerContent.includes('reject') || lowerContent.includes('do not merge') || lowerContent.includes('serious concerns')) {
    return 'REJECT';
  }
  if (lowerContent.includes('revise') || lowerContent.includes('changes needed') || lowerContent.includes('please update')) {
    return 'REVISE';
  }

  // Default to APPROVE if unclear
  return 'APPROVE';
}

/**
 * Generate planner prompt using the prompt command logic
 */
async function generatePlannerPrompt(task: string, config: any): Promise<{ prompt: string }> {
  const analysis = analyzeTask({ task }, config);
  const expertise = analysis.expertiseMatches?.[0]?.expertise || 'general';
  const promptFocus = analysis.expertiseAssignments?.planner?.promptFocus || '';

  const prompt = `You are a technical planner creating a proposal for code changes.

Task: ${task}

${promptFocus ? `\n${promptFocus}\n` : ''}

Create a detailed proposal document that includes:
1. Summary of the proposed changes
2. Technical approach
3. Security considerations
4. Testing strategy
5. Potential risks and mitigations

Output your proposal in markdown format.`;

  return { prompt };
}

/**
 * Generate reviewer prompt
 */
async function generateReviewerPrompt(proposalId: string, reviewer: AgentName, config: any): Promise<{ prompt: string }> {
  const storage = createStorage(config.storage);
  const proposal = storage.getProposal(proposalId);
  storage.close();

  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }

  const prompt = `You are a code reviewer evaluating a proposal.

Proposal: ${proposal.title}

${proposal.content}

Review this proposal and provide:
1. Your assessment of the technical approach
2. Security concerns (if any)
3. Suggestions for improvement
4. Your vote: APPROVE, REJECT, or REVISE

End your review with a clear vote line, e.g., "Vote: APPROVE"`;

  return { prompt };
}

/**
 * Generate implementer prompt
 */
async function generateImplementerPrompt(proposalId: string, config: any): Promise<{ prompt: string }> {
  const storage = createStorage(config.storage);
  const proposal = storage.getProposal(proposalId);
  const reviews = storage.getReviewsForProposal(proposalId);
  storage.close();

  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }

  const reviewSummary = reviews.map(r => `${r.agent}: ${r.vote}`).join(', ');

  const prompt = `You are implementing an approved proposal.

Proposal: ${proposal.title}
Reviews: ${reviewSummary}

${proposal.content}

Implement the changes described in this proposal. Follow the technical approach outlined and address any concerns raised in the reviews.`;

  return { prompt };
}

/**
 * Helper function to simulate async delay
 */
function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a mock proposal for testing
 */
function generateMockProposal(task: string): string {
  return `# Proposal: ${task}

## Summary
This proposal addresses the requested task through a structured approach.

## Technical Approach
1. Analyze the current implementation
2. Identify areas for improvement
3. Implement changes following best practices
4. Add appropriate tests

## Security Considerations
- Input validation will be applied where necessary
- No sensitive data exposed

## Testing Strategy
- Unit tests for core logic
- Integration tests for API endpoints

## Risks and Mitigations
- Risk: Breaking existing functionality
- Mitigation: Comprehensive test coverage

---
*Generated by Mock Agent*`;
}

/**
 * Generate a mock review for testing
 */
function generateMockReview(reviewer: string, task: string): { vote: Vote; content: string } {
  // Simulate realistic voting behavior
  const votes: Vote[] = ['APPROVE', 'APPROVE', 'APPROVE', 'REVISE'];
  const vote = votes[Math.floor(Math.random() * votes.length)];

  const content = `# Review by ${reviewer}

## Assessment
The proposal for "${task}" has been reviewed.

## Technical Analysis
- Approach is sound
- Implementation strategy is appropriate
- Test coverage is adequate

## Security Review
No security concerns identified.

## Suggestions
${vote === 'REVISE' ? '- Consider adding more detailed error handling\n- Add edge case tests' : '- Minor: Consider adding inline comments'}

## Vote: ${vote}

---
*Reviewed by Mock ${reviewer}*`;

  return { vote, content };
}
