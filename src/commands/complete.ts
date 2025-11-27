import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { formatTimestamp, formatDuration } from '../utils/date.js';
import { logger } from '../utils/logger.js';

export const completeCommand = new Command('complete')
  .description('Mark a proposal as implemented')
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

      if (proposal.status !== 'approved') {
        if (json) {
          logger.json({ error: `Proposal must be approved to mark as complete. Current status: ${proposal.status}` });
        } else {
          logger.error(`Proposal must be approved to mark as complete. Current status: ${proposal.status}`);
        }
        storage.close();
        process.exit(1);
      }

      const now = formatTimestamp(new Date());
      storage.updateProposal(proposalId, {
        status: 'implemented',
        completedAt: now
      });

      const duration = formatDuration(proposal.createdAt, now);
      storage.close();

      if (json) {
        logger.json({
          proposal_id: proposalId,
          status: 'implemented',
          completed_at: now,
          duration
        });
      } else {
        console.log('');
        logger.success(`Proposal completed: ${proposalId}`);
        logger.dim(`Completed at: ${now}`);
        logger.dim(`Duration: ${duration}`);
      }
    } catch (error) {
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Failed to complete proposal: ${error}`);
      }
      process.exit(1);
    }
  });
