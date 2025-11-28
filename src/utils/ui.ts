/**
 * Visual UI Utilities
 *
 * Provides spinners, progress bars, and colored terminal output
 * for real-time feedback during workflow execution.
 */

import { WorkflowPhase } from '../core/events.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// Unicode symbols
const symbols = {
  check: '✓',
  cross: '✗',
  warning: '⚠',
  info: 'ℹ',
  arrow: '→',
  arrowRight: '▶',
  bullet: '•',
  ellipsis: '…',
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  progress: {
    filled: '█',
    empty: '░',
    partial: ['▏', '▎', '▍', '▌', '▋', '▊', '▉'],
  },
  phases: {
    analysis: '🔍',
    planning: '📝',
    review: '👀',
    consensus: '🤝',
    arbitration: '⚖️',
    implementation: '🔨',
    complete: '✅',
  } as Record<WorkflowPhase, string>,
};

// Color helper functions
export const color = {
  red: (text: string) => `${colors.red}${text}${colors.reset}`,
  green: (text: string) => `${colors.green}${text}${colors.reset}`,
  yellow: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  blue: (text: string) => `${colors.blue}${text}${colors.reset}`,
  cyan: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  magenta: (text: string) => `${colors.magenta}${text}${colors.reset}`,
  gray: (text: string) => `${colors.gray}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
  bold: (text: string) => `${colors.bold}${text}${colors.reset}`,

  // Status colors
  success: (text: string) => `${colors.green}${text}${colors.reset}`,
  error: (text: string) => `${colors.red}${text}${colors.reset}`,
  warn: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  info: (text: string) => `${colors.cyan}${text}${colors.reset}`,

  // Vote colors
  approve: (text: string) => `${colors.green}${text}${colors.reset}`,
  reject: (text: string) => `${colors.red}${text}${colors.reset}`,
  revise: (text: string) => `${colors.yellow}${text}${colors.reset}`,
};

// Phase colors
const phaseColors: Record<WorkflowPhase, string> = {
  analysis: colors.cyan,
  planning: colors.blue,
  review: colors.yellow,
  consensus: colors.magenta,
  arbitration: colors.red,
  implementation: colors.green,
  complete: colors.green,
};

export function colorPhase(phase: WorkflowPhase): string {
  return `${phaseColors[phase]}${phase}${colors.reset}`;
}

export function phaseIcon(phase: WorkflowPhase): string {
  return symbols.phases[phase] || '•';
}

/**
 * Spinner for showing activity
 */
export class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private message: string;
  private stream: NodeJS.WriteStream;

  constructor(message: string = '', stream: NodeJS.WriteStream = process.stderr) {
    this.message = message;
    this.stream = stream;
  }

  start(message?: string): void {
    if (message) this.message = message;
    if (this.interval) return;

    this.frameIndex = 0;
    this.interval = setInterval(() => {
      const frame = symbols.spinner[this.frameIndex];
      this.stream.write(`\r${colors.cyan}${frame}${colors.reset} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % symbols.spinner.length;
    }, 80);
  }

  update(message: string): void {
    this.message = message;
  }

  stop(finalMessage?: string, success: boolean = true): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    const icon = success ? `${colors.green}${symbols.check}${colors.reset}` : `${colors.red}${symbols.cross}${colors.reset}`;
    const msg = finalMessage || this.message;
    this.stream.write(`\r${icon} ${msg}\n`);
  }

  fail(message?: string): void {
    this.stop(message, false);
  }
}

/**
 * Progress bar for showing completion percentage
 */
export class ProgressBar {
  private width: number;
  private current: number = 0;
  private total: number;
  private label: string;
  private stream: NodeJS.WriteStream;

  constructor(
    total: number = 100,
    width: number = 30,
    label: string = '',
    stream: NodeJS.WriteStream = process.stderr
  ) {
    this.total = total;
    this.width = width;
    this.label = label;
    this.stream = stream;
  }

  update(current: number, label?: string): void {
    this.current = Math.min(current, this.total);
    if (label) this.label = label;
    this.render();
  }

  increment(amount: number = 1, label?: string): void {
    this.update(this.current + amount, label);
  }

  private render(): void {
    const percentage = Math.round((this.current / this.total) * 100);
    const filledWidth = Math.round((this.current / this.total) * this.width);
    const emptyWidth = this.width - filledWidth;

    const filled = symbols.progress.filled.repeat(filledWidth);
    const empty = symbols.progress.empty.repeat(emptyWidth);

    const bar = `${colors.green}${filled}${colors.gray}${empty}${colors.reset}`;
    const percentStr = `${percentage}%`.padStart(4);

    this.stream.write(`\r${bar} ${percentStr} ${this.label}`);
  }

  complete(label?: string): void {
    this.update(this.total, label);
    this.stream.write('\n');
  }
}

/**
 * Workflow progress display
 */
export class WorkflowProgress {
  private phases: WorkflowPhase[] = ['analysis', 'planning', 'review', 'consensus', 'implementation', 'complete'];
  private currentPhase: WorkflowPhase = 'analysis';
  private spinner: Spinner;
  private stream: NodeJS.WriteStream;
  private verbose: boolean;

  constructor(verbose: boolean = true, stream: NodeJS.WriteStream = process.stderr) {
    this.verbose = verbose;
    this.stream = stream;
    this.spinner = new Spinner('', stream);
  }

  /**
   * Display the phase progress header
   */
  showPhaseHeader(): void {
    if (!this.verbose) return;

    const header = this.phases.map((phase, index) => {
      const icon = phaseIcon(phase);
      const isComplete = this.phases.indexOf(this.currentPhase) > index;
      const isCurrent = phase === this.currentPhase;

      if (isComplete) {
        return `${colors.green}${icon}${colors.reset}`;
      } else if (isCurrent) {
        return `${colors.cyan}${icon}${colors.reset}`;
      } else {
        return `${colors.gray}${icon}${colors.reset}`;
      }
    }).join(' → ');

    this.stream.write(`\n${header}\n\n`);
  }

  /**
   * Start a phase
   */
  startPhase(phase: WorkflowPhase, description: string): void {
    this.currentPhase = phase;
    if (this.verbose) {
      this.spinner.start(`${phaseIcon(phase)} ${colorPhase(phase)}: ${description}`);
    }
  }

  /**
   * Complete a phase
   */
  completePhase(phase: WorkflowPhase, result?: string): void {
    if (this.verbose) {
      this.spinner.stop(`${phaseIcon(phase)} ${colorPhase(phase)}: ${result || 'Complete'}`);
    }
  }

  /**
   * Fail a phase
   */
  failPhase(phase: WorkflowPhase, error: string): void {
    if (this.verbose) {
      this.spinner.fail(`${phaseIcon(phase)} ${colorPhase(phase)}: ${error}`);
    }
  }

  /**
   * Show a status message
   */
  status(message: string): void {
    if (this.verbose) {
      this.stream.write(`  ${colors.gray}${symbols.arrow}${colors.reset} ${message}\n`);
    }
  }

  /**
   * Show agent activity
   */
  agentActivity(agent: string, action: string): void {
    if (this.verbose) {
      this.stream.write(`  ${colors.blue}${symbols.bullet}${colors.reset} ${color.bold(agent)}: ${action}\n`);
    }
  }

  /**
   * Show vote result
   */
  showVote(agent: string, vote: 'APPROVE' | 'REJECT' | 'REVISE'): void {
    if (!this.verbose) return;

    let voteColor: (text: string) => string;
    let icon: string;

    switch (vote) {
      case 'APPROVE':
        voteColor = color.approve;
        icon = symbols.check;
        break;
      case 'REJECT':
        voteColor = color.reject;
        icon = symbols.cross;
        break;
      case 'REVISE':
        voteColor = color.revise;
        icon = symbols.warning;
        break;
    }

    this.stream.write(`  ${voteColor(icon)} ${agent}: ${voteColor(vote)}\n`);
  }

  /**
   * Show consensus result
   */
  showConsensus(reached: boolean, outcome: string, mode: string): void {
    if (!this.verbose) return;

    const icon = reached ? symbols.check : symbols.warning;
    const col = reached ? color.success : color.warn;

    this.stream.write(`\n  ${col(icon)} Consensus (${mode}): ${col(outcome)}\n`);
  }

  /**
   * Show expertise match
   */
  showExpertise(expertise: string, score: number, focus: string): void {
    if (!this.verbose) return;

    this.stream.write(`  ${color.cyan(symbols.info)} Expertise: ${color.bold(expertise)} (score: ${score})\n`);
    this.stream.write(`    ${color.dim(focus)}\n`);
  }

  /**
   * Show workflow complete
   */
  showComplete(status: string, proposalId?: string): void {
    if (!this.verbose) return;

    const isSuccess = status === 'approved' || status === 'implemented';
    const icon = isSuccess ? symbols.check : symbols.cross;
    const col = isSuccess ? color.success : color.error;

    this.stream.write(`\n${col(`${icon} Workflow ${status}`)}`);
    if (proposalId) {
      this.stream.write(` ${color.dim(`(${proposalId})`)}`);
    }
    this.stream.write('\n');
  }
}

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Create a box around text
 */
export function box(text: string, title?: string): string {
  const lines = text.split('\n');
  const maxWidth = Math.max(...lines.map(l => l.length), title?.length || 0);
  const width = maxWidth + 4;

  const top = title
    ? `╭─ ${title} ${'─'.repeat(width - title.length - 5)}╮`
    : `╭${'─'.repeat(width - 2)}╮`;
  const bottom = `╰${'─'.repeat(width - 2)}╯`;

  const content = lines.map(line => `│ ${line.padEnd(maxWidth + 1)}│`).join('\n');

  return `${top}\n${content}\n${bottom}`;
}

/**
 * Create a simple table
 */
export function table(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxRowWidth = Math.max(...rows.map(r => (r[i] || '').length));
    return Math.max(h.length, maxRowWidth);
  });

  const separator = colWidths.map(w => '─'.repeat(w + 2)).join('┼');
  const headerRow = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('│');
  const dataRows = rows.map(row =>
    row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('│')
  );

  return [
    `┌${separator.replace(/┼/g, '┬')}┐`,
    `│${headerRow}│`,
    `├${separator}┤`,
    ...dataRows.map(r => `│${r}│`),
    `└${separator.replace(/┼/g, '┴')}┘`
  ].join('\n');
}

export { symbols, colors };
