import type { CorrumConfig, AgentName } from '../types/index.js';
import type { Proposal } from '../types/proposal.js';

export interface GeneratedCommand {
  agent: AgentName;
  command: string;
  description: string;
}

export function generateReviewCommand(
  proposal: Proposal,
  reviewer: AgentName,
  config: CorrumConfig
): GeneratedCommand {
  const agentConfig = config.agents[reviewer];
  const reviewPath = `${config.paths.baseDir}/${config.paths.reviewsDir}/${proposal.id}-${reviewer}.md`;

  const prompt = `Review ${proposal.filePath} for security vulnerabilities, edge cases, and alternative approaches. Vote: APPROVE/REJECT/REVISE with detailed reasoning. Save your review to ${reviewPath}`;

  let command: string;
  if (reviewer === 'codex') {
    command = `${agentConfig.cli} ${agentConfig.headlessFlag} "${prompt}"`;
  } else if (reviewer === 'claude') {
    command = `${agentConfig.cli} ${agentConfig.headlessFlag} "${prompt}"`;
  } else if (reviewer === 'gemini') {
    command = `${agentConfig.cli} "${prompt}"`;
  } else {
    command = `${agentConfig.cli} "${prompt}"`;
  }

  return {
    agent: reviewer,
    command,
    description: `Request review from ${reviewer}`
  };
}

export function generateArbiterCommand(
  proposal: Proposal,
  arbiter: AgentName,
  config: CorrumConfig
): GeneratedCommand {
  const agentConfig = config.agents[arbiter];
  const reviewsPath = `${config.paths.baseDir}/${config.paths.reviewsDir}`;
  const decisionPath = `${config.paths.baseDir}/${config.paths.decisionsDir}/${proposal.id}.md`;

  const prompt = `Act as arbiter for proposal ${proposal.filePath}. Review the conflicting reviews in ${reviewsPath}/${proposal.id}-*.md. Make a final decision: APPROVE/REJECT. Save your decision to ${decisionPath}`;

  let command: string;
  if (arbiter === 'gemini') {
    command = `${agentConfig.cli} "${prompt}"`;
  } else if (arbiter === 'claude') {
    command = `${agentConfig.cli} ${agentConfig.headlessFlag} "${prompt}"`;
  } else {
    command = `${agentConfig.cli} "${prompt}"`;
  }

  return {
    agent: arbiter,
    command,
    description: `Request arbiter decision from ${arbiter}`
  };
}

export function generateImplementCommand(
  proposal: Proposal,
  config: CorrumConfig
): GeneratedCommand {
  const prompt = `Implement the approved proposal from ${proposal.filePath}. Follow the implementation plan and address all review feedback.`;

  return {
    agent: 'claude',
    command: `claude "${prompt}"`,
    description: 'Implement the approved proposal'
  };
}
