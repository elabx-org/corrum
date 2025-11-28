/**
 * Agent Executor
 *
 * Executes AI CLI tools (claude, codex, gemini) and captures their output.
 * Provides streaming output support for real-time feedback.
 */

import { spawn, type ChildProcess } from 'child_process';
import { loadConfig } from '../config/index.js';
import type { AgentName, ModelConfig } from '../types/index.js';

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number | null;
  duration: number;
}

export interface ExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  /** Fast mode: skip loading project context (CLAUDE.md, etc.) for faster responses */
  fast?: boolean;
}

/**
 * Get the CLI command and flags for a model
 */
export function getModelCommand(modelName: AgentName): { cli: string; headlessFlag: string; extraFlags: string[] } {
  const config = loadConfig();

  // Check models config first
  const modelConfig = config.models?.[modelName] as ModelConfig | undefined;
  if (modelConfig) {
    return {
      cli: modelConfig.cli,
      headlessFlag: modelConfig.headlessFlag,
      extraFlags: (modelConfig as any).extraFlags || [],
    };
  }

  // Fall back to agents config (legacy)
  const agentConfig = config.agents?.[modelName];
  if (agentConfig) {
    return {
      cli: agentConfig.cli,
      headlessFlag: agentConfig.headlessFlag,
      extraFlags: (agentConfig as any).extraFlags || [],
    };
  }

  // Default configurations
  // For claude: use -p (print) mode with permission bypass for headless operation
  // For codex: use exec mode with sandbox bypass and no approvals for headless operation
  // See: https://developers.openai.com/codex/cli/reference/
  const defaults: Record<string, { cli: string; headlessFlag: string; extraFlags: string[] }> = {
    claude: {
      cli: 'claude',
      headlessFlag: '-p',
      // Bypass permissions for automated execution in sandboxed environments
      // --dangerously-skip-permissions: bypass all permission checks
      // Note: Don't use --tools "" as it's a variadic flag that consumes the prompt
      extraFlags: ['--dangerously-skip-permissions']
    },
    codex: {
      cli: 'codex',
      headlessFlag: 'exec',
      // Bypass sandbox and approvals for automated execution
      // Use --quiet to suppress interactive UI elements
      extraFlags: ['--dangerously-auto-approve', '--sandbox', 'none', '--quiet']
    },
    gemini: { cli: 'gemini', headlessFlag: '', extraFlags: [] },
  };

  return defaults[modelName] || { cli: modelName, headlessFlag: '', extraFlags: [] };
}

/**
 * Build the command arguments for executing an agent
 * @param modelName - The agent model name
 * @param prompt - The prompt to send
 * @param options - Build options
 * @param options.fast - Skip loading project context (CLAUDE.md, etc.) for faster responses
 */
export function buildAgentCommand(
  modelName: AgentName,
  prompt: string,
  options: { fast?: boolean } = {}
): { command: string; args: string[] } {
  const { cli, headlessFlag, extraFlags } = getModelCommand(modelName);
  const { fast = false } = options;

  let args: string[];

  switch (modelName) {
    case 'claude':
      // claude -p --dangerously-skip-permissions [--setting-sources ""] "prompt"
      // The -p flag goes first, then extra flags, then the prompt
      args = [];
      if (headlessFlag) args.push(headlessFlag);
      args.push(...extraFlags);
      // Fast mode: skip loading project context (CLAUDE.md, etc.)
      if (fast) {
        args.push('--setting-sources', '');
      }
      args.push(prompt);
      break;

    case 'codex':
      // codex exec --dangerously-auto-approve --sandbox none --quiet "prompt"
      // The exec subcommand goes first, then flags, then the prompt
      args = [];
      if (headlessFlag) args.push(headlessFlag);
      args.push(...extraFlags);
      args.push(prompt);
      break;

    case 'gemini':
      // gemini "prompt" (or with stdin)
      args = headlessFlag ? [headlessFlag, prompt, ...extraFlags] : [prompt, ...extraFlags];
      break;

    default:
      // Generic: cli [headlessFlag] [extraFlags] "prompt"
      args = [];
      if (headlessFlag) args.push(headlessFlag);
      args.push(...extraFlags);
      args.push(prompt);
  }

  return { command: cli, args };
}

/**
 * Execute an agent with the given prompt
 */
export async function executeAgent(
  modelName: AgentName,
  prompt: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const { command, args } = buildAgentCommand(modelName, prompt, { fast: options.fast });
  const startTime = Date.now();

  return new Promise((resolve) => {
    const {
      timeout = 600000, // 10 minutes default - Claude CLI needs time for complex prompts
      cwd = process.cwd(),
      env = {},
      onStdout,
      onStderr,
    } = options;

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc: ChildProcess = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    // Capture stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      if (onStdout) onStdout(chunk);
    });

    // Capture stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      if (onStderr) onStderr(chunk);
    });

    // Handle completion
    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (timedOut) {
        resolve({
          success: false,
          output: stdout,
          error: `Execution timed out after ${timeout}ms`,
          exitCode: null,
          duration,
        });
      } else {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || undefined,
          exitCode: code,
          duration,
        });
      }
    });

    // Handle errors
    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      resolve({
        success: false,
        output: stdout,
        error: `Failed to execute ${command}: ${err.message}`,
        exitCode: null,
        duration,
      });
    });
  });
}

/**
 * Check if an agent CLI is available
 */
export async function checkAgentAvailable(modelName: AgentName): Promise<boolean> {
  const { command } = buildAgentCommand(modelName, '');

  return new Promise((resolve) => {
    const proc = spawn('which', [command], { stdio: ['pipe', 'pipe', 'pipe'] });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get available agents
 */
export async function getAvailableAgents(): Promise<AgentName[]> {
  const agents: AgentName[] = ['claude', 'codex', 'gemini'];
  const available: AgentName[] = [];

  for (const agent of agents) {
    if (await checkAgentAvailable(agent)) {
      available.push(agent);
    }
  }

  return available;
}

/**
 * Agent executor class for managing multiple agent executions
 */
export class AgentExecutor {
  private timeout: number;
  private cwd: string;
  private env: Record<string, string>;
  private fast: boolean;

  constructor(options: {
    timeout?: number;
    cwd?: string;
    env?: Record<string, string>;
    /** Fast mode: skip loading project context for faster responses */
    fast?: boolean;
  } = {}) {
    this.timeout = options.timeout || 600000;
    this.cwd = options.cwd || process.cwd();
    this.env = options.env || {};
    this.fast = options.fast || false;
  }

  /**
   * Execute a single agent
   */
  async execute(
    modelName: AgentName,
    prompt: string,
    callbacks?: {
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    }
  ): Promise<ExecutionResult> {
    return executeAgent(modelName, prompt, {
      timeout: this.timeout,
      cwd: this.cwd,
      env: this.env,
      fast: this.fast,
      onStdout: callbacks?.onStdout,
      onStderr: callbacks?.onStderr,
    });
  }

  /**
   * Execute multiple agents in parallel
   */
  async executeParallel(
    executions: Array<{
      modelName: AgentName;
      prompt: string;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    }>
  ): Promise<ExecutionResult[]> {
    return Promise.all(
      executions.map((exec) =>
        this.execute(exec.modelName, exec.prompt, {
          onStdout: exec.onStdout,
          onStderr: exec.onStderr,
        })
      )
    );
  }

  /**
   * Execute agents sequentially
   */
  async executeSequential(
    executions: Array<{
      modelName: AgentName;
      prompt: string;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    }>
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const exec of executions) {
      const result = await this.execute(exec.modelName, exec.prompt, {
        onStdout: exec.onStdout,
        onStderr: exec.onStderr,
      });
      results.push(result);

      // Stop on failure if needed
      if (!result.success) {
        break;
      }
    }

    return results;
  }
}
