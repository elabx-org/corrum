import { z } from 'zod';

const agentNameSchema = z.enum(['claude', 'codex', 'gemini']);
const modelFamilySchema = z.enum(['anthropic', 'openai', 'google']);

const agentConfigSchema = z.object({
  cli: z.string(),
  headless_flag: z.string().optional(),
  headlessFlag: z.string().optional(),
  model_family: modelFamilySchema.optional(),
  modelFamily: modelFamilySchema.optional()
}).transform(val => ({
  cli: val.cli,
  headlessFlag: val.headlessFlag ?? val.headless_flag ?? '',
  modelFamily: val.modelFamily ?? val.model_family ?? 'anthropic' as const
}));

const triggersSchema = z.object({
  keywords: z.array(z.string()).optional(),
  file_patterns: z.array(z.string()).optional(),
  filePatterns: z.array(z.string()).optional(),
  complexity_threshold: z.number().optional(),
  complexityThreshold: z.number().optional()
}).transform(val => ({
  keywords: val.keywords ?? [],
  filePatterns: val.filePatterns ?? val.file_patterns ?? [],
  complexityThreshold: val.complexityThreshold ?? val.complexity_threshold ?? 7
}));

const rolesSchema = z.object({
  default_planner: agentNameSchema.optional(),
  defaultPlanner: agentNameSchema.optional(),
  default_reviewers: z.array(agentNameSchema).optional(),
  defaultReviewers: z.array(agentNameSchema).optional(),
  arbiter_strategy: z.enum(['round-robin', 'least-used', 'specific']).optional(),
  arbiterStrategy: z.enum(['round-robin', 'least-used', 'specific']).optional(),
  arbiters: z.array(agentNameSchema).optional()
}).transform(val => ({
  defaultPlanner: val.defaultPlanner ?? val.default_planner ?? 'claude' as const,
  defaultReviewers: val.defaultReviewers ?? val.default_reviewers ?? ['codex' as const],
  arbiterStrategy: val.arbiterStrategy ?? val.arbiter_strategy ?? 'round-robin' as const,
  arbiters: val.arbiters ?? ['gemini' as const, 'claude' as const]
}));

const rulesSchema = z.object({
  max_iterations: z.number().optional(),
  maxIterations: z.number().optional(),
  require_unanimous: z.boolean().optional(),
  requireUnanimous: z.boolean().optional(),
  auto_skip_trivial: z.boolean().optional(),
  autoSkipTrivial: z.boolean().optional(),
  trivial_patterns: z.array(z.string()).optional(),
  trivialPatterns: z.array(z.string()).optional()
}).transform(val => ({
  maxIterations: val.maxIterations ?? val.max_iterations ?? 2,
  requireUnanimous: val.requireUnanimous ?? val.require_unanimous ?? false,
  autoSkipTrivial: val.autoSkipTrivial ?? val.auto_skip_trivial ?? true,
  trivialPatterns: val.trivialPatterns ?? val.trivial_patterns ?? []
}));

const pathsSchema = z.object({
  base_dir: z.string().optional(),
  baseDir: z.string().optional(),
  proposals_dir: z.string().optional(),
  proposalsDir: z.string().optional(),
  reviews_dir: z.string().optional(),
  reviewsDir: z.string().optional(),
  decisions_dir: z.string().optional(),
  decisionsDir: z.string().optional(),
  verifications_dir: z.string().optional(),
  verificationsDir: z.string().optional()
}).transform(val => ({
  baseDir: val.baseDir ?? val.base_dir ?? 'docs/corrum',
  proposalsDir: val.proposalsDir ?? val.proposals_dir ?? 'proposals',
  reviewsDir: val.reviewsDir ?? val.reviews_dir ?? 'reviews',
  decisionsDir: val.decisionsDir ?? val.decisions_dir ?? 'decisions',
  verificationsDir: val.verificationsDir ?? val.verifications_dir ?? 'verifications'
}));

const templatesSchema = z.object({
  proposal: z.string().optional(),
  review: z.string().optional(),
  decision: z.string().optional()
}).transform(val => ({
  proposal: val.proposal ?? 'templates/proposal.md',
  review: val.review ?? 'templates/review.md',
  decision: val.decision ?? 'templates/decision.md'
}));

const storageSchema = z.object({
  backend: z.enum(['json', 'sqlite']).optional(),
  state_file: z.string().optional(),
  stateFile: z.string().optional()
}).transform(val => ({
  backend: val.backend ?? 'sqlite' as const,
  stateFile: val.stateFile ?? val.state_file ?? '.corrum.db'
}));

export const configSchema = z.object({
  corrum: z.object({
    enabled: z.boolean().optional(),
    version: z.string().optional()
  }).optional(),
  triggers: triggersSchema.optional(),
  roles: rolesSchema.optional(),
  rules: rulesSchema.optional(),
  paths: pathsSchema.optional(),
  templates: templatesSchema.optional(),
  agents: z.record(agentNameSchema, agentConfigSchema).optional(),
  storage: storageSchema.optional()
});

export type RawConfig = z.input<typeof configSchema>;
