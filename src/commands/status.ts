import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { getNextActionForState } from '../core/state-machine.js';
import { logger } from '../utils/logger.js';

export const statusCommand = new Command('status')
  .description('Check status of a proposal or all proposals')
  .option('--proposal <id>', 'Specific proposal ID')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { proposal: proposalId, json } = options;

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
            next_action: nextAction
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
