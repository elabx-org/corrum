import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { evaluateConsensus } from '../core/consensus.js';
import { generateReviewCommand, generateArbiterCommand, generateImplementCommand } from '../core/command-generator.js';
import { selectArbiter, getModelFamily } from '../core/roles.js';
import { getNextActionForState } from '../core/state-machine.js';
import { logger } from '../utils/logger.js';
import type { NextAction, AgentName } from '../types/index.js';

export const nextCommand = new Command('next')
  .description('Get the next action for a proposal')
  .requiredOption('--proposal <id>', 'Proposal ID')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { proposal: proposalId, json } = options;

    try {
      const config = loadConfig();
      const storage = createStorage(config.storage);

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
      const consensus = evaluateConsensus(reviews, config);

      let nextAction: NextAction;
      let agent: AgentName | undefined;
      let command: string | undefined;
      let instructions: string;

      // Determine next action based on status and consensus
      switch (proposal.status) {
        case 'draft':
          nextAction = 'create_proposal';
          instructions = 'Create the proposal document';
          break;

        case 'pending_review': {
          // Check if all reviewers have reviewed
          const reviewedAgents = new Set(reviews.map(r => r.agent));
          const pendingReviewers = proposal.reviewers.filter(r => !reviewedAgents.has(r));

          if (pendingReviewers.length > 0) {
            nextAction = 'request_review';
            agent = pendingReviewers[0];
            const cmd = generateReviewCommand(proposal, agent, config);
            command = cmd.command;
            instructions = `Request review from ${agent}`;
          } else if (consensus.outcome === 'approved') {
            nextAction = 'implement';
            const cmd = generateImplementCommand(proposal, config);
            command = cmd.command;
            instructions = 'Implement the approved proposal';
          } else if (consensus.outcome === 'revise') {
            nextAction = 'revise_proposal';
            instructions = 'Revise the proposal based on feedback';
          } else if (consensus.outcome === 'disputed' || !consensus.hasConsensus) {
            nextAction = 'invoke_arbiter';
            // Select arbiter from different model family than the last reviewer
            const lastReviewerFamily = reviews.length > 0
              ? getModelFamily(reviews[reviews.length - 1].agent, config)
              : 'openai';
            agent = selectArbiter(config, storage, lastReviewerFamily);
            const cmd = generateArbiterCommand(proposal, agent, config);
            command = cmd.command;
            instructions = `Invoke ${agent} as arbiter to resolve dispute`;
          } else {
            nextAction = 'request_review';
            instructions = 'Continue with reviews';
          }
          break;
        }

        case 'revision':
          if (proposal.iterations >= config.rules.maxIterations) {
            nextAction = 'escalate_human';
            instructions = 'Max iterations reached. Human decision required.';
          } else {
            nextAction = 'revise_proposal';
            instructions = `Revise the proposal (iteration ${proposal.iterations + 1}/${config.rules.maxIterations})`;
          }
          break;

        case 'disputed': {
          nextAction = 'invoke_arbiter';
          const lastReviewerFamily = reviews.length > 0
            ? getModelFamily(reviews[reviews.length - 1].agent, config)
            : 'openai';
          agent = proposal.arbiter ?? selectArbiter(config, storage, lastReviewerFamily);
          const cmd = generateArbiterCommand(proposal, agent, config);
          command = cmd.command;
          instructions = `Invoke ${agent} as arbiter`;
          break;
        }

        case 'escalated':
          nextAction = 'escalate_human';
          instructions = 'Human decision required';
          break;

        case 'approved':
          nextAction = 'implement';
          const implCmd = generateImplementCommand(proposal, config);
          command = implCmd.command;
          instructions = 'Implement the approved proposal';
          break;

        case 'implemented':
          nextAction = 'mark_complete';
          instructions = 'Mark proposal as complete';
          break;

        case 'rejected':
          nextAction = 'escalate_human';
          instructions = 'Proposal was rejected';
          break;

        default:
          nextAction = getNextActionForState(proposal.status, {
            proposalId: proposal.id,
            iterations: proposal.iterations,
            maxIterations: config.rules.maxIterations,
            votes: reviews.map(r => ({ agent: r.agent, vote: r.vote })),
            arbiter: proposal.arbiter ?? null,
            requireUnanimous: config.rules.requireUnanimous
          });
          instructions = `Next action: ${nextAction}`;
      }

      storage.close();

      if (json) {
        logger.json({
          proposal_id: proposal.id,
          status: proposal.status,
          next_action: nextAction,
          agent: agent ?? null,
          command: command ?? null,
          instructions
        });
      } else {
        console.log('');
        logger.info(`Proposal: ${proposal.id}`);
        logger.dim(`Status: ${proposal.status}`);
        console.log('');
        logger.success(`Next action: ${nextAction}`);
        if (agent) {
          logger.dim(`Agent: ${agent}`);
        }
        console.log('');
        logger.dim(`Instructions: ${instructions}`);
        if (command) {
          console.log('');
          logger.dim('Command:');
          console.log(`  ${command}`);
        }
      }
    } catch (error) {
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Failed to get next action: ${error}`);
      }
      process.exit(1);
    }
  });
