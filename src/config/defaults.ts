import type { CorrumConfig, AgentName, ExpertiseProfile, AgentProfile, ModelConfig } from '../types/index.js';

export const DEFAULT_KEYWORDS = [
  'auth', 'authentication', 'authorization',
  'password', 'token', 'jwt', 'session',
  'security', 'encrypt', 'decrypt', 'hash',
  'sql', 'database', 'migration', 'schema',
  'rate limit', 'rate-limit', 'throttle',
  'payment', 'billing', 'subscription',
  'api', 'endpoint', 'public',
  'delete', 'remove', 'drop'
];

export const DEFAULT_FILE_PATTERNS = [
  '**/auth/**',
  '**/routers/**',
  '**/models.py',
  '**/schemas.py',
  'alembic/versions/**',
  '**/middleware/**',
  '**/*.sql'
];

export const DEFAULT_TRIVIAL_PATTERNS = [
  'typo', 'typos',
  'comment', 'comments',
  'readme', 'documentation',
  'formatting', 'style'
];

// Default expertise profiles
export const DEFAULT_EXPERTISE: Record<string, ExpertiseProfile> = {
  security: {
    name: 'security',
    description: 'Security specialist for auth, crypto, and vulnerability review',
    keywords: ['auth', 'authentication', 'authorization', 'password', 'token', 'jwt', 'session', 'security', 'encrypt', 'decrypt', 'hash', 'vulnerability', 'injection', 'xss', 'csrf', 'owasp'],
    filePatterns: ['**/auth/**', '**/security/**', '**/middleware/auth*'],
    promptFocus: 'Focus on: authentication bypass, injection vulnerabilities, data exposure, session management, crypto weaknesses, OWASP top 10'
  },
  database: {
    name: 'database',
    description: 'Database specialist for data integrity and performance',
    keywords: ['sql', 'database', 'migration', 'schema', 'index', 'transaction', 'query', 'orm', 'model'],
    filePatterns: ['**/*.sql', '**/migrations/**', '**/models/**', 'alembic/versions/**'],
    promptFocus: 'Focus on: data integrity, transaction safety, index usage, N+1 queries, migration rollback safety, schema design'
  },
  api: {
    name: 'api',
    description: 'API design specialist for contracts and compatibility',
    keywords: ['api', 'endpoint', 'rest', 'graphql', 'route', 'router', 'controller', 'versioning'],
    filePatterns: ['**/routers/**', '**/routes/**', '**/controllers/**', '**/api/**'],
    promptFocus: 'Focus on: backwards compatibility, API versioning, error handling, input validation, rate limiting, documentation'
  },
  performance: {
    name: 'performance',
    description: 'Performance specialist for optimization and scaling',
    keywords: ['performance', 'cache', 'caching', 'optimize', 'latency', 'memory', 'scaling', 'rate limit', 'throttle'],
    filePatterns: ['**/cache/**', '**/workers/**', '**/queues/**'],
    promptFocus: 'Focus on: caching strategies, memory leaks, algorithmic complexity, database query optimization, async patterns'
  },
  frontend: {
    name: 'frontend',
    description: 'Frontend specialist for UI/UX and accessibility',
    keywords: ['react', 'vue', 'angular', 'component', 'ui', 'ux', 'accessibility', 'a11y', 'responsive', 'css'],
    filePatterns: ['**/components/**', '**/*.tsx', '**/*.jsx', '**/*.vue', '**/styles/**'],
    promptFocus: 'Focus on: accessibility (WCAG), responsive design, state management, component reusability, user experience'
  },
  payments: {
    name: 'payments',
    description: 'Payments specialist for financial transactions',
    keywords: ['payment', 'billing', 'subscription', 'stripe', 'invoice', 'transaction', 'refund', 'checkout'],
    filePatterns: ['**/payments/**', '**/billing/**', '**/checkout/**'],
    promptFocus: 'Focus on: PCI compliance, idempotency, error recovery, audit trails, financial accuracy, fraud prevention'
  },
  general: {
    name: 'general',
    description: 'General code review for overall quality',
    keywords: [],
    filePatterns: [],
    promptFocus: 'Focus on: code quality, maintainability, testing, error handling, documentation, best practices'
  }
};

// Default agent profiles - one per model, expertise is matched dynamically
// Users can add more profiles to customize which model handles which expertise
export const DEFAULT_AGENT_PROFILES: Record<string, AgentProfile> = {
  // Primary agents - one per model, uses dynamically matched expertise
  'claude-reviewer': {
    name: 'claude-reviewer',
    model: 'claude',
    expertise: 'general',  // Will be overridden by matched expertise at runtime
    description: 'Claude-based reviewer (Anthropic)'
  },
  'codex-reviewer': {
    name: 'codex-reviewer',
    model: 'codex',
    expertise: 'general',  // Will be overridden by matched expertise at runtime
    description: 'Codex-based reviewer (OpenAI)'
  },
  'gemini-reviewer': {
    name: 'gemini-reviewer',
    model: 'gemini',
    expertise: 'general',  // Will be overridden by matched expertise at runtime
    description: 'Gemini-based reviewer (Google)'
  },
  // Arbiter uses a different model than typical reviewers for diversity
  'arbiter': {
    name: 'arbiter',
    model: 'gemini',
    expertise: 'general',
    description: 'Arbiter for resolving disputes'
  }
};

// Default model configurations
export const DEFAULT_MODELS: Record<string, ModelConfig> = {
  claude: {
    cli: 'claude',
    headlessFlag: '-p',
    modelFamily: 'anthropic'
  },
  codex: {
    cli: 'codex',
    headlessFlag: 'exec',
    modelFamily: 'openai'
  },
  gemini: {
    cli: 'gemini',
    headlessFlag: '',
    modelFamily: 'google'
  }
};

export const DEFAULT_CONFIG: CorrumConfig = {
  corrum: {
    enabled: true,
    version: '0.1.0'
  },
  triggers: {
    keywords: DEFAULT_KEYWORDS,
    filePatterns: DEFAULT_FILE_PATTERNS,
    complexityThreshold: 7
  },
  roles: {
    defaultPlanner: 'claude',
    defaultReviewers: ['codex'],
    arbiterStrategy: 'round-robin',
    arbiters: ['gemini', 'claude']
  },
  rules: {
    maxIterations: 2,
    requireUnanimous: false,  // deprecated, kept for backwards compatibility
    consensusMode: 'majority',
    autoSkipTrivial: true,
    trivialPatterns: DEFAULT_TRIVIAL_PATTERNS
  },
  paths: {
    baseDir: 'docs/corrum',
    proposalsDir: 'proposals',
    reviewsDir: 'reviews',
    decisionsDir: 'decisions',
    verificationsDir: 'verifications'
  },
  templates: {
    proposal: 'templates/proposal.md',
    review: 'templates/review.md',
    decision: 'templates/decision.md'
  },
  models: DEFAULT_MODELS,
  expertise: DEFAULT_EXPERTISE,
  agentProfiles: DEFAULT_AGENT_PROFILES,
  // Legacy - kept for backwards compatibility
  agents: {
    claude: {
      cli: 'claude',
      headlessFlag: '-p',
      modelFamily: 'anthropic'
    },
    codex: {
      cli: 'codex',
      headlessFlag: 'exec',
      modelFamily: 'openai'
    },
    gemini: {
      cli: 'gemini',
      headlessFlag: '',
      modelFamily: 'google'
    }
  },
  storage: {
    backend: 'sqlite',
    stateFile: '.corrum.db'
  }
};
