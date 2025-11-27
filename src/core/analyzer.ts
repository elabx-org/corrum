import micromatch from 'micromatch';
import type { CorrumConfig, AgentName, AnalysisResult, ConsensusMode } from '../types/index.js';

export interface AnalyzeInput {
  task: string;
  files?: string[];
  force?: boolean;
  skip?: boolean;
  planner?: AgentName;
  reviewer?: AgentName;
  implementer?: AgentName;
  consensusMode?: ConsensusMode;
}

export function analyzeTask(input: AnalyzeInput, config: CorrumConfig): AnalysisResult {
  const { task, files = [], force = false, skip = false, planner, reviewer, implementer, consensusMode: explicitConsensusMode } = input;

  const taskLower = task.toLowerCase();

  // Detect consensus mode from natural language in task
  const unanimousPatterns = [
    'all agree', 'all to agree', 'must all agree', 'everyone agree', 'unanimous',
    'all agents agree', 'all agents to agree', 'full agreement', 'complete agreement',
    'all must approve', 'everyone must approve', 'all reviewers agree',
    'need all to agree', 'require unanimous', 'require all'
  ];
  const majorityPatterns = [
    'majority', 'majority vote', 'majority wins', 'most agree',
    'majority rules', 'simple majority'
  ];

  let detectedConsensusMode: ConsensusMode = config.rules.consensusMode ?? 'majority';
  if (unanimousPatterns.some(p => taskLower.includes(p))) {
    detectedConsensusMode = 'unanimous';
  } else if (majorityPatterns.some(p => taskLower.includes(p))) {
    detectedConsensusMode = 'majority';
  }

  // Explicit CLI flag takes precedence over natural language detection
  const consensusMode: ConsensusMode = explicitConsensusMode ?? detectedConsensusMode;

  // Handle explicit skip
  if (skip) {
    return {
      requiresCorrum: false,
      reason: 'Explicitly skipped via --skip flag',
      confidence: 1.0,
      matchedRules: { keywords: [], filePatterns: [], complexity: null },
      assignedRoles: {
        planner: planner ?? config.roles.defaultPlanner,
        reviewers: reviewer ? [reviewer] : config.roles.defaultReviewers,
        arbiter: null,
        implementer: implementer ?? 'claude'
      },
      consensusMode,
      nextAction: 'create_proposal',
      instructions: 'Corrum review skipped. Proceed with implementation.'
    };
  }

  // Check if user explicitly requested Corrum review
  const corrumRequestPatterns = [
    'use corrum', 'using corrum', 'with corrum',
    'corrum review', 'corrum process', 'corrum workflow',
    'want corrum', 'need corrum', 'run corrum',
    'multi-agent review', 'multi agent review',
    'get review', 'need review', 'want review',
    'review this', 'review the', 'code review'
  ];
  const userRequestedCorrum = corrumRequestPatterns.some(pattern =>
    taskLower.includes(pattern)
  );

  // If user explicitly requested Corrum, always proceed
  if (userRequestedCorrum) {
    return {
      requiresCorrum: true,
      reason: 'User explicitly requested Corrum review',
      confidence: 1.0,
      matchedRules: { keywords: [], filePatterns: [], complexity: null },
      assignedRoles: {
        planner: planner ?? config.roles.defaultPlanner,
        reviewers: reviewer ? [reviewer] : config.roles.defaultReviewers,
        arbiter: null,
        implementer: implementer ?? 'claude'
      },
      consensusMode,
      nextAction: 'create_proposal',
      instructions: 'User requested Corrum review. Create a proposal document covering the task, approach, potential risks, and alternatives.'
    };
  }

  // Check for keyword matches first (security keywords take priority)
  const matchedKeywords = config.triggers.keywords.filter(keyword =>
    taskLower.includes(keyword.toLowerCase())
  );
  const hasKeywordMatch = matchedKeywords.length > 0;

  // Check for trivial patterns (unless forced or security keywords matched)
  if (!force && !hasKeywordMatch && config.rules.autoSkipTrivial) {
    const matchedTrivial = config.rules.trivialPatterns.filter((pattern: string) =>
      taskLower.includes(pattern.toLowerCase())
    );
    if (matchedTrivial.length > 0) {
      return {
        requiresCorrum: false,
        reason: `Matched trivial patterns: [${matchedTrivial.join(', ')}]`,
        confidence: 0.9,
        matchedRules: { keywords: [], filePatterns: [], complexity: null },
        assignedRoles: {
          planner: planner ?? config.roles.defaultPlanner,
          reviewers: reviewer ? [reviewer] : config.roles.defaultReviewers,
          arbiter: null,
          implementer: implementer ?? 'claude'
        },
        consensusMode,
        nextAction: 'create_proposal',
        instructions: 'Task appears trivial. Proceed without Corrum review.'
      };
    }
  }

  // Check for file pattern matches
  const matchedFilePatterns: string[] = [];
  if (files.length > 0) {
    for (const pattern of config.triggers.filePatterns) {
      const matched = micromatch(files, pattern);
      if (matched.length > 0) {
        matchedFilePatterns.push(pattern);
      }
    }
  }

  // Determine if Corrum is needed
  const hasFilePatternMatch = matchedFilePatterns.length > 0;
  const requiresCorrum = force || hasKeywordMatch || hasFilePatternMatch;

  // Build reason string
  const reasons: string[] = [];
  if (force) reasons.push('Forced via --force flag');
  if (hasKeywordMatch) reasons.push(`Matched keywords: [${matchedKeywords.join(', ')}]`);
  if (hasFilePatternMatch) reasons.push(`Matched file patterns: [${matchedFilePatterns.join(', ')}]`);

  // Calculate confidence
  let confidence = 0.0;
  if (force) confidence = 1.0;
  else if (hasKeywordMatch && hasFilePatternMatch) confidence = 0.95;
  else if (hasKeywordMatch) confidence = 0.85;
  else if (hasFilePatternMatch) confidence = 0.8;

  // Build instructions based on what was matched
  let instructions = '';
  if (requiresCorrum) {
    const topics: string[] = [];
    if (matchedKeywords.some(k => ['auth', 'authentication', 'authorization', 'password', 'token', 'jwt', 'session', 'security', 'encrypt', 'decrypt', 'hash'].includes(k))) {
      topics.push('security implications');
    }
    if (matchedKeywords.some(k => ['rate limit', 'rate-limit', 'throttle', 'performance'].includes(k))) {
      topics.push('performance impact');
    }
    if (matchedKeywords.some(k => ['sql', 'database', 'migration', 'schema'].includes(k))) {
      topics.push('data integrity');
    }
    if (matchedKeywords.some(k => ['api', 'endpoint', 'public'].includes(k))) {
      topics.push('API contract changes');
    }
    if (matchedKeywords.some(k => ['delete', 'remove', 'drop'].includes(k))) {
      topics.push('data loss risks');
    }
    if (matchedKeywords.some(k => ['payment', 'billing', 'subscription'].includes(k))) {
      topics.push('financial implications');
    }

    if (topics.length > 0) {
      instructions = `Create a proposal document covering: ${topics.join(', ')}, and alternative approaches.`;
    } else {
      instructions = 'Create a proposal document covering the implementation approach, potential risks, and alternatives.';
    }
  } else {
    instructions = 'No Corrum review required. Proceed with implementation.';
  }

  return {
    requiresCorrum,
    reason: reasons.length > 0 ? reasons.join('; ') : 'No matching rules found',
    confidence,
    matchedRules: {
      keywords: matchedKeywords,
      filePatterns: matchedFilePatterns,
      complexity: null
    },
    assignedRoles: {
      planner: planner ?? config.roles.defaultPlanner,
      reviewers: reviewer ? [reviewer] : config.roles.defaultReviewers,
      arbiter: null,
      implementer: implementer ?? 'claude'
    },
    consensusMode,
    nextAction: requiresCorrum ? 'create_proposal' : 'create_proposal',
    instructions
  };
}
