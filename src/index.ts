// Core functionality
export { analyzeTask, type AnalyzeInput } from './core/analyzer.js';
export { assignRoles, selectArbiter, type RoleAssignment } from './core/roles.js';
export { evaluateConsensus } from './core/consensus.js';
export { generateReviewCommand, generateArbiterCommand, generateImplementCommand } from './core/command-generator.js';
export { proposalMachine, stateToStatus, getNextActionForState, createProposalMachineWithContext } from './core/state-machine.js';

// Configuration
export { loadConfig, generateDefaultConfig, DEFAULT_CONFIG } from './config/index.js';

// Storage
export { createStorage, type StorageBackend } from './storage/index.js';

// Types
export * from './types/index.js';

// Main Corrum class for programmatic usage
import { loadConfig } from './config/index.js';
import { createStorage, type StorageBackend } from './storage/index.js';
import { analyzeTask, type AnalyzeInput } from './core/analyzer.js';
import type { CorrumConfig, AnalysisResult, Proposal, Review, Decision } from './types/index.js';

export class Corrum {
  private config: CorrumConfig;
  private storage: StorageBackend;

  constructor(options: { configPath?: string; config?: Partial<CorrumConfig> } = {}) {
    this.config = loadConfig(options.configPath);
    if (options.config) {
      this.config = { ...this.config, ...options.config };
    }
    this.storage = createStorage(this.config.storage);
  }

  analyze(input: Omit<AnalyzeInput, 'config'>): AnalysisResult {
    return analyzeTask(input, this.config);
  }

  getConfig(): CorrumConfig {
    return this.config;
  }

  getStorage(): StorageBackend {
    return this.storage;
  }

  close(): void {
    this.storage.close();
  }
}
