import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { generateProposalId, formatTimestamp } from '../utils/date.js';
import { generateReviewCommand } from '../core/command-generator.js';
import { logger } from '../utils/logger.js';
import type { AgentName } from '../types/index.js';

export const proposeCommand = new Command('propose')
  .description('Create a new proposal')
  .requiredOption('--title <title>', 'Short kebab-case title')
  .option('--content <content>', 'Proposal content in markdown')
  .option('--file <file>', 'Read content from file')
  .option('--template <template>', 'Use custom template')
  .option('--planner <agent>', 'Override planner (claude/codex/gemini)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { title, content, file, template, planner, json } = options;

    try {
      const config = loadConfig();
      const storage = createStorage(config.storage);

      // Generate proposal ID
      const proposalId = generateProposalId(title);

      // Get content
      let proposalContent = content;
      if (file && existsSync(file)) {
        proposalContent = readFileSync(file, 'utf-8');
      } else if (!proposalContent) {
        // Use template
        const templatePath = template
          ? join(config.paths.baseDir, template)
          : join(config.paths.baseDir, config.templates.proposal);

        if (existsSync(templatePath)) {
          proposalContent = readFileSync(templatePath, 'utf-8')
            .replace(/\{\{TITLE\}\}/g, title)
            .replace(/\{\{DATE\}\}/g, formatTimestamp(new Date()))
            .replace(/\{\{PLANNER\}\}/g, planner ?? config.roles.defaultPlanner);
        } else {
          proposalContent = `# Proposal: ${title}\n\nCreated: ${formatTimestamp(new Date())}\n\n<!-- Add proposal content here -->`;
        }
      }

      // Create proposal file
      const proposalDir = join(config.paths.baseDir, config.paths.proposalsDir);
      if (!existsSync(proposalDir)) {
        mkdirSync(proposalDir, { recursive: true });
      }

      const filePath = join(proposalDir, `${proposalId}.md`);
      writeFileSync(filePath, proposalContent);

      // Store in database
      const assignedPlanner = (planner as AgentName) ?? config.roles.defaultPlanner;
      const proposal = storage.createProposal({
        id: proposalId,
        title,
        content: proposalContent,
        status: 'pending_review',
        planner: assignedPlanner,
        reviewers: config.roles.defaultReviewers,
        filePath
      });

      // Generate review command for first reviewer
      const firstReviewer = config.roles.defaultReviewers[0];
      const reviewCmd = generateReviewCommand(proposal, firstReviewer, config);

      storage.close();

      if (json) {
        logger.json({
          proposal_id: proposal.id,
          file: proposal.filePath,
          status: proposal.status,
          created_at: proposal.createdAt,
          next_action: 'request_review',
          review_command: reviewCmd.command
        });
      } else {
        console.log('');
        logger.success(`Created proposal: ${proposal.id}`);
        logger.dim(`File: ${proposal.filePath}`);
        logger.dim(`Status: ${proposal.status}`);
        console.log('');
        logger.info('Next action: request_review');
        console.log('');
        logger.dim('Review command:');
        console.log(`  ${reviewCmd.command}`);
        console.log('');
        logger.dim('After review, run:');
        console.log(`  corrum add-review --proposal "${proposal.id}" --agent ${firstReviewer} --vote APPROVE|REJECT|REVISE --content "..."`);
      }
    } catch (error) {
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Failed to create proposal: ${error}`);
      }
      process.exit(1);
    }
  });
