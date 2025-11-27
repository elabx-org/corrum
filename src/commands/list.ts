import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { logger } from '../utils/logger.js';
import type { AgentName, ProposalStatus } from '../types/index.js';

export const listCommand = new Command('list')
  .description('List proposals with filters')
  .option('--status <status>', 'Filter by status')
  .option('--not-implemented', 'Only approved but not implemented')
  .option('--since <date>', 'Filter by date (YYYY-MM-DD)')
  .option('--planner <agent>', 'Filter by planner agent')
  .option('--format <format>', 'Output format: table/json/csv', 'table')
  .action(async (options) => {
    const { status, notImplemented, since, planner, format } = options;

    try {
      const config = loadConfig();
      const storage = createStorage(config.storage);

      const proposals = storage.listProposals({
        status: status as ProposalStatus | undefined,
        notImplemented,
        since: since ? new Date(since) : undefined,
        planner: planner as AgentName | undefined
      });

      storage.close();

      if (format === 'json') {
        logger.json(proposals.map(p => ({
          proposal_id: p.id,
          title: p.title,
          status: p.status,
          planner: p.planner,
          created_at: p.createdAt,
          completed_at: p.completedAt
        })));
      } else if (format === 'csv') {
        console.log('id,title,status,planner,created_at,completed_at');
        proposals.forEach(p => {
          console.log(`${p.id},${p.title},${p.status},${p.planner},${p.createdAt},${p.completedAt ?? ''}`);
        });
      } else {
        if (proposals.length === 0) {
          logger.info('No proposals found matching filters');
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
        console.log('');
        logger.dim(`Total: ${proposals.length} proposal(s)`);
      }
    } catch (error) {
      logger.error(`Failed to list proposals: ${error}`);
      process.exit(1);
    }
  });
