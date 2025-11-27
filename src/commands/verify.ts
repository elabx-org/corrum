import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { logger } from '../utils/logger.js';

export const verifyCommand = new Command('verify')
  .description('Run post-implementation verification')
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

      storage.close();

      // Generate verification command
      const verifyPrompt = `Verify that the implementation of proposal ${proposal.filePath} matches the approved design. Check:
1. All proposed features are implemented
2. Security recommendations were followed
3. Tests were added as specified
4. Documentation was updated

Report any deviations from the proposal.`;

      const verifyCommand = `codex exec "${verifyPrompt}"`;

      if (json) {
        logger.json({
          proposal_id: proposalId,
          status: proposal.status,
          verify_command: verifyCommand,
          message: 'TODO: Full verification implementation coming in a future release'
        });
      } else {
        console.log('');
        logger.info(`Verification for: ${proposalId}`);
        logger.dim(`Status: ${proposal.status}`);
        console.log('');
        logger.dim('Suggested verification command:');
        console.log(`  ${verifyCommand}`);
        console.log('');
        logger.warn('Note: Full verification implementation coming in a future release');
      }
    } catch (error) {
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Failed to verify: ${error}`);
      }
      process.exit(1);
    }
  });
