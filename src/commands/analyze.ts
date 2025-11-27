import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { analyzeTask } from '../core/analyzer.js';
import { logger } from '../utils/logger.js';
import type { AgentName, ConsensusMode } from '../types/index.js';

export const analyzeCommand = new Command('analyze')
  .description('Analyze a task to determine if Corrum review is needed')
  .requiredOption('--task <description>', 'Task description')
  .option('--files <files...>', 'Files that will be modified')
  .option('--force', 'Force Corrum review regardless of rules')
  .option('--skip', 'Skip Corrum review regardless of rules')
  .option('--planner <agent>', 'Override planner (claude/codex/gemini)')
  .option('--reviewer <agent>', 'Override reviewer (claude/codex/gemini)')
  .option('--implementer <agent>', 'Override implementer (claude/codex/gemini, default: claude)')
  .option('--consensus-mode <mode>', 'Consensus mode: majority or unanimous')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { task, files, force, skip, planner, reviewer, implementer, consensusMode, json } = options;

    try {
      const config = loadConfig();

      if (!config.corrum.enabled) {
        if (json) {
          logger.json({ error: 'Corrum is disabled in configuration' });
        } else {
          logger.warn('Corrum is disabled in configuration');
        }
        process.exit(0);
      }

      const result = analyzeTask({
        task,
        files,
        force,
        skip,
        planner: planner as AgentName | undefined,
        reviewer: reviewer as AgentName | undefined,
        implementer: implementer as AgentName | undefined,
        consensusMode: consensusMode as ConsensusMode | undefined
      }, config);

      if (json) {
        // Convert to snake_case for JSON output
        const jsonOutput = {
          requires_corrum: result.requiresCorrum,
          reason: result.reason,
          confidence: result.confidence,
          matched_rules: {
            keywords: result.matchedRules.keywords,
            file_patterns: result.matchedRules.filePatterns,
            complexity: result.matchedRules.complexity
          },
          assigned_roles: {
            planner: result.assignedRoles.planner,
            reviewers: result.assignedRoles.reviewers,
            arbiter: result.assignedRoles.arbiter,
            implementer: result.assignedRoles.implementer
          },
          expertise_matches: result.expertiseMatches?.map(m => ({
            expertise: m.expertise,
            score: m.score,
            matched_keywords: m.matchedKeywords,
            matched_file_patterns: m.matchedFilePatterns
          })),
          expertise_assignments: result.expertiseAssignments ? {
            planner: result.expertiseAssignments.planner ? {
              agent_profile: result.expertiseAssignments.planner.agentProfile,
              model: result.expertiseAssignments.planner.model,
              expertise: result.expertiseAssignments.planner.expertise,
              reason: result.expertiseAssignments.planner.reason,
              prompt_focus: result.expertiseAssignments.planner.promptFocus
            } : null,
            reviewers: result.expertiseAssignments.reviewers.map(r => ({
              agent_profile: r.agentProfile,
              model: r.model,
              expertise: r.expertise,
              reason: r.reason,
              prompt_focus: r.promptFocus
            })),
            arbiter: result.expertiseAssignments.arbiter ? {
              agent_profile: result.expertiseAssignments.arbiter.agentProfile,
              model: result.expertiseAssignments.arbiter.model,
              expertise: result.expertiseAssignments.arbiter.expertise,
              reason: result.expertiseAssignments.arbiter.reason,
              prompt_focus: result.expertiseAssignments.arbiter.promptFocus
            } : null
          } : undefined,
          consensus_mode: result.consensusMode,
          next_action: result.nextAction,
          instructions: result.instructions
        };
        logger.json(jsonOutput);
      } else {
        console.log('');
        if (result.requiresCorrum) {
          logger.success(`Corrum review: REQUIRED (${Math.round(result.confidence * 100)}% confidence)`);
        } else {
          logger.info(`Corrum review: NOT REQUIRED`);
        }
        console.log('');
        logger.dim(`Reason: ${result.reason}`);
        console.log('');

        if (result.matchedRules.keywords.length > 0) {
          logger.dim(`Matched keywords: ${result.matchedRules.keywords.join(', ')}`);
        }
        if (result.matchedRules.filePatterns.length > 0) {
          logger.dim(`Matched file patterns: ${result.matchedRules.filePatterns.join(', ')}`);
        }

        // Display expertise matches
        if (result.expertiseMatches && result.expertiseMatches.length > 0) {
          console.log('');
          logger.info('Expertise matches:');
          for (const match of result.expertiseMatches) {
            const details = [];
            if (match.matchedKeywords.length > 0) details.push(`keywords: ${match.matchedKeywords.join(', ')}`);
            if (match.matchedFilePatterns.length > 0) details.push(`patterns: ${match.matchedFilePatterns.join(', ')}`);
            logger.dim(`  ${match.expertise} (score: ${match.score})${details.length > 0 ? ` - ${details.join('; ')}` : ''}`);
          }
        }

        console.log('');
        // Display expertise-based assignments if available
        if (result.expertiseAssignments) {
          logger.info('Expertise-based agent assignments:');
          if (result.expertiseAssignments.planner) {
            const p = result.expertiseAssignments.planner;
            logger.dim(`  Planner: ${p.agentProfile} (${p.model}) - ${p.reason}`);
          }
          for (const r of result.expertiseAssignments.reviewers) {
            logger.dim(`  Reviewer: ${r.agentProfile} (${r.model}) - ${r.reason}`);
          }
          if (result.expertiseAssignments.arbiter) {
            const a = result.expertiseAssignments.arbiter;
            logger.dim(`  Arbiter: ${a.agentProfile} (${a.model}) - ${a.reason}`);
          }
          console.log('');
        }

        // Legacy role display
        logger.dim(`Legacy assigned planner: ${result.assignedRoles.planner}`);
        logger.dim(`Legacy assigned reviewers: ${result.assignedRoles.reviewers.join(', ')}`);
        logger.dim(`Legacy assigned implementer: ${result.assignedRoles.implementer}`);
        logger.info(`Consensus mode: ${result.consensusMode}`);
        console.log('');
        logger.dim(`Next action: ${result.nextAction}`);
        logger.dim(`Instructions: ${result.instructions}`);
      }
    } catch (error) {
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Analysis failed: ${error}`);
      }
      process.exit(1);
    }
  });
