// Consensus mode determines how agreement is reached
export type ConsensusMode = 'majority' | 'unanimous';

// Agent configuration
export interface AgentConfig {
  cli: string;
  headlessFlag: string;
  modelFamily: 'anthropic' | 'openai' | 'google';
}

// Trigger configuration
export interface TriggersConfig {
  keywords: string[];
  filePatterns: string[];
  complexityThreshold: number;
}

// Role configuration
export interface RolesConfig {
  defaultPlanner: AgentName;
  defaultReviewers: AgentName[];
  arbiterStrategy: 'round-robin' | 'least-used' | 'specific';
  arbiters: AgentName[];
}

// Rules configuration
export interface RulesConfig {
  maxIterations: number;
  requireUnanimous: boolean;  // deprecated, use consensusMode
  consensusMode: ConsensusMode;
  autoSkipTrivial: boolean;
  trivialPatterns: string[];
}

// Paths configuration
export interface PathsConfig {
  baseDir: string;
  proposalsDir: string;
  reviewsDir: string;
  decisionsDir: string;
  verificationsDir: string;
}

// Templates configuration
export interface TemplatesConfig {
  proposal: string;
  review: string;
  decision: string;
}

// Storage configuration
export interface StorageConfig {
  backend: 'json' | 'sqlite';
  stateFile: string;
}

// Full Corrum config
export interface CorrumConfig {
  corrum: {
    enabled: boolean;
    version: string;
  };
  triggers: TriggersConfig;
  roles: RolesConfig;
  rules: RulesConfig;
  paths: PathsConfig;
  templates: TemplatesConfig;
  agents: Record<AgentName, AgentConfig>;
  storage: StorageConfig;
}

export type AgentName = 'claude' | 'codex' | 'gemini';
