import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { createStorage } from '../storage/index.js';
import { matchExpertiseAndAssignAgents } from '../core/expertise-matcher.js';
import { logger } from '../utils/logger.js';
import type { AgentName } from '../types/index.js';

export type PromptRole = 'planner' | 'reviewer' | 'arbiter' | 'implementer';

export interface GeneratedPrompt {
  role: PromptRole;
  model: AgentName;
  expertise: string;
  promptFocus: string;
  prompt: string;
  context: {
    proposalId?: string;
    proposalFile?: string;
    reviewsDir?: string;
    task?: string;
  };
}

/**
 * Generate a planner prompt for creating proposals
 */
function generatePlannerPrompt(
  task: string,
  files: string[],
  expertiseFocus: string,
  config: ReturnType<typeof loadConfig>
): string {
  const proposalsDir = `${config.paths.baseDir}/${config.paths.proposalsDir}`;

  return `You are a technical planner responsible for creating a detailed proposal for the following task.

## Task
${task}

${files.length > 0 ? `## Files Involved\n${files.map(f => `- ${f}`).join('\n')}\n` : ''}
## Expertise Focus
${expertiseFocus}

## Your Role
Create a comprehensive proposal document that includes:

1. **Summary**: Brief description of what needs to be done
2. **Approach**: Detailed implementation plan
3. **Security Considerations**: Potential vulnerabilities and mitigations
4. **Edge Cases**: What could go wrong and how to handle it
5. **Alternatives**: Other approaches that were considered
6. **Testing Strategy**: How to verify the implementation
7. **Rollback Plan**: How to revert if something goes wrong

## Output Format
Provide your proposal in markdown format. The proposal will be saved and reviewed by other agents.

After creating the proposal, run:
\`corrum propose --title "<short-kebab-case-title>" --content "<your-proposal-markdown>"\`

Or save to a file and run:
\`corrum propose --title "<title>" --file "<proposal-file.md>"\``;
}

/**
 * Generate a reviewer prompt for reviewing proposals
 */
function generateReviewerPrompt(
  proposalId: string,
  proposalFile: string,
  proposalContent: string,
  expertiseFocus: string,
  reviewerModel: AgentName,
  config: ReturnType<typeof loadConfig>
): string {
  return `You are a code reviewer with expertise focus on specific areas. Review the following proposal critically.

## Proposal ID
${proposalId}

## Proposal Content
${proposalContent}

## Your Expertise Focus
${expertiseFocus}

## Review Guidelines
Evaluate the proposal from your expertise perspective:

1. **Security**: Are there any security vulnerabilities or risks?
2. **Correctness**: Will the approach work correctly?
3. **Edge Cases**: Are all edge cases handled?
4. **Performance**: Are there performance concerns?
5. **Maintainability**: Is the approach maintainable?
6. **Alternatives**: Are there better approaches?

## Your Vote
After your review, you must provide ONE of these votes:
- **APPROVE**: The proposal is sound and ready for implementation
- **REJECT**: The proposal has fundamental issues that cannot be easily fixed
- **REVISE**: The proposal needs changes before it can be approved

## Output Format
Provide your review in the following JSON format:
\`\`\`json
{
  "vote": "APPROVE" | "REJECT" | "REVISE",
  "summary": "Brief summary of your assessment",
  "strengths": ["List of strengths"],
  "concerns": ["List of concerns"],
  "suggestions": ["List of suggestions for improvement"],
  "reasoning": "Detailed reasoning for your vote"
}
\`\`\`

After your review, the orchestrator will record it with:
\`corrum add-review --proposal "${proposalId}" --agent ${reviewerModel} --vote <YOUR_VOTE> --content "<YOUR_REVIEW>"\``;
}

/**
 * Generate an arbiter prompt for resolving disputes
 */
function generateArbiterPrompt(
  proposalId: string,
  proposalContent: string,
  reviews: Array<{ agent: string; vote: string; content: string }>,
  expertiseFocus: string,
  config: ReturnType<typeof loadConfig>
): string {
  const reviewsSummary = reviews.map(r =>
    `### ${r.agent} - ${r.vote}\n${r.content}`
  ).join('\n\n');

  return `You are an arbiter responsible for making a final decision on a disputed proposal.

## Proposal ID
${proposalId}

## Proposal Content
${proposalContent}

## Conflicting Reviews
${reviewsSummary}

## Your Expertise Focus
${expertiseFocus}

## Arbiter Guidelines
As arbiter, you must:

1. Consider all reviewer perspectives objectively
2. Weigh the technical merits of each argument
3. Consider the risks and benefits
4. Make a definitive decision

## Your Decision
You must provide ONE of these decisions:
- **APPROVE**: The proposal should proceed despite concerns
- **REJECT**: The proposal should not proceed

Note: As arbiter, you cannot vote REVISE. You must make a final decision.

## Output Format
Provide your decision in the following JSON format:
\`\`\`json
{
  "decision": "APPROVE" | "REJECT",
  "summary": "Brief summary of your decision",
  "reasoning": "Detailed reasoning considering all perspectives",
  "addressed_concerns": ["How each concern was weighed"],
  "conditions": ["Any conditions for approval, if applicable"]
}
\`\`\`

After your decision, the orchestrator will record it with:
\`corrum decide --proposal "${proposalId}" --outcome <approved|rejected> --summary "<YOUR_SUMMARY>"\``;
}

/**
 * Generate an implementer prompt for implementing approved proposals
 */
function generateImplementerPrompt(
  proposalId: string,
  proposalContent: string,
  reviews: Array<{ agent: string; vote: string; content: string }>,
  expertiseFocus: string
): string {
  const feedbackSummary = reviews
    .filter(r => r.vote === 'APPROVE')
    .map(r => `### ${r.agent}\n${r.content}`)
    .join('\n\n');

  return `You are responsible for implementing an approved proposal.

## Proposal ID
${proposalId}

## Approved Proposal
${proposalContent}

## Reviewer Feedback to Consider
${feedbackSummary || 'No specific feedback to incorporate.'}

## Implementation Focus
${expertiseFocus}

## Implementation Guidelines
1. Follow the proposal's implementation plan exactly
2. Address any suggestions from reviewers
3. Ensure all security considerations are implemented
4. Handle all edge cases mentioned
5. Write tests as specified in the testing strategy
6. Document any deviations from the plan

## After Implementation
Once implementation is complete, run:
\`corrum complete --proposal "${proposalId}"\`

If you encounter issues that require proposal changes, inform the orchestrator.`;
}

export const promptCommand = new Command('prompt')
  .description('Generate role-specific prompts for Claude Code Task agents')
  .requiredOption('--role <role>', 'Role: planner, reviewer, arbiter, or implementer')
  .option('--task <task>', 'Task description (required for planner)')
  .option('--files <files...>', 'Files involved (for planner)')
  .option('--proposal <id>', 'Proposal ID (required for reviewer, arbiter, implementer)')
  .option('--model <model>', 'Target model (claude/codex/gemini)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { role, task, files = [], proposal: proposalId, model, json } = options;

    try {
      const config = loadConfig();
      const storage = createStorage(config.storage);

      // Validate role
      const validRoles: PromptRole[] = ['planner', 'reviewer', 'arbiter', 'implementer'];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
      }

      let prompt: string;
      let targetModel: AgentName;
      let expertise: string;
      let promptFocus: string;
      let context: GeneratedPrompt['context'] = {};

      if (role === 'planner') {
        // Planner needs a task
        if (!task) {
          throw new Error('--task is required for planner role');
        }

        // Match expertise based on task
        const expertiseResult = matchExpertiseAndAssignAgents(task, files, config);
        targetModel = model || config.roles.defaultPlanner;
        expertise = expertiseResult.topExpertise;
        promptFocus = expertiseResult.promptFocus;
        context = { task, proposalFile: `${config.paths.baseDir}/${config.paths.proposalsDir}/` };

        prompt = generatePlannerPrompt(task, files, promptFocus, config);
      } else {
        // Reviewer, arbiter, implementer need a proposal
        if (!proposalId) {
          throw new Error(`--proposal is required for ${role} role`);
        }

        const proposal = storage.getProposal(proposalId);
        if (!proposal) {
          throw new Error(`Proposal not found: ${proposalId}`);
        }

        const reviews = storage.getReviewsForProposal(proposalId);

        // Match expertise based on proposal content
        const expertiseResult = matchExpertiseAndAssignAgents(
          proposal.content || proposal.title,
          [],
          config
        );

        expertise = expertiseResult.topExpertise;
        promptFocus = expertiseResult.promptFocus;
        context = {
          proposalId: proposal.id,
          proposalFile: proposal.filePath,
          reviewsDir: `${config.paths.baseDir}/${config.paths.reviewsDir}`
        };

        if (role === 'reviewer') {
          targetModel = model || config.roles.defaultReviewers[0];
          prompt = generateReviewerPrompt(
            proposal.id,
            proposal.filePath,
            proposal.content || '',
            promptFocus,
            targetModel,
            config
          );
        } else if (role === 'arbiter') {
          targetModel = model || config.roles.arbiters[0];
          prompt = generateArbiterPrompt(
            proposal.id,
            proposal.content || '',
            reviews.map(r => ({ agent: r.agent, vote: r.vote, content: r.content || '' })),
            promptFocus,
            config
          );
        } else {
          // implementer
          targetModel = model || 'claude';
          prompt = generateImplementerPrompt(
            proposal.id,
            proposal.content || '',
            reviews.map(r => ({ agent: r.agent, vote: r.vote, content: r.content || '' })),
            promptFocus
          );
        }
      }

      storage.close();

      const result: GeneratedPrompt = {
        role: role as PromptRole,
        model: targetModel,
        expertise,
        promptFocus,
        prompt,
        context
      };

      if (json) {
        logger.json(result);
      } else {
        console.log('');
        logger.info(`Role: ${role}`);
        logger.dim(`Model: ${targetModel}`);
        logger.dim(`Expertise: ${expertise}`);
        console.log('');
        logger.info('Prompt:');
        console.log('─'.repeat(60));
        console.log(prompt);
        console.log('─'.repeat(60));
        console.log('');
        logger.dim('Use this prompt with Claude Code Task tool or pipe to an AI CLI.');
      }
    } catch (error) {
      if (json) {
        logger.json({ error: String(error) });
      } else {
        logger.error(`Failed to generate prompt: ${error}`);
      }
      process.exit(1);
    }
  });
