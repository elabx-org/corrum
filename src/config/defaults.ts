import type { CorrumConfig, AgentName } from '../types/index.js';

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
