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

        console.log('');
        logger.info(`Assigned planner: ${result.assignedRoles.planner}`);
        logger.info(`Assigned reviewers: ${result.assignedRoles.reviewers.join(', ')}`);
        logger.info(`Assigned implementer: ${result.assignedRoles.implementer}`);
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
