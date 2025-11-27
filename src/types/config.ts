// Consensus mode determines how agreement is reached
export type ConsensusMode = 'majority' | 'unanimous';

// Base model names (the underlying AI CLI tools)
export type ModelName = 'claude' | 'codex' | 'gemini';

// Model configuration (how to invoke each CLI tool)
export interface ModelConfig {
  cli: string;
  headlessFlag: string;
  modelFamily: 'anthropic' | 'openai' | 'google';
}

// Expertise profile (domain-specific focus areas)
export interface ExpertiseProfile {
  name: string;
  description: string;
  keywords: string[];
  filePatterns: string[];
  promptFocus: string;
}

// Agent profile (combines model + expertise)
export interface AgentProfile {
  name: string;
  model: ModelName;
  expertise: string;  // references an ExpertiseProfile name
  description: string;
}

// Legacy agent configuration (kept for backwards compatibility)
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
  models: Record<ModelName, ModelConfig>;
  expertise: Record<string, ExpertiseProfile>;
  agentProfiles: Record<string, AgentProfile>;
  // Legacy - kept for backwards compatibility
  agents: Record<AgentName, AgentConfig>;
  storage: StorageConfig;
}

// Legacy agent name type (for backwards compatibility)
export type AgentName = 'claude' | 'codex' | 'gemini';
