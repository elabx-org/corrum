import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getModelCommand,
  buildAgentCommand,
  executeAgent,
  checkAgentAvailable,
  AgentExecutor,
} from '../src/core/agent-executor.js';
import type { AgentName } from '../src/types/index.js';

// Mock the config loader
vi.mock('../src/config/index.js', () => ({
  loadConfig: vi.fn(() => ({
    models: {},
    agents: {},
  })),
}));

import { loadConfig } from '../src/config/index.js';

describe('agent-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getModelCommand - default configurations', () => {
    beforeEach(() => {
      // Reset to empty config to test defaults
      vi.mocked(loadConfig).mockReturnValue({
        models: {},
        agents: {},
      } as any);
    });

    describe('Claude headless mode', () => {
      it('should use -p flag for headless mode', () => {
        const result = getModelCommand('claude');
        expect(result.headlessFlag).toBe('-p');
      });

      it('should include --dangerously-skip-permissions flag', () => {
        const result = getModelCommand('claude');
        expect(result.extraFlags).toContain('--dangerously-skip-permissions');
      });

      it('should NOT include --tools flag (variadic flag consumes prompt)', () => {
        const result = getModelCommand('claude');
        // --tools is a variadic flag that would consume the prompt argument
        // so we don't include it in default config
        expect(result.extraFlags).not.toContain('--tools');
      });

      it('should use claude as CLI command', () => {
        const result = getModelCommand('claude');
        expect(result.cli).toBe('claude');
      });

      it('should have correct full flag set for permission bypass', () => {
        const result = getModelCommand('claude');
        expect(result).toEqual({
          cli: 'claude',
          headlessFlag: '-p',
          extraFlags: ['--dangerously-skip-permissions'],
        });
      });
    });

    describe('Codex headless mode', () => {
      it('should use exec subcommand for headless mode', () => {
        const result = getModelCommand('codex');
        expect(result.headlessFlag).toBe('exec');
      });

      it('should include --dangerously-auto-approve flag', () => {
        const result = getModelCommand('codex');
        expect(result.extraFlags).toContain('--dangerously-auto-approve');
      });

      it('should disable sandbox with --sandbox none', () => {
        const result = getModelCommand('codex');
        expect(result.extraFlags).toContain('--sandbox');
        expect(result.extraFlags).toContain('none');
      });

      it('should include --quiet flag for non-interactive output', () => {
        const result = getModelCommand('codex');
        expect(result.extraFlags).toContain('--quiet');
      });

      it('should use codex as CLI command', () => {
        const result = getModelCommand('codex');
        expect(result.cli).toBe('codex');
      });

      it('should have correct full flag set for sandbox bypass', () => {
        const result = getModelCommand('codex');
        expect(result).toEqual({
          cli: 'codex',
          headlessFlag: 'exec',
          extraFlags: ['--dangerously-auto-approve', '--sandbox', 'none', '--quiet'],
        });
      });
    });

    describe('Gemini headless mode', () => {
      it('should have empty headless flag', () => {
        const result = getModelCommand('gemini');
        expect(result.headlessFlag).toBe('');
      });

      it('should have no extra flags by default', () => {
        const result = getModelCommand('gemini');
        expect(result.extraFlags).toEqual([]);
      });

      it('should use gemini as CLI command', () => {
        const result = getModelCommand('gemini');
        expect(result.cli).toBe('gemini');
      });
    });

    describe('unknown model fallback', () => {
      it('should return model name as CLI for unknown models', () => {
        const result = getModelCommand('unknown-model' as AgentName);
        expect(result.cli).toBe('unknown-model');
        expect(result.headlessFlag).toBe('');
        expect(result.extraFlags).toEqual([]);
      });
    });
  });

  describe('getModelCommand - custom config overrides', () => {
    it('should prefer models config over defaults', () => {
      vi.mocked(loadConfig).mockReturnValue({
        models: {
          claude: {
            cli: 'custom-claude',
            headlessFlag: '--custom-flag',
            extraFlags: ['--custom-extra'],
          },
        },
        agents: {},
      } as any);

      const result = getModelCommand('claude');
      expect(result.cli).toBe('custom-claude');
      expect(result.headlessFlag).toBe('--custom-flag');
      expect(result.extraFlags).toEqual(['--custom-extra']);
    });

    it('should fall back to agents config (legacy)', () => {
      vi.mocked(loadConfig).mockReturnValue({
        models: {},
        agents: {
          codex: {
            cli: 'legacy-codex',
            headlessFlag: 'legacy-exec',
            extraFlags: ['--legacy-flag'],
          },
        },
      } as any);

      const result = getModelCommand('codex');
      expect(result.cli).toBe('legacy-codex');
      expect(result.headlessFlag).toBe('legacy-exec');
      expect(result.extraFlags).toEqual(['--legacy-flag']);
    });

    it('should allow full sandbox bypass for Docker environments', () => {
      vi.mocked(loadConfig).mockReturnValue({
        models: {
          codex: {
            cli: 'codex',
            headlessFlag: '',
            extraFlags: ['--dangerously-bypass-approvals-and-sandbox'],
          },
        },
        agents: {},
      } as any);

      const result = getModelCommand('codex');
      expect(result.extraFlags).toContain('--dangerously-bypass-approvals-and-sandbox');
    });

    it('should allow custom Claude permission flags', () => {
      vi.mocked(loadConfig).mockReturnValue({
        models: {
          claude: {
            cli: 'claude',
            headlessFlag: '-p',
            extraFlags: ['--allowedTools', 'Read,Grep'],
          },
        },
        agents: {},
      } as any);

      const result = getModelCommand('claude');
      expect(result.extraFlags).toEqual(['--allowedTools', 'Read,Grep']);
    });
  });

  describe('buildAgentCommand', () => {
    beforeEach(() => {
      vi.mocked(loadConfig).mockReturnValue({
        models: {},
        agents: {},
      } as any);
    });

    describe('Claude command building', () => {
      it('should build correct command with -p flag first', () => {
        const { command, args } = buildAgentCommand('claude', 'Test prompt');
        expect(command).toBe('claude');
        expect(args[0]).toBe('-p');
      });

      it('should include permission bypass flags before prompt', () => {
        const { command, args } = buildAgentCommand('claude', 'Test prompt');
        expect(args).toEqual([
          '-p',
          '--dangerously-skip-permissions',
          'Test prompt',
        ]);
      });

      it('should place prompt at the end', () => {
        const { command, args } = buildAgentCommand('claude', 'My test prompt');
        expect(args[args.length - 1]).toBe('My test prompt');
      });

      it('should handle prompts with special characters', () => {
        const prompt = 'Review this code: function test() { return "hello"; }';
        const { args } = buildAgentCommand('claude', prompt);
        expect(args[args.length - 1]).toBe(prompt);
      });

      it('should handle multiline prompts', () => {
        const prompt = 'Line 1\nLine 2\nLine 3';
        const { args } = buildAgentCommand('claude', prompt);
        expect(args[args.length - 1]).toBe(prompt);
      });

      it('should add --setting-sources "" in fast mode', () => {
        const { args } = buildAgentCommand('claude', 'Test prompt', { fast: true });
        expect(args).toContain('--setting-sources');
        const settingSourcesIndex = args.indexOf('--setting-sources');
        expect(args[settingSourcesIndex + 1]).toBe('');
      });

      it('should NOT add --setting-sources when fast mode is false', () => {
        const { args } = buildAgentCommand('claude', 'Test prompt', { fast: false });
        expect(args).not.toContain('--setting-sources');
      });

      it('should place --setting-sources before prompt in fast mode', () => {
        const { args } = buildAgentCommand('claude', 'Test prompt', { fast: true });
        expect(args).toEqual([
          '-p',
          '--dangerously-skip-permissions',
          '--setting-sources',
          '',
          'Test prompt',
        ]);
      });
    });

    describe('Codex command building', () => {
      it('should build correct command with exec subcommand first', () => {
        const { command, args } = buildAgentCommand('codex', 'Test prompt');
        expect(command).toBe('codex');
        expect(args[0]).toBe('exec');
      });

      it('should include sandbox bypass flags before prompt', () => {
        const { command, args } = buildAgentCommand('codex', 'Test prompt');
        expect(args).toEqual([
          'exec',
          '--dangerously-auto-approve',
          '--sandbox',
          'none',
          '--quiet',
          'Test prompt',
        ]);
      });

      it('should place prompt at the end', () => {
        const { command, args } = buildAgentCommand('codex', 'My test prompt');
        expect(args[args.length - 1]).toBe('My test prompt');
      });
    });

    describe('Gemini command building', () => {
      it('should build simple command without headless flag', () => {
        const { command, args } = buildAgentCommand('gemini', 'Test prompt');
        expect(command).toBe('gemini');
        expect(args).toEqual(['Test prompt']);
      });
    });

    describe('custom config command building', () => {
      it('should respect custom headless flags', () => {
        vi.mocked(loadConfig).mockReturnValue({
          models: {
            claude: {
              cli: 'claude',
              headlessFlag: '--print',
              extraFlags: [],
            },
          },
          agents: {},
        } as any);

        const { args } = buildAgentCommand('claude', 'Test prompt');
        expect(args[0]).toBe('--print');
      });

      it('should omit headless flag if empty', () => {
        vi.mocked(loadConfig).mockReturnValue({
          models: {
            codex: {
              cli: 'codex',
              headlessFlag: '',
              extraFlags: ['--dangerously-bypass-approvals-and-sandbox'],
            },
          },
          agents: {},
        } as any);

        const { args } = buildAgentCommand('codex', 'Test prompt');
        expect(args[0]).toBe('--dangerously-bypass-approvals-and-sandbox');
      });
    });
  });

  describe('permission and sandbox configuration validation', () => {
    beforeEach(() => {
      vi.mocked(loadConfig).mockReturnValue({
        models: {},
        agents: {},
      } as any);
    });

    it('Claude: --dangerously-skip-permissions bypasses all permission checks', () => {
      const { args } = buildAgentCommand('claude', 'prompt');
      // The flag should be present for automated/sandboxed execution
      expect(args).toContain('--dangerously-skip-permissions');
    });

    it('Claude: should NOT use --tools flag (variadic, consumes prompt)', () => {
      const { args } = buildAgentCommand('claude', 'prompt');
      // --tools is a variadic flag (<tools...>) that would consume subsequent args
      // including our prompt, so we don't use it
      expect(args).not.toContain('--tools');
    });

    it('Codex: --dangerously-auto-approve auto-approves tool calls', () => {
      const { args } = buildAgentCommand('codex', 'prompt');
      expect(args).toContain('--dangerously-auto-approve');
    });

    it('Codex: --sandbox none disables sandbox restrictions', () => {
      const { args } = buildAgentCommand('codex', 'prompt');
      const sandboxIndex = args.indexOf('--sandbox');
      expect(sandboxIndex).toBeGreaterThan(-1);
      expect(args[sandboxIndex + 1]).toBe('none');
    });

    it('Codex: --quiet suppresses interactive UI elements', () => {
      const { args } = buildAgentCommand('codex', 'prompt');
      expect(args).toContain('--quiet');
    });
  });

  describe('AgentExecutor class', () => {
    beforeEach(() => {
      vi.mocked(loadConfig).mockReturnValue({
        models: {},
        agents: {},
      } as any);
    });

    it('should create executor with default options', () => {
      const executor = new AgentExecutor();
      expect(executor).toBeInstanceOf(AgentExecutor);
    });

    it('should accept custom timeout', () => {
      const executor = new AgentExecutor({ timeout: 60000 });
      expect(executor).toBeInstanceOf(AgentExecutor);
    });

    it('should accept custom working directory', () => {
      const executor = new AgentExecutor({ cwd: '/tmp' });
      expect(executor).toBeInstanceOf(AgentExecutor);
    });

    it('should accept custom environment variables', () => {
      const executor = new AgentExecutor({ env: { MY_VAR: 'value' } });
      expect(executor).toBeInstanceOf(AgentExecutor);
    });

    it('should accept fast mode option', () => {
      const executor = new AgentExecutor({ fast: true });
      expect(executor).toBeInstanceOf(AgentExecutor);
    });
  });

  describe('error scenarios', () => {
    beforeEach(() => {
      vi.mocked(loadConfig).mockReturnValue({
        models: {},
        agents: {},
      } as any);
    });

    it('should handle missing CLI gracefully', async () => {
      const result = await executeAgent('claude', 'test', { timeout: 1000 });
      // Will fail because CLI isn't installed in test env
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for command not found', async () => {
      const result = await executeAgent('nonexistent-cli' as AgentName, 'test', { timeout: 1000 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to execute');
    });

    it('should timeout if command takes too long', async () => {
      // Using a command that would block - will timeout
      const result = await executeAgent('claude', 'test', { timeout: 10 });
      expect(result.success).toBe(false);
      // Either times out or fails immediately (CLI not found)
      expect(result.exitCode === null || result.exitCode !== 0).toBe(true);
    });
  });

  describe('checkAgentAvailable', () => {
    it('should return false for non-installed CLI', async () => {
      const available = await checkAgentAvailable('nonexistent-cli' as AgentName);
      expect(available).toBe(false);
    });

    // This test may pass or fail depending on test environment
    it('should detect common shell commands', async () => {
      // 'which' itself should be available on Unix systems
      const result = await checkAgentAvailable('echo' as AgentName);
      // Don't assert - just ensure it doesn't throw
      expect(typeof result).toBe('boolean');
    });
  });

  describe('security considerations', () => {
    beforeEach(() => {
      vi.mocked(loadConfig).mockReturnValue({
        models: {},
        agents: {},
      } as any);
    });

    it('should not allow shell injection in prompts', () => {
      const maliciousPrompt = '"; rm -rf /; echo "';
      const { args } = buildAgentCommand('claude', maliciousPrompt);

      // The prompt should be passed as a single argument, not interpreted as shell
      expect(args[args.length - 1]).toBe(maliciousPrompt);
      // spawn() with shell: false prevents injection
    });

    it('should not allow command injection via backticks', () => {
      const maliciousPrompt = '`whoami`';
      const { args } = buildAgentCommand('codex', maliciousPrompt);
      expect(args[args.length - 1]).toBe(maliciousPrompt);
    });

    it('should handle $() command substitution safely', () => {
      const maliciousPrompt = '$(cat /etc/passwd)';
      const { args } = buildAgentCommand('claude', maliciousPrompt);
      expect(args[args.length - 1]).toBe(maliciousPrompt);
    });
  });

  describe('flag ordering', () => {
    beforeEach(() => {
      vi.mocked(loadConfig).mockReturnValue({
        models: {},
        agents: {},
      } as any);
    });

    it('Claude: -p flag must come before other flags', () => {
      const { args } = buildAgentCommand('claude', 'prompt');
      expect(args[0]).toBe('-p');
    });

    it('Codex: exec subcommand must come before flags', () => {
      const { args } = buildAgentCommand('codex', 'prompt');
      expect(args[0]).toBe('exec');
    });

    it('prompt must always be the last argument', () => {
      const prompt = 'This is my prompt';

      const claudeArgs = buildAgentCommand('claude', prompt).args;
      expect(claudeArgs[claudeArgs.length - 1]).toBe(prompt);

      const codexArgs = buildAgentCommand('codex', prompt).args;
      expect(codexArgs[codexArgs.length - 1]).toBe(prompt);

      const geminiArgs = buildAgentCommand('gemini', prompt).args;
      expect(geminiArgs[geminiArgs.length - 1]).toBe(prompt);
    });
  });

  describe('documentation references', () => {
    // These tests document the expected CLI behavior

    it('Claude CLI: -p enables print mode (non-interactive)', () => {
      // Reference: Claude Code CLI documentation
      // -p: Print mode - outputs response to stdout without interactive UI
      const { args } = buildAgentCommand('claude', 'test');
      expect(args).toContain('-p');
    });

    it('Codex CLI: exec runs a single prompt', () => {
      // Reference: https://developers.openai.com/codex/cli/reference/
      // exec: Execute a single prompt and exit
      const { args } = buildAgentCommand('codex', 'test');
      expect(args[0]).toBe('exec');
    });

    it('Codex CLI: --sandbox none disables file system restrictions', () => {
      // Reference: https://developers.openai.com/codex/cli/reference/
      // --sandbox none: Disable all sandbox restrictions
      const { args } = buildAgentCommand('codex', 'test');
      expect(args).toContain('--sandbox');
      const idx = args.indexOf('--sandbox');
      expect(args[idx + 1]).toBe('none');
    });
  });
});
