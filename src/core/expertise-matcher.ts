import micromatch from 'micromatch';
import type { CorrumConfig, ExpertiseProfile, AgentName } from '../types/index.js';

export interface ExpertiseMatch {
  expertise: string;
  score: number;
  matchedKeywords: string[];
  matchedFilePatterns: string[];
}

export interface AgentAssignment {
  agentProfile: string;
  model: string;
  expertise: string;
  reason: string;
  promptFocus: string;
}

export interface ExpertiseMatchResult {
  matches: ExpertiseMatch[];
  topExpertise: string;
  promptFocus: string;
  recommendedPlanner: AgentAssignment | null;
  recommendedReviewers: AgentAssignment[];
  recommendedArbiter: AgentAssignment | null;
}

/**
 * Calculate expertise match score for a task
 */
export function matchExpertise(
  task: string,
  files: string[],
  expertise: ExpertiseProfile
): ExpertiseMatch {
  const taskLower = task.toLowerCase();

  // Match keywords
  const matchedKeywords = expertise.keywords.filter(keyword =>
    taskLower.includes(keyword.toLowerCase())
  );

  // Match file patterns
  const matchedFilePatterns: string[] = [];
  if (files.length > 0 && expertise.filePatterns.length > 0) {
    for (const pattern of expertise.filePatterns) {
      const matched = micromatch(files, pattern);
      if (matched.length > 0) {
        matchedFilePatterns.push(pattern);
      }
    }
  }

  // Calculate score (keywords weighted higher than file patterns)
  const keywordScore = matchedKeywords.length * 2;
  const filePatternScore = matchedFilePatterns.length;
  const score = keywordScore + filePatternScore;

  return {
    expertise: expertise.name,
    score,
    matchedKeywords,
    matchedFilePatterns
  };
}

/**
 * Find an agent profile by model name
 */
export function findAgentByModel(
  modelName: AgentName,
  config: CorrumConfig
): string | null {
  // Look for a profile that uses this model
  const profile = Object.values(config.agentProfiles)
    .find(p => p.model === modelName && p.name !== 'arbiter');
  return profile?.name || null;
}

/**
 * Create an agent assignment for a given model and expertise
 */
function createAssignment(
  modelName: AgentName,
  expertise: ExpertiseProfile,
  config: CorrumConfig,
  reason: string
): AgentAssignment {
  const profileName = findAgentByModel(modelName, config) || `${modelName}-reviewer`;

  return {
    agentProfile: profileName,
    model: modelName,
    expertise: expertise.name,
    reason,
    promptFocus: expertise.promptFocus
  };
}

/**
 * Match task against all expertise profiles and recommend agents.
 *
 * This function decouples expertise (domain knowledge) from models (AI tools):
 * - Expertise matching determines WHAT domain focus is relevant
 * - Role configuration (planner, reviewers) determines WHICH models to use
 * - The matched expertise's promptFocus is injected into the assigned models
 */
export function matchExpertiseAndAssignAgents(
  task: string,
  files: string[],
  config: CorrumConfig
): ExpertiseMatchResult {
  // Calculate match scores for all expertise profiles
  const matches: ExpertiseMatch[] = Object.values(config.expertise)
    .map(expertise => matchExpertise(task, files, expertise))
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score);

  // If no matches, use general expertise
  if (matches.length === 0) {
    const generalMatch: ExpertiseMatch = {
      expertise: 'general',
      score: 0,
      matchedKeywords: [],
      matchedFilePatterns: []
    };
    matches.push(generalMatch);
  }

  // Get the top matched expertise
  const topExpertiseName = matches[0].expertise;
  const topExpertise = config.expertise[topExpertiseName] || config.expertise['general'];

  // Use configured roles - expertise is applied via promptFocus, not model selection
  const plannerModel = config.roles.defaultPlanner;
  const reviewerModels = config.roles.defaultReviewers;
  const arbiterModel = config.roles.arbiters[0] || 'gemini';

  // Create planner assignment with matched expertise focus
  const recommendedPlanner = createAssignment(
    plannerModel,
    topExpertise,
    config,
    `Using ${plannerModel} with ${topExpertiseName} expertise focus`
  );

  // Create reviewer assignments - each reviewer gets expertise focus
  // If multiple expertise matched, distribute among reviewers
  const recommendedReviewers: AgentAssignment[] = reviewerModels.map((model, index) => {
    // Use different matched expertise for diversity if available
    const expertiseForReviewer = matches[Math.min(index, matches.length - 1)];
    const expertiseProfile = config.expertise[expertiseForReviewer.expertise] || topExpertise;

    return createAssignment(
      model,
      expertiseProfile,
      config,
      `Using ${model} with ${expertiseProfile.name} expertise focus`
    );
  });

  // Create arbiter assignment
  const arbiterExpertise = config.expertise['general'] || topExpertise;
  const recommendedArbiter: AgentAssignment = {
    agentProfile: 'arbiter',
    model: arbiterModel,
    expertise: 'general',
    reason: 'Arbiter for dispute resolution',
    promptFocus: arbiterExpertise.promptFocus
  };

  return {
    matches,
    topExpertise: topExpertiseName,
    promptFocus: topExpertise.promptFocus,
    recommendedPlanner,
    recommendedReviewers,
    recommendedArbiter
  };
}

// Legacy export for backwards compatibility
export function findAgentForExpertise(
  expertiseName: string,
  config: CorrumConfig,
  excludeAgents: string[] = []
): AgentAssignment | null {
  const expertise = config.expertise[expertiseName];
  if (!expertise) return null;

  // Find any available agent profile not in exclude list
  const availableProfile = Object.values(config.agentProfiles)
    .find(profile => !excludeAgents.includes(profile.name) && profile.name !== 'arbiter');

  if (!availableProfile) return null;

  return {
    agentProfile: availableProfile.name,
    model: availableProfile.model,
    expertise: expertiseName,
    reason: `Matched expertise: ${expertiseName}`,
    promptFocus: expertise.promptFocus
  };
}
