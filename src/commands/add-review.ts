import { Command } from 'commander';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { evaluateConsensus } from '../core/consensus.js';
import { formatTimestamp } from '../utils/date.js';
import { logger } from '../utils/logger.js';
import type { AgentName, Vote, ProposalStatus, ConsensusMode } from '../types/index.js';

export const addReviewCommand = new Command('add-review')
  .description('Record a review from an agent')
  .requiredOption('--proposal <id>', 'Proposal ID')
  .requiredOption('--agent <agent>', 'Reviewing agent: claude/codex/gemini')
  .requiredOption('--vote <vote>', 'Vote: APPROVE/REJECT/REVISE')
  .option('--content <content>', 'Review content in markdown')
  .option('--file <file>', 'Read content from file')
  .option('--severity <severity>', 'Severity counts as JSON: {"critical":0,"high":0,"medium":0,"low":0}')
  .option('--consensus-mode <mode>', 'Consensus mode: majority or unanimous')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { proposal: proposalId, agent, vote, content, file, severity, consensusMode, json } = options;

    // Validate vote
    const validVotes: Vote[] = ['APPROVE', 'REJECT', 'REVISE'];
    const upperVote = vote.toUpperCase() as Vote;
    if (!validVotes.includes(upperVote)) {
      if (json) {
        logger.json({ error: `Invalid vote: ${vote}. Must be APPROVE, REJECT, or REVISE` });
      } else {
        logger.error(`Invalid vote: ${vote}. Must be APPROVE, REJECT, or REVISE`);
      }
      process.exit(1);
    }

    // Validate agent
    const validAgents: AgentName[] = ['claude', 'codex', 'gemini'];
    if (!validAgents.includes(agent as AgentName)) {
      if (json) {
        logger.json({ error: `Invalid agent: ${agent}. Must be claude, codex, or gemini` });
      } else {
        logger.error(`Invalid agent: ${agent}. Must be claude, codex, or gemini`);
      }
      process.exit(1);
    }

    // Validate consensus mode if provided
    const validConsensusModes: ConsensusMode[] = ['majority', 'unanimous'];
    if (consensusMode && !validConsensusModes.includes(consensusMode as ConsensusMode)) {
      if (json) {
        logger.json({ error: `Invalid consensus mode: ${consensusMode}. Must be majority or unanimous` });
      } else {
        logger.error(`Invalid consensus mode: ${consensusMode}. Must be majority or unanimous`);
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

      // Get review content
      let reviewContent = content;
      if (file && existsSync(file)) {
        reviewContent = readFileSync(file, 'utf-8');
      } else if (!reviewContent) {
        // Use template
        const templatePath = join(config.paths.baseDir, config.templates.review);
        if (existsSync(templatePath)) {
          reviewContent = readFileSync(templatePath, 'utf-8')
            .replace(/\{\{PROPOSAL_ID\}\}/g, proposalId)
            .replace(/\{\{AGENT\}\}/g, agent)
            .replace(/\{\{VOTE\}\}/g, upperVote)
            .replace(/\{\{DATE\}\}/g, formatTimestamp(new Date()));
        } else {
          reviewContent = `# Review: ${proposalId}\n\n**Agent**: ${agent}\n**Vote**: ${upperVote}\n**Date**: ${formatTimestamp(new Date())}`;
        }
      }

      // Parse severity if provided
      let severityCounts = undefined;
      if (severity) {
        try {
          severityCounts = JSON.parse(severity);
        } catch {
          if (json) {
            logger.json({ error: 'Invalid severity JSON' });
          } else {
            logger.error('Invalid severity JSON');
          }
          storage.close();
          process.exit(1);
        }
      }

      // Create review file
      const reviewDir = join(config.paths.baseDir, config.paths.reviewsDir);
      if (!existsSync(reviewDir)) {
        mkdirSync(reviewDir, { recursive: true });
      }

      const reviewId = `${proposalId}-${agent}`;
      const filePath = join(reviewDir, `${reviewId}.md`);
      writeFileSync(filePath, reviewContent);

      // Store review in database
      const review = storage.addReview({
        id: reviewId,
        proposalId,
        agent: agent as AgentName,
        vote: upperVote,
        content: reviewContent,
        severity: severityCounts,
        filePath
      });

      // Get all reviews and evaluate consensus
      const allReviews = storage.getReviewsForProposal(proposalId);
      const consensus = evaluateConsensus(allReviews, config, {
        consensusModeOverride: consensusMode as ConsensusMode | undefined
      });

      // Determine suggested status and next action (but don't auto-apply)
      let suggestedStatus: ProposalStatus = proposal.status;
      let nextAction = 'request_review';

      if (consensus.hasConsensus) {
        if (consensus.outcome === 'approved') {
          suggestedStatus = 'approved';
          nextAction = 'implement';
        } else if (consensus.outcome === 'rejected') {
          suggestedStatus = 'rejected';
          nextAction = 'escalate_human';
        } else if (consensus.outcome === 'revise') {
          suggestedStatus = 'revision';
          nextAction = 'revise_proposal';
        }
      } else if (consensus.outcome === 'disputed') {
        suggestedStatus = 'disputed';
        nextAction = 'invoke_arbiter';
      }

      // Status is NOT auto-updated - AI agent should explicitly call:
      // - corrum decide --proposal X --outcome approved/rejected
      // - or corrum next --proposal X to see what to do next
      // This keeps the AI agent in control of the workflow

      storage.close();

      const votes = allReviews.map(r => ({ agent: r.agent, vote: r.vote }));

      // Determine effective consensus mode for output
      const effectiveConsensusMode = consensusMode ?? config.rules.consensusMode ?? 'majority';

      if (json) {
        logger.json({
          proposal_id: proposalId,
          review_file: filePath,
          votes,
          consensus: consensus.hasConsensus,
          consensus_mode: effectiveConsensusMode,
          current_status: proposal.status,
          suggested_status: suggestedStatus,
          suggested_action: nextAction,
          instructions: consensus.hasConsensus
            ? `Consensus reached: ${consensus.outcome}. Run 'corrum decide --proposal "${proposalId}" --outcome ${consensus.outcome}' to confirm.`
            : `No consensus yet. Run 'corrum next --proposal "${proposalId}"' to see what to do.`
        });
      } else {
        console.log('');
        logger.success(`Review recorded: ${reviewId}`);
        logger.dim(`File: ${filePath}`);
        console.log('');
        logger.info('Votes:');
        votes.forEach(v => {
          const icon = v.vote === 'APPROVE' ? '✓' : v.vote === 'REJECT' ? '✗' : '↻';
          console.log(`  ${v.agent}: ${icon} ${v.vote}`);
        });
        console.log('');
        logger.dim(`Consensus mode: ${effectiveConsensusMode}`);
        logger.dim(`Consensus reached: ${consensus.hasConsensus ? 'Yes' : 'No'}`);
        logger.dim(`Current status: ${proposal.status}`);
        logger.dim(`Suggested status: ${suggestedStatus}`);
        logger.info(`Suggested action: ${nextAction}`);
        console.log('');
        if (consensus.hasConsensus) {
          logger.dim(`To confirm: corrum decide --proposal "${proposalId}" --outcome ${consensus.outcome}`);
        } else {
          logger.dim(`Check next step: corrum next --proposal "${proposalId}"`);
        }
      }
    } catch (error) {
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Failed to add review: ${error}`);
      }
      process.exit(1);
    }
  });
