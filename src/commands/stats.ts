import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { logger } from '../utils/logger.js';

export const statsCommand = new Command('stats')
  .description('Show Corrum metrics and statistics')
  .option('--since <date>', 'Filter by date (YYYY-MM-DD)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { since, json } = options;

    try {
      const config = loadConfig();
      const storage = createStorage(config.storage);

      const stats = storage.getStats(since ? new Date(since) : undefined);
      storage.close();

      if (json) {
        logger.json({
          total_proposals: stats.totalProposals,
          by_status: stats.byStatus,
          total_reviews: stats.totalReviews,
          avg_reviews_per_proposal: Math.round(stats.avgReviewsPerProposal * 10) / 10,
          arbiter_invocations: stats.arbiterInvocations,
          issues_by_severity: stats.issuesBySeverity,
          by_agent: stats.byAgent
        });
      } else {
        console.log('');
        console.log('Corrum Statistics');
        console.log('─────────────────────────────────────');
        console.log(`Total Proposals:        ${stats.totalProposals}`);

        const statusEntries = Object.entries(stats.byStatus).filter(([_, count]) => count > 0);
        statusEntries.forEach(([status, count]) => {
          const pct = stats.totalProposals > 0 ? Math.round((count / stats.totalProposals) * 100) : 0;
          console.log(`  ${status.padEnd(18)} ${count} (${pct}%)`);
        });

        console.log('');
        console.log('Reviews:');
        console.log(`  Total Reviews:        ${stats.totalReviews}`);
        console.log(`  Avg per Proposal:     ${Math.round(stats.avgReviewsPerProposal * 10) / 10}`);
        console.log(`  Arbiter Invocations:  ${stats.arbiterInvocations}`);

        const { critical, high, medium, low } = stats.issuesBySeverity;
        if (critical + high + medium + low > 0) {
          console.log('');
          console.log('Issues Found:');
          if (critical > 0) console.log(`  Critical:             ${critical}`);
          if (high > 0) console.log(`  High:                 ${high}`);
          if (medium > 0) console.log(`  Medium:               ${medium}`);
          if (low > 0) console.log(`  Low:                  ${low}`);
        }

        console.log('');
        console.log('Agents:');
        Object.entries(stats.byAgent).forEach(([agent, data]) => {
          const parts: string[] = [];
          if (data.proposals > 0) parts.push(`${data.proposals} proposals`);
          if (data.reviews > 0) parts.push(`${data.reviews} reviews`);
          if (data.arbitrations > 0) parts.push(`${data.arbitrations} arbitrations`);
          if (parts.length > 0) {
            console.log(`  ${agent.padEnd(8)} ${parts.join(', ')}`);
          }
        });
      }
    } catch (error) {
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Failed to get stats: ${error}`);
      }
      process.exit(1);
    }
  });
