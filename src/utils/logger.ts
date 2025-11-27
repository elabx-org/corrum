import chalk from 'chalk';

export const logger = {
  success: (message: string) => console.log(chalk.green('✓'), message),
  error: (message: string) => console.error(chalk.red('✗'), message),
  warn: (message: string) => console.log(chalk.yellow('⚠'), message),
  info: (message: string) => console.log(chalk.blue('ℹ'), message),
  dim: (message: string) => console.log(chalk.dim(message)),

  json: (data: unknown) => console.log(JSON.stringify(data, null, 2)),

  table: (headers: string[], rows: string[][]) => {
    const colWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => (r[i] || '').length))
    );

    const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
    const separator = colWidths.map(w => '─'.repeat(w)).join('──');

    console.log(headerRow);
    console.log(separator);
    rows.forEach(row => {
      console.log(row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join('  '));
    });
  }
};
