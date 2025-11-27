#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { analyzeCommand } from './commands/analyze.js';
import { proposeCommand } from './commands/propose.js';
import { nextCommand } from './commands/next.js';
import { addReviewCommand } from './commands/add-review.js';
import { decideCommand } from './commands/decide.js';
import { completeCommand } from './commands/complete.js';
import { statusCommand } from './commands/status.js';
import { listCommand } from './commands/list.js';
import { statsCommand } from './commands/stats.js';
import { verifyCommand } from './commands/verify.js';
import { guideCommand } from './commands/guide.js';

const program = new Command();

program
  .name('corrum')
  .description('Meta-orchestrator for multi-agent AI code reviews')
  .version('0.1.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(analyzeCommand);
program.addCommand(proposeCommand);
program.addCommand(nextCommand);
program.addCommand(addReviewCommand);
program.addCommand(decideCommand);
program.addCommand(completeCommand);
program.addCommand(statusCommand);
program.addCommand(listCommand);
program.addCommand(statsCommand);
program.addCommand(verifyCommand);
program.addCommand(guideCommand);

program.parse();
