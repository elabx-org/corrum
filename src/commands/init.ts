import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadConfig, generateDefaultConfig, CONFIG_FILENAME } from '../config/index.js';
import { logger } from '../utils/logger.js';

export const initCommand = new Command('init')
  .description('Initialize Corrum in a project')
  .option('--force', 'Overwrite existing configuration')
  .action(async (options) => {
    const { force } = options;

    // Check if already initialized
    if (existsSync(CONFIG_FILENAME) && !force) {
      logger.error(`${CONFIG_FILENAME} already exists. Use --force to overwrite.`);
      process.exit(1);
    }

    try {
      // Create config file
      const configContent = generateDefaultConfig();
      writeFileSync(CONFIG_FILENAME, configContent);
      logger.success(`Created ${CONFIG_FILENAME}`);

      // Load config to get paths
      const config = loadConfig();
      const baseDir = config.paths.baseDir;

      // Create directory structure
      const dirs = [
        baseDir,
        join(baseDir, config.paths.proposalsDir),
        join(baseDir, config.paths.reviewsDir),
        join(baseDir, config.paths.decisionsDir),
        join(baseDir, config.paths.verificationsDir),
        join(baseDir, 'templates')
      ];

      for (const dir of dirs) {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
          logger.success(`Created ${dir}/`);
        } else {
          logger.dim(`${dir}/ already exists`);
        }
      }

      // Create default templates
      const proposalTemplate = `# Proposal: {{TITLE}}

## Summary
<!-- Brief description of what this proposal addresses -->

## Problem Statement
<!-- What problem are we solving? -->

## Proposed Solution
<!-- Detailed description of the proposed solution -->

## Implementation Plan
<!-- Step-by-step implementation approach -->
1.
2.
3.

## Alternatives Considered
<!-- What other approaches were considered and why were they rejected? -->

## Security Considerations
<!-- Any security implications? -->

## Performance Impact
<!-- Expected performance impact -->

## Testing Strategy
<!-- How will this be tested? -->

## Rollback Plan
<!-- How can this be rolled back if needed? -->

---
**Created**: {{DATE}}
**Planner**: {{PLANNER}}
**Status**: draft
`;

      const reviewTemplate = `# Review: {{PROPOSAL_ID}}

## Reviewer
**Agent**: {{AGENT}}
**Date**: {{DATE}}

## Vote: {{VOTE}}

## Summary
<!-- Brief summary of the review -->

## Detailed Analysis

### Strengths
-

### Concerns
-

### Suggestions
-

## Security Analysis
<!-- Security considerations -->

## Issue Severity
- Critical: 0
- High: 0
- Medium: 0
- Low: 0

## Recommendation
<!-- Final recommendation and reasoning -->

---
**Recorded**: {{DATE}}
`;

      const decisionTemplate = `# Decision: {{PROPOSAL_ID}}

## Outcome: {{OUTCOME}}

## Summary
{{SUMMARY}}

## Rationale
<!-- Why was this decision made? -->

## Implementation Notes
<!-- Any notes for implementation -->

## Participants
- Planner: {{PLANNER}}
- Reviewers: {{REVIEWERS}}
- Arbiter: {{ARBITER}}

---
**Decided**: {{DATE}}
`;

      writeFileSync(join(baseDir, 'templates', 'proposal.md'), proposalTemplate);
      logger.success(`Created ${join(baseDir, 'templates', 'proposal.md')}`);

      writeFileSync(join(baseDir, 'templates', 'review.md'), reviewTemplate);
      logger.success(`Created ${join(baseDir, 'templates', 'review.md')}`);

      writeFileSync(join(baseDir, 'templates', 'decision.md'), decisionTemplate);
      logger.success(`Created ${join(baseDir, 'templates', 'decision.md')}`);

      console.log('');
      logger.success('Corrum initialized successfully!');
      console.log('');
      logger.info('Configuration created with:');
      logger.dim('  - Expertise profiles: security, database, api, performance, frontend, payments, general');
      logger.dim('  - Consensus modes: majority (default), unanimous');
      logger.dim('  - Models: claude, codex, gemini');
      console.log('');
      logger.info('Next steps:');
      logger.dim('  1. Edit .corrum-config.toml to customize roles and expertise');
      logger.dim('  2. Run `corrum analyze --task "your task"` to check if review is needed');
      logger.dim('  3. Run `corrum guide` to see the full workflow');
      console.log('');
      logger.info('Claude Code orchestration:');
      logger.dim('  - Use `corrum prompt --role planner --task "..."` to generate prompts');
      logger.dim('  - Prompts include expertise focus for Task tool agents');
      logger.dim('  - Run `corrum guide --json` for machine-readable documentation');
    } catch (error) {
      logger.error(`Failed to initialize: ${error}`);
      process.exit(1);
    }
  });
