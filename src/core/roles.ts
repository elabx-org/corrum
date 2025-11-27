import type { CorrumConfig, AgentName } from '../types/index.js';
import type { StorageBackend } from '../storage/index.js';

export interface RoleAssignment {
  planner: AgentName;
  reviewers: AgentName[];
  arbiter: AgentName | null;
}

export function assignRoles(
  config: CorrumConfig,
  storage: StorageBackend,
  overridePlanner?: AgentName
): RoleAssignment {
  const planner = overridePlanner ?? config.roles.defaultPlanner;
  const reviewers = config.roles.defaultReviewers;

  return {
    planner,
    reviewers,
    arbiter: null // Assigned later if needed
  };
}

export function selectArbiter(
  config: CorrumConfig,
  storage: StorageBackend,
  excludeFamily: 'anthropic' | 'openai' | 'google'
): AgentName {
  // Filter out agents from the same model family
  const eligibleArbiters = config.roles.arbiters.filter(agent => {
    const agentConfig = config.agents[agent];
    return agentConfig.modelFamily !== excludeFamily;
  });

  if (eligibleArbiters.length === 0) {
    // Fallback to any arbiter if none from different family
    return config.roles.arbiters[0];
  }

  switch (config.roles.arbiterStrategy) {
    case 'round-robin': {
      // Get stats to determine next arbiter
      const stats = storage.getStats();
      let minArbitrations = Infinity;
      let selectedArbiter = eligibleArbiters[0];

      for (const arbiter of eligibleArbiters) {
        const count = stats.byAgent[arbiter]?.arbitrations ?? 0;
        if (count < minArbitrations) {
          minArbitrations = count;
          selectedArbiter = arbiter;
        }
      }
      return selectedArbiter;
    }
    case 'least-used': {
      // Same as round-robin for now
      const stats = storage.getStats();
      let minArbitrations = Infinity;
      let selectedArbiter = eligibleArbiters[0];

      for (const arbiter of eligibleArbiters) {
        const count = stats.byAgent[arbiter]?.arbitrations ?? 0;
        if (count < minArbitrations) {
          minArbitrations = count;
          selectedArbiter = arbiter;
        }
      }
      return selectedArbiter;
    }
    case 'specific':
    default:
      return eligibleArbiters[0];
  }
}

export function getModelFamily(agent: AgentName, config: CorrumConfig): 'anthropic' | 'openai' | 'google' {
  const family = config.agents[agent].modelFamily;
  if (family === 'anthropic' || family === 'openai' || family === 'google') {
    return family;
  }
  // Default fallback
  return 'anthropic';
}
