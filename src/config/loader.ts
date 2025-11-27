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
# Multi-Agent Code Review Orchestrator
# Docs: https://github.com/elabx-org/corrum

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
# ROLES - Which models handle each role
# Note: Expertise focus is determined automatically by task analysis
# ─────────────────────────────────────────────────────────────

[roles]
default_planner = "claude"      # Creates proposals
default_reviewers = ["codex"]   # Reviews proposals (can add more)
arbiter_strategy = "round-robin"
arbiters = ["gemini", "claude"] # Resolves disputes

# ─────────────────────────────────────────────────────────────
# RULES - Workflow rules
# ─────────────────────────────────────────────────────────────

[rules]
max_iterations = 2
# Consensus mode: "majority" or "unanimous"
# Can also be detected from natural language in task:
#   "all agree", "unanimous" → unanimous
#   "majority wins" → majority
consensus_mode = "majority"
auto_skip_trivial = true
trivial_patterns = [
  "typo", "typos",
  "comment", "comments",
  "readme", "documentation",
  "formatting", "style"
]

# ─────────────────────────────────────────────────────────────
# EXPERTISE PROFILES - Domain-specific focus areas
# These are model-agnostic - they define WHAT to focus on
# The matched expertise's promptFocus is injected into agents
# ─────────────────────────────────────────────────────────────

[expertise.security]
name = "security"
description = "Security specialist for auth, crypto, and vulnerability review"
keywords = ["auth", "authentication", "authorization", "password", "token", "jwt", "session", "security", "encrypt", "decrypt", "hash", "vulnerability", "injection", "xss", "csrf", "owasp"]
file_patterns = ["**/auth/**", "**/security/**", "**/middleware/auth*"]
prompt_focus = "Focus on: authentication bypass, injection vulnerabilities, data exposure, session management, crypto weaknesses, OWASP top 10"

[expertise.database]
name = "database"
description = "Database specialist for data integrity and performance"
keywords = ["sql", "database", "migration", "schema", "index", "transaction", "query", "orm", "model"]
file_patterns = ["**/*.sql", "**/migrations/**", "**/models/**", "alembic/versions/**"]
prompt_focus = "Focus on: data integrity, transaction safety, index usage, N+1 queries, migration rollback safety, schema design"

[expertise.api]
name = "api"
description = "API design specialist for contracts and compatibility"
keywords = ["api", "endpoint", "rest", "graphql", "route", "router", "controller", "versioning"]
file_patterns = ["**/routers/**", "**/routes/**", "**/controllers/**", "**/api/**"]
prompt_focus = "Focus on: backwards compatibility, API versioning, error handling, input validation, rate limiting, documentation"

[expertise.performance]
name = "performance"
description = "Performance specialist for optimization and scaling"
keywords = ["performance", "cache", "caching", "optimize", "latency", "memory", "scaling", "rate limit", "throttle"]
file_patterns = ["**/cache/**", "**/workers/**", "**/queues/**"]
prompt_focus = "Focus on: caching strategies, memory leaks, algorithmic complexity, database query optimization, async patterns"

[expertise.frontend]
name = "frontend"
description = "Frontend specialist for UI/UX and accessibility"
keywords = ["react", "vue", "angular", "component", "ui", "ux", "accessibility", "a11y", "responsive", "css"]
file_patterns = ["**/components/**", "**/*.tsx", "**/*.jsx", "**/*.vue", "**/styles/**"]
prompt_focus = "Focus on: accessibility (WCAG), responsive design, state management, component reusability, user experience"

[expertise.payments]
name = "payments"
description = "Payments specialist for financial transactions"
keywords = ["payment", "billing", "subscription", "stripe", "invoice", "transaction", "refund", "checkout"]
file_patterns = ["**/payments/**", "**/billing/**", "**/checkout/**"]
prompt_focus = "Focus on: PCI compliance, idempotency, error recovery, audit trails, financial accuracy, fraud prevention"

[expertise.general]
name = "general"
description = "General code review for overall quality"
keywords = []
file_patterns = []
prompt_focus = "Focus on: code quality, maintainability, testing, error handling, documentation, best practices"

# ─────────────────────────────────────────────────────────────
# MODELS - AI CLI tool configuration
# ─────────────────────────────────────────────────────────────

[models.claude]
cli = "claude"
headless_flag = "-p"
model_family = "anthropic"

[models.codex]
cli = "codex"
headless_flag = "exec"
model_family = "openai"

[models.gemini]
cli = "gemini"
headless_flag = ""
model_family = "google"

# ─────────────────────────────────────────────────────────────
# AGENT PROFILES - Model + role combinations
# These are model-based, not expertise-based
# Expertise focus is injected dynamically based on task analysis
# ─────────────────────────────────────────────────────────────

[agent_profiles.claude-reviewer]
name = "claude-reviewer"
model = "claude"
expertise = "general"
description = "Claude-based reviewer (Anthropic)"

[agent_profiles.codex-reviewer]
name = "codex-reviewer"
model = "codex"
expertise = "general"
description = "Codex-based reviewer (OpenAI)"

[agent_profiles.gemini-reviewer]
name = "gemini-reviewer"
model = "gemini"
expertise = "general"
description = "Gemini-based reviewer (Google)"

[agent_profiles.arbiter]
name = "arbiter"
model = "gemini"
expertise = "general"
description = "Arbiter for resolving disputes"

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
# STORAGE - State persistence
# ─────────────────────────────────────────────────────────────

[storage]
backend = "sqlite"
state_file = ".corrum.db"

# ─────────────────────────────────────────────────────────────
# LEGACY - Agents config (kept for backwards compatibility)
# Use [models] section above for new configurations
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
`;
}
