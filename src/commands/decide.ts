import { Command } from 'commander';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { formatTimestamp } from '../utils/date.js';
import { logger } from '../utils/logger.js';
import type { ProposalStatus } from '../types/index.js';

export const decideCommand = new Command('decide')
  .description('Record final decision for a proposal')
  .requiredOption('--proposal <id>', 'Proposal ID')
  .requiredOption('--outcome <outcome>', 'Decision outcome: approved/rejected/deferred')
  .option('--summary <summary>', 'Decision summary')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { proposal: proposalId, outcome, summary, json } = options;

    // Validate outcome
    const validOutcomes = ['approved', 'rejected', 'deferred'];
    if (!validOutcomes.includes(outcome)) {
      if (json) {
        logger.json({ error: `Invalid outcome: ${outcome}. Must be approved, rejected, or deferred` });
      } else {
        logger.error(`Invalid outcome: ${outcome}. Must be approved, rejected, or deferred`);
      }
      process.exit(1);
    }

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

      // Create decision content
      const templatePath = join(config.paths.baseDir, config.templates.decision);
      let decisionContent: string;

      if (existsSync(templatePath)) {
        decisionContent = readFileSync(templatePath, 'utf-8')
          .replace(/\{\{PROPOSAL_ID\}\}/g, proposalId)
          .replace(/\{\{OUTCOME\}\}/g, outcome.toUpperCase())
          .replace(/\{\{SUMMARY\}\}/g, summary ?? 'No summary provided')
          .replace(/\{\{PLANNER\}\}/g, proposal.planner)
          .replace(/\{\{REVIEWERS\}\}/g, proposal.reviewers.join(', '))
          .replace(/\{\{ARBITER\}\}/g, proposal.arbiter ?? 'None')
          .replace(/\{\{DATE\}\}/g, formatTimestamp(new Date()));
      } else {
        decisionContent = `# Decision: ${proposalId}

## Outcome: ${outcome.toUpperCase()}

## Summary
${summary ?? 'No summary provided'}

## Participants
- Planner: ${proposal.planner}
- Reviewers: ${proposal.reviewers.join(', ')}
- Arbiter: ${proposal.arbiter ?? 'None'}

## Review Summary
${reviews.map(r => `- ${r.agent}: ${r.vote}`).join('\n')}

---
**Decided**: ${formatTimestamp(new Date())}
`;
      }

      // Create decision file
      const decisionDir = join(config.paths.baseDir, config.paths.decisionsDir);
      if (!existsSync(decisionDir)) {
        mkdirSync(decisionDir, { recursive: true });
      }

      const decisionId = `decision-${proposalId}`;
      const filePath = join(decisionDir, `${proposalId}.md`);
      writeFileSync(filePath, decisionContent);

      // Record decision in database
      const now = formatTimestamp(new Date());
      storage.recordDecision({
        id: decisionId,
        proposalId,
        outcome: outcome as 'approved' | 'rejected' | 'deferred',
        summary: summary ?? '',
        recordedAt: now,
        filePath
      });

      // Update proposal status
      let newStatus: ProposalStatus;
      if (outcome === 'approved') {
        newStatus = 'approved';
      } else if (outcome === 'rejected') {
        newStatus = 'rejected';
      } else {
        newStatus = 'escalated'; // deferred goes to escalated for human review
      }

      storage.updateProposal(proposalId, { status: newStatus });
      storage.close();

      if (json) {
        logger.json({
          proposal_id: proposalId,
          decision_file: filePath,
          outcome,
          recorded_at: now
        });
      } else {
        console.log('');
        logger.success(`Decision recorded: ${outcome.toUpperCase()}`);
        logger.dim(`File: ${filePath}`);
        logger.dim(`Recorded: ${now}`);

        if (outcome === 'approved') {
          console.log('');
          logger.info('Next step: Implement the approved proposal');
          logger.dim('Run: corrum complete --proposal "' + proposalId + '" after implementation');
        }
      }
    } catch (error) {
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Failed to record decision: ${error}`);
      }
      process.exit(1);
    }
  });
