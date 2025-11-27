import { readFileSync, existsSync } from 'fs';
import { parse as parseToml } from '@iarna/toml';
import { configSchema, type RawConfig } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type { CorrumConfig } from '../types/index.js';

export const CONFIG_FILENAME = '.corrum-config.toml';

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(target[key], source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
  }
  return result;
}

export function loadConfig(configPath?: string): CorrumConfig {
  const path = configPath ?? CONFIG_FILENAME;

  if (!existsSync(path)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const raw = parseToml(content) as RawConfig;
    const parsed = configSchema.parse(raw);

    // Deep merge with defaults
    return deepMerge(DEFAULT_CONFIG, {
      corrum: parsed.corrum ? {
        enabled: parsed.corrum.enabled ?? DEFAULT_CONFIG.corrum.enabled,
        version: parsed.corrum.version ?? DEFAULT_CONFIG.corrum.version
      } : undefined,
      triggers: parsed.triggers,
      roles: parsed.roles,
      rules: parsed.rules,
      paths: parsed.paths,
      templates: parsed.templates,
      agents: parsed.agents as any,
      storage: parsed.storage
    } as Partial<CorrumConfig>);
  } catch (error) {
    throw new Error(`Failed to load config from ${path}: ${error}`);
  }
}

export function generateDefaultConfig(): string {
  return `# Corrum Configuration
# Docs: https://github.com/your-org/corrum

[corrum]
enabled = true
version = "0.1.0"

# ─────────────────────────────────────────────────────────────
# TRIGGERS - When to automatically require Corrum review
# ─────────────────────────────────────────────────────────────

[triggers]
keywords = [
  "auth", "authentication", "authorization",
  "password", "token", "jwt", "session",
  "security", "encrypt", "decrypt", "hash",
  "sql", "database", "migration", "schema",
  "rate limit", "rate-limit", "throttle",
  "payment", "billing", "subscription",
  "api", "endpoint", "public",
  "delete", "remove", "drop"
]

file_patterns = [
  "**/auth/**",
  "**/routers/**",
  "**/models.py",
  "**/schemas.py",
  "alembic/versions/**",
  "**/middleware/**",
  "**/*.sql"
]

complexity_threshold = 7

# ─────────────────────────────────────────────────────────────
# ROLES - Agent assignment
# ─────────────────────────────────────────────────────────────

[roles]
default_planner = "claude"
default_reviewers = ["codex"]
arbiter_strategy = "round-robin"
arbiters = ["gemini", "claude"]

# ─────────────────────────────────────────────────────────────
# RULES - Workflow rules
# ─────────────────────────────────────────────────────────────

[rules]
max_iterations = 2
require_unanimous = false
auto_skip_trivial = true
trivial_patterns = [
  "typo", "typos",
  "comment", "comments",
  "readme", "documentation",
  "formatting", "style"
]

# ─────────────────────────────────────────────────────────────
# PATHS - File locations
# ─────────────────────────────────────────────────────────────

[paths]
base_dir = "docs/corrum"
proposals_dir = "proposals"
reviews_dir = "reviews"
decisions_dir = "decisions"
verifications_dir = "verifications"

# ─────────────────────────────────────────────────────────────
# TEMPLATES - Document templates
# ─────────────────────────────────────────────────────────────

[templates]
proposal = "templates/proposal.md"
review = "templates/review.md"
decision = "templates/decision.md"

# ─────────────────────────────────────────────────────────────
# AGENTS - AI CLI configuration
# ─────────────────────────────────────────────────────────────

[agents.claude]
cli = "claude"
headless_flag = "-p"
model_family = "anthropic"

[agents.codex]
cli = "codex"
headless_flag = "exec"
model_family = "openai"

[agents.gemini]
cli = "gemini"
headless_flag = ""
model_family = "google"

# ─────────────────────────────────────────────────────────────
# STORAGE - State persistence
# ─────────────────────────────────────────────────────────────

[storage]
backend = "sqlite"
state_file = ".corrum.db"
`;
}
