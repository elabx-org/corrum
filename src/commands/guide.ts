import { Command } from 'commander';

const GUIDE_TEXT = `
# Corrum - Multi-Agent Code Review Orchestrator

## Overview
Corrum is a helper tool that manages multi-agent AI code reviews. It tracks proposals,
reviews, and decisions - letting AI agents focus on the actual analysis while Corrum
handles the workflow orchestration.

**Key principle**: Corrum helps manage the review process, it doesn't gatekeep.
When users ask for a review, Corrum always proceeds.

## Full Automated Workflow - The run Command

The \`run\` command executes the complete Corrum workflow automatically:

    # Dry-run: preview what would happen without executing agents
    corrum run --task "Add JWT authentication" --dry-run

    # Full execution: actually run AI agents (claude, codex, gemini)
    corrum run --task "Add JWT authentication"

    # With options
    corrum run --task "Add JWT auth" --consensus-mode unanimous --timeout 600000

This will:
1. Analyze the task and match expertise
2. Execute planner agent to create proposal
3. Execute reviewer agents (in sequence)
4. Evaluate votes per consensus mode
5. Execute implementer agent (if approved)

Options:
- --dry-run: Preview without executing agents
- --mock: Simulate agent responses (for testing without real CLIs)
- --skip-implementation: Stop after approval
- --timeout <ms>: Agent timeout (default: 300000)
- --json: Output JSON, emit progress events

Execution Modes:
- DRY-RUN: Shows what would happen without any execution
- MOCK: Simulates agent responses for testing (no real CLIs needed)
- REAL: Actually executes AI agents (requires claude/codex/gemini CLIs)

## When Corrum Review is Triggered

Corrum review is ALWAYS triggered when:
- User explicitly requests it ("use corrum", "code review", "review this", etc.)
- Task contains security keywords (auth, password, token, etc.)
- Task involves sensitive areas (database, api, payment, etc.)
- Files match sensitive patterns (auth/**, routers/**, *.sql)
- --force flag is used

Corrum review is skipped when:
- Task matches trivial patterns (typo, readme, formatting) AND no keywords match
- --skip flag is used

## Workflow

### Step 1: Analyze the Task
Check if Corrum review is needed (or if user requested it):

    corrum analyze --task "improve performance of this app"
    corrum analyze --task "use corrum to review this feature"

If user mentions "corrum", "review", etc., it always returns \`requires_corrum: true\`.

### Step 2: Create a Proposal
If review is required, create a proposal document:

    corrum propose --title "api-authentication" --content "# Proposal content..."

This creates a proposal file and returns a proposal ID (e.g., "20251127-api-authentication").

### Step 3: Get Next Action
Check what action is needed next:

    corrum next --proposal "20251127-api-authentication"

This returns:
- next_action: what to do (request_review, revise_proposal, implement, etc.)
- command: the command to run (e.g., for requesting review from another agent)
- instructions: human-readable guidance

### Step 4: Request Review
Run the command from step 3 to get a review from another agent (Codex, Gemini).
Then record the review:

    corrum add-review \\
      --proposal "20251127-api-authentication" \\
      --agent codex \\
      --vote APPROVE \\
      --content "Review feedback here..."

Vote options: APPROVE, REJECT, REVISE

### Consensus Modes

Corrum supports two consensus modes for reaching agreement:

**Majority (default)**: Approval/rejection is determined by majority vote.
- 2 APPROVE vs 1 REJECT = approved
- 2 REJECT vs 1 APPROVE = rejected

**Unanimous**: All reviewers must agree for consensus.
- All APPROVE = approved
- All REJECT = rejected
- Mixed votes = disputed (invoke arbiter)

#### Natural Language Detection

Corrum automatically detects consensus mode from the task description:

**Unanimous triggers** (user wants all agents to agree):
- "all agree", "must all agree", "everyone agree"
- "unanimous", "full agreement", "complete agreement"
- "all must approve", "all reviewers agree"
- "need all to agree", "require unanimous"

**Majority triggers** (explicit majority request):
- "majority", "majority vote", "majority wins"
- "majority rules", "simple majority"

Example:
    corrum analyze --task "review this auth change, I need all agents to agree"
    # Returns: consensus_mode: "unanimous"

#### CLI Override

You can also explicitly set the mode via CLI:

    corrum analyze --task "Add auth" --consensus-mode unanimous
    corrum add-review --proposal "ID" --agent codex --vote APPROVE --consensus-mode unanimous

Note: REVISE votes always trigger revision regardless of consensus mode.

### Step 5: Check Consensus
After adding reviews, check the status:

    corrum status --proposal "20251127-api-authentication"

The status shows current state and next action based on votes.

### Step 6: Implement (if approved)
Once approved, implement the proposal, then mark complete:

    corrum complete --proposal "20251127-api-authentication"

## Commands Reference

| Command        | Purpose                                    |
|----------------|---------------------------------------------|
| run            | **Full automated workflow** with visual progress |
| analyze        | Check if task needs Corrum review          |
| workflow       | Get workflow state with progress events    |
| propose        | Create a new proposal                       |
| prompt         | Generate role-specific prompts for agents  |
| next           | Get next action for a proposal             |
| add-review     | Record a review from an agent              |
| decide         | Record final decision (arbiter/human)      |
| complete       | Mark proposal as implemented               |
| status         | Check proposal status with workflow progress |
| list           | List all proposals with filters            |
| stats          | Show metrics and statistics                |
| verify         | Post-implementation verification           |
| guide          | Show this guide                            |

## Claude Code Orchestration

Corrum is designed to work with Claude Code as the orchestrator. Claude Code uses its
Task tool to spawn parallel agents, while Corrum manages the workflow state.

### The prompt Command

Generate role-specific prompts with expertise focus for Claude Code Task agents:

    # Generate planner prompt
    corrum prompt --role planner --task "Add JWT authentication" --json

    # Generate reviewer prompt (after proposal exists)
    corrum prompt --role reviewer --proposal "20251127-jwt-auth" --json

    # Generate arbiter prompt (for disputes)
    corrum prompt --role arbiter --proposal "20251127-jwt-auth" --json

    # Generate implementer prompt (after approval)
    corrum prompt --role implementer --proposal "20251127-jwt-auth" --json

### Orchestration Flow

Claude Code orchestrates the full workflow:

    // 1. Analyze task and check if Corrum review needed
    const analysis = await bash('corrum analyze --task "..." --json');

    // 2. Generate planner prompt with expertise focus
    const plannerPrompt = await bash('corrum prompt --role planner --task "..." --json');

    // 3. Use Task tool to create proposal (Claude Code spawns agent)
    const proposal = await Task({ prompt: plannerPrompt.prompt, subagent_type: 'general-purpose' });

    // 4. Record the proposal
    await bash('corrum propose --title "..." --content "...");

    // 5. Generate reviewer prompts
    const reviewerPrompt = await bash('corrum prompt --role reviewer --proposal "..." --json');

    // 6. Spawn reviewers in parallel using Task tool
    const reviews = await Promise.all([
      Task({ prompt: reviewerPrompt.prompt, subagent_type: 'general-purpose' }),
      // Can spawn multiple reviewers
    ]);

    // 7. Record reviews
    await bash('corrum add-review --proposal "..." --agent codex --vote APPROVE --content "...");

    // 8. Check consensus
    const status = await bash('corrum status --proposal "..." --json');

    // 9. If approved, implement
    if (status.status === 'approved') {
      const implPrompt = await bash('corrum prompt --role implementer --proposal "..." --json');
      await Task({ prompt: implPrompt.prompt, subagent_type: 'general-purpose' });
      await bash('corrum complete --proposal "...');
    }

### Benefits of This Architecture

1. **Claude Code as Driver**: Claude Code's Task tool handles agent spawning
2. **Corrum as State Manager**: Corrum tracks workflow state, not agent lifecycle
3. **Expertise Injection**: Each role gets domain-specific focus via promptFocus
4. **Model Agnostic**: Roles determine which model, expertise determines focus
5. **Parallel Reviews**: Multiple reviewers can run simultaneously

## Triggers (when Corrum is required)

### User Request Patterns (always triggers):
- "use corrum", "using corrum", "with corrum"
- "corrum review", "corrum process", "corrum workflow"
- "code review", "review this", "review the"
- "need review", "want review", "get review"
- "multi-agent review"

### Security Keywords:
- auth, authentication, authorization, password, token, jwt, session
- security, encrypt, decrypt, hash

### Database Keywords:
- sql, database, migration, schema

### API Keywords:
- api, endpoint, public

### Sensitive Operations:
- payment, billing, subscription
- delete, remove, drop
- rate limit, throttle

### File Patterns:
- **/auth/**, **/routers/**, **/middleware/**
- **/*.sql, **/models.py, **/schemas.py
- alembic/versions/**

## Expertise System

Corrum uses an expertise-based system to automatically assign the best agents for each task.
This system decouples **expertise** (domain knowledge) from **models** (AI CLI tools),
allowing flexible configuration.

### Expertise Profiles

Built-in expertise profiles:

| Expertise   | Focus Areas                                                    |
|-------------|----------------------------------------------------------------|
| security    | Auth bypass, injection, data exposure, OWASP top 10            |
| database    | Data integrity, transactions, N+1 queries, migrations          |
| api         | Backwards compatibility, versioning, error handling            |
| performance | Caching, memory leaks, algorithmic complexity                  |
| frontend    | Accessibility (WCAG), responsive design, state management      |
| payments    | PCI compliance, idempotency, audit trails, fraud prevention    |
| general     | Code quality, maintainability, testing, best practices         |

### How Expertise Works

The expertise system is **model-agnostic** - expertise defines *what* to focus on,
while roles define *which model* to use. This decoupling means:

1. **Expertise matching** - Corrum analyzes the task and files to determine relevant domains
2. **Role assignment** - Your configured roles (planner, reviewers) determine which models run
3. **Focus injection** - The matched expertise's promptFocus is injected into the assigned models

### Expertise Matching

When you analyze a task, Corrum automatically:

1. Scans the task description for keywords matching expertise profiles
2. Matches file patterns against expertise file patterns
3. Calculates a score for each expertise (keywords weighted higher)
4. Returns the matched expertise and its promptFocus to inject into your models

Example:
    corrum analyze --task "Add JWT authentication to user endpoints" --json

Returns expertise_matches showing which expertise matched and why,
plus the promptFocus that should be injected into your planner/reviewers.

### Configuring Roles (Which Models to Use)

Configure which models handle each role in .corrum-config.toml:

    [roles]
    defaultPlanner = "claude"      # Claude creates proposals
    defaultReviewers = ["codex"]   # Codex reviews proposals
    arbiters = ["gemini", "claude"] # For dispute resolution

The expertise system will inject the appropriate domain focus into whichever
models you've configured.

### Customizing Expertise Profiles

Add domain-specific focus areas:

    [expertise.devops]
    name = "devops"
    description = "DevOps and infrastructure specialist"
    keywords = ["docker", "kubernetes", "ci", "cd", "pipeline", "deploy"]
    filePatterns = ["**/Dockerfile", "**/.github/workflows/**", "**/k8s/**"]
    promptFocus = "Focus on: container security, pipeline reliability, infrastructure as code"

### Available Models

| Model   | CLI Tool | Model Family |
|---------|----------|--------------|
| claude  | claude   | anthropic    |
| codex   | codex    | openai       |
| gemini  | gemini   | google       |

### Claude CLI Headless Mode

By default, Corrum runs claude with flags for headless operation:

    claude -p --dangerously-skip-permissions "prompt"

**Flags explained:**
- \`-p\` - Print mode (non-interactive output)
- \`--dangerously-skip-permissions\` - Bypass permission checks for automated execution

**Note:** The \`--tools\` flag is NOT used because it's a variadic option that would
consume subsequent arguments including the prompt.

**Important:** Claude CLI in print mode still reads the current directory context
(CLAUDE.md, etc.), which can add processing time for complex codebases.

**Fast mode:** Use the \`--fast\` flag to skip loading project context:

    corrum run --task "Add auth" --fast

This adds \`--setting-sources ""\` to Claude commands, skipping CLAUDE.md and other
project settings for faster responses. Trade-off: Claude won't have project-specific context.

**Customizing via config** (.corrum-config.toml):

    [models.claude]
    cli = "claude"
    headlessFlag = "-p"
    extraFlags = ["--dangerously-skip-permissions"]

### Codex Sandbox Bypass

By default, Corrum runs codex with flags to bypass sandbox restrictions for automated execution:

    codex exec --dangerously-auto-approve --sandbox none --quiet "prompt"

This is necessary because codex's sandbox can block file operations in automated contexts.

**Flags explained:**
- \`--dangerously-auto-approve\` - Auto-approve tool calls without prompting
- \`--sandbox none\` - Disable sandbox restrictions
- \`--quiet\` - Suppress interactive UI elements

**Customizing via config** (.corrum-config.toml):

    [models.codex]
    cli = "codex"
    headlessFlag = "exec"
    extraFlags = ["--dangerously-auto-approve", "--sandbox", "none", "--quiet"]

**For Docker/hardened environments** (full bypass):

    [models.codex]
    cli = "codex"
    headlessFlag = ""
    extraFlags = ["--dangerously-bypass-approvals-and-sandbox"]

See: https://developers.openai.com/codex/cli/reference/

## Roles (Legacy)

- Planner (default: claude): Creates proposals
- Reviewer (default: codex): Reviews proposals, votes APPROVE/REJECT/REVISE
- Arbiter (gemini/claude): Resolves disputes when reviewers disagree
- Implementer (default: claude): Implements approved proposals

### Role Overrides

You can override roles when analyzing a task:

    corrum analyze --task "Add auth" --planner gemini --reviewer claude --implementer codex

This allows flexible agent assignment based on task needs.
Note: These are legacy overrides. The new expertise system provides automatic matching.

## State Machine

Proposal lifecycle:
  draft → pending_review → approved → implemented
                        ↘ revision (if REVISE vote)
                        ↘ disputed (if conflicting votes) → arbiter decides

## JSON Output

All commands support --json flag for machine-readable output:

    corrum analyze --task "Add auth" --json
    corrum status --proposal "..." --json

## Progress Events & Real-Time Feedback

Corrum supports emitting progress events to stderr in NDJSON format for real-time feedback.

### The --progress Flag

Add --progress to commands to emit workflow events:

    # Workflow with progress events (recommended for Claude Code)
    corrum workflow --task "Add JWT auth" --progress --json

    # Analyze with progress
    corrum analyze --task "Add JWT auth" --progress --json

    # Status with progress
    corrum status --proposal "..." --progress --json

### Event Types

Events are emitted to stderr as NDJSON, while results go to stdout:

    {"event":"workflow_started","task":"Add JWT auth","phase":"analysis","timestamp":"..."}
    {"event":"expertise_matched","expertise":"security","score":6,"promptFocus":"..."}
    {"event":"analysis_complete","requiresReview":true,"expertise":"security","triggers":["auth","jwt"]}
    {"event":"phase_complete","phase":"analysis"}
    {"event":"review_received","agent":"codex","vote":"APPROVE","current":1,"total":1}
    {"event":"consensus_reached","outcome":"approved","mode":"majority"}
    {"event":"workflow_complete","status":"approved","proposalId":"..."}

### Workflow Phases

| Phase           | Description                           |
|-----------------|---------------------------------------|
| analysis        | Task analysis and expertise matching  |
| planning        | Proposal creation                     |
| review          | Collecting reviews from agents        |
| consensus       | Evaluating votes                      |
| arbitration     | Dispute resolution                    |
| implementation  | Executing approved changes            |
| complete        | Workflow finished                     |

### Enhanced Status with Workflow Progress

The status command now includes workflow progress information:

    corrum status --proposal "..." --json

Returns workflow progress with phases_complete, phases_pending, progress_pct, and reviews tracking.

## Configuration

Config file: .corrum-config.toml
Database: .corrum.db (SQLite)
Docs: docs/corrum/ (proposals, reviews, decisions)

## Example Session

    # 1. Check if review needed
    corrum analyze --task "Add JWT authentication to user endpoints"

    # 2. Create proposal (if required)
    corrum propose --title "jwt-auth" --content "..."

    # 3. Get review command
    corrum next --proposal "20251127-jwt-auth"

    # 4. After getting review from codex, record it
    corrum add-review --proposal "20251127-jwt-auth" --agent codex --vote APPROVE --content "..."

    # 5. Check status
    corrum status --proposal "20251127-jwt-auth"

    # 6. Implement and mark complete
    corrum complete --proposal "20251127-jwt-auth"
`;

export const guideCommand = new Command('guide')
  .description('Show comprehensive guide for using Corrum')
  .option('--json', 'Output as JSON')
  .action((options) => {
    if (options.json) {
      console.log(JSON.stringify({
        guide: GUIDE_TEXT,
        commands: [
          { name: 'run', description: 'Full automated workflow with visual progress', example: 'corrum run --task "Add auth" --mock', options: ['--dry-run: Preview without execution', '--mock: Simulate agent responses', '--skip-implementation: Stop after approval', '--json: Output JSON with progress events', '--timeout <ms>: Agent timeout'] },
          { name: 'analyze', description: 'Check if task needs Corrum review', example: 'corrum analyze --task "Add auth" --progress --json' },
          { name: 'workflow', description: 'Get workflow state with progress events', example: 'corrum workflow --task "Add auth" --progress --json' },
          { name: 'propose', description: 'Create a new proposal', example: 'corrum propose --title "feature-name" --content "..."' },
          { name: 'prompt', description: 'Generate role-specific prompts for agents', example: 'corrum prompt --role reviewer --proposal "ID" --json' },
          { name: 'next', description: 'Get next action for a proposal', example: 'corrum next --proposal "ID"' },
          { name: 'add-review', description: 'Record a review', example: 'corrum add-review --proposal "ID" --agent codex --vote APPROVE' },
          { name: 'decide', description: 'Record final decision', example: 'corrum decide --proposal "ID" --outcome approved' },
          { name: 'complete', description: 'Mark as implemented', example: 'corrum complete --proposal "ID"' },
          { name: 'status', description: 'Check proposal status with workflow progress', example: 'corrum status --proposal "ID" --progress --json' },
          { name: 'list', description: 'List proposals', example: 'corrum list --status approved' },
          { name: 'stats', description: 'Show statistics', example: 'corrum stats' },
          { name: 'verify', description: 'Verify implementation', example: 'corrum verify --proposal "ID"' }
        ],
        prompt_command: {
          description: 'Generate role-specific prompts with expertise focus for Claude Code Task agents',
          roles: ['planner', 'reviewer', 'arbiter', 'implementer'],
          examples: {
            planner: 'corrum prompt --role planner --task "Add JWT auth" --json',
            reviewer: 'corrum prompt --role reviewer --proposal "ID" --json',
            arbiter: 'corrum prompt --role arbiter --proposal "ID" --json',
            implementer: 'corrum prompt --role implementer --proposal "ID" --json'
          }
        },
        triggers: {
          user_request_patterns: ['use corrum', 'code review', 'review this', 'need review', 'multi-agent review'],
          keywords: ['auth', 'authentication', 'password', 'token', 'jwt', 'security', 'sql', 'database', 'migration', 'api', 'payment', 'delete'],
          file_patterns: ['**/auth/**', '**/routers/**', '**/*.sql']
        },
        roles: {
          planner: 'claude (default)',
          reviewer: 'codex (default)',
          arbiters: ['gemini', 'claude'],
          implementer: 'claude (default)'
        },
        expertise_system: {
          description: 'Expertise profiles are model-agnostic. They define WHAT to focus on, while roles define WHICH model to use.',
          profiles: {
            security: { keywords: ['auth', 'authentication', 'password', 'token', 'jwt', 'security', 'encrypt', 'hash'], focus: 'Auth bypass, injection, data exposure, OWASP top 10' },
            database: { keywords: ['sql', 'database', 'migration', 'schema', 'transaction', 'query'], focus: 'Data integrity, transactions, N+1 queries, migrations' },
            api: { keywords: ['api', 'endpoint', 'rest', 'graphql', 'route', 'versioning'], focus: 'Backwards compatibility, versioning, error handling' },
            performance: { keywords: ['performance', 'cache', 'optimize', 'latency', 'memory', 'scaling'], focus: 'Caching, memory leaks, algorithmic complexity' },
            frontend: { keywords: ['react', 'vue', 'component', 'ui', 'accessibility', 'a11y'], focus: 'Accessibility (WCAG), responsive design, state management' },
            payments: { keywords: ['payment', 'billing', 'subscription', 'stripe', 'invoice'], focus: 'PCI compliance, idempotency, audit trails, fraud prevention' },
            general: { keywords: [], focus: 'Code quality, maintainability, testing, best practices' }
          },
          models: {
            claude: {
              cli: 'claude',
              family: 'anthropic',
              headlessFlag: '-p',
              extraFlags: ['--dangerously-skip-permissions'],
              note: 'Permission bypass for automated execution. Note: --tools is NOT used (variadic flag consumes prompt)'
            },
            codex: {
              cli: 'codex',
              family: 'openai',
              headlessFlag: 'exec',
              extraFlags: ['--dangerously-auto-approve', '--sandbox', 'none', '--quiet'],
              note: 'Sandbox bypass flags for automated execution'
            },
            gemini: { cli: 'gemini', family: 'google', headlessFlag: '' }
          },
          claude_headless_mode: {
            description: 'Claude runs with permission bypass flags for automated execution',
            default_command: 'claude -p --dangerously-skip-permissions "prompt"',
            fast_mode_command: 'claude -p --dangerously-skip-permissions --setting-sources "" "prompt"',
            flags: {
              '-p': 'Print mode (non-interactive output)',
              '--dangerously-skip-permissions': 'Bypass permission checks for automated execution',
              '--setting-sources ""': 'Skip loading project context (CLAUDE.md, etc.) - used with --fast flag'
            },
            notes: [
              '--tools flag is NOT used (variadic option consumes the prompt argument)',
              'Claude CLI still reads directory context (CLAUDE.md, etc.) which adds processing time',
              'Use --fast flag to skip project context for faster responses',
              'Use --mock mode for testing without real CLI tools'
            ]
          },
          codex_sandbox_bypass: {
            description: 'Codex runs with sandbox bypass flags by default for automated execution',
            default_command: 'codex exec --dangerously-auto-approve --sandbox none --quiet "prompt"',
            flags: {
              '--dangerously-auto-approve': 'Auto-approve tool calls without prompting',
              '--sandbox none': 'Disable sandbox restrictions',
              '--quiet': 'Suppress interactive UI elements'
            },
            full_bypass: '--dangerously-bypass-approvals-and-sandbox',
            docs: 'https://developers.openai.com/codex/cli/reference/'
          },
          how_it_works: [
            '1. Expertise matching determines WHAT domain focus is relevant (security, database, etc.)',
            '2. Role configuration determines WHICH models to use (planner=claude, reviewers=[codex])',
            '3. The matched expertise promptFocus is injected into whichever models are assigned'
          ]
        },
        votes: ['APPROVE', 'REJECT', 'REVISE'],
        consensus_modes: {
          available: ['majority', 'unanimous'],
          default: 'majority',
          behavior: {
            majority: {
              description: 'Simple majority wins',
              examples: [
                { votes: '2 APPROVE + 1 REJECT', result: 'approved' },
                { votes: '2 REJECT + 1 APPROVE', result: 'rejected' },
                { votes: '1 APPROVE + 1 REJECT', result: 'disputed (tie)' }
              ]
            },
            unanimous: {
              description: 'All reviewers must agree',
              examples: [
                { votes: '3 APPROVE', result: 'approved' },
                { votes: '3 REJECT', result: 'rejected' },
                { votes: '2 APPROVE + 1 REJECT', result: 'disputed' }
              ]
            },
            revise: {
              description: 'Any REVISE vote triggers revision regardless of mode',
              examples: [
                { votes: '2 APPROVE + 1 REVISE', result: 'revise' }
              ]
            }
          },
          natural_language_triggers: {
            unanimous: ['all agree', 'all to agree', 'must all agree', 'everyone agree', 'unanimous', 'full agreement', 'complete agreement', 'all agents agree', 'all agents to agree', 'all must approve', 'everyone must approve', 'all reviewers agree', 'need all to agree', 'require unanimous', 'require all'],
            majority: ['majority', 'majority vote', 'majority wins', 'most agree', 'majority rules', 'simple majority']
          }
        },
        progress_events: {
          description: 'Real-time workflow feedback via NDJSON events to stderr',
          flag: '--progress',
          supported_commands: ['analyze', 'workflow', 'status'],
          event_types: [
            'workflow_started',
            'workflow_complete',
            'workflow_error',
            'phase_started',
            'phase_complete',
            'analysis_complete',
            'expertise_matched',
            'proposal_created',
            'review_requested',
            'review_received',
            'consensus_checked',
            'consensus_reached',
            'dispute_detected',
            'arbiter_invoked',
            'arbiter_decision',
            'implementation_started',
            'implementation_complete',
            'human_escalation'
          ],
          phases: ['analysis', 'planning', 'review', 'consensus', 'arbitration', 'implementation', 'complete'],
          example: {
            command: 'corrum workflow --task "Add JWT auth" --progress --json',
            stderr_events: [
              '{"event":"workflow_started","task":"Add JWT auth","phase":"analysis","timestamp":"..."}',
              '{"event":"expertise_matched","expertise":"security","score":6,"promptFocus":"..."}',
              '{"event":"analysis_complete","requiresReview":true,"expertise":"security","triggers":["auth","jwt"]}',
              '{"event":"phase_complete","phase":"analysis"}'
            ],
            stdout_result: 'JSON object with workflow_state, analysis, assigned_agents, etc.'
          }
        },
        workflow_command: {
          description: 'Get workflow state with real-time progress events',
          options: {
            task: 'Start new workflow with task description',
            proposal: 'Get state for existing proposal',
            progress: 'Emit NDJSON progress events to stderr',
            json: 'Output results as JSON to stdout'
          },
          examples: {
            new_workflow: 'corrum workflow --task "Add JWT auth" --progress --json',
            existing_proposal: 'corrum workflow --proposal "20251127-jwt" --json',
            list_active: 'corrum workflow --json'
          }
        },
        run_command: {
          description: 'Full automated workflow with visual progress and agent execution',
          options: {
            task: 'Required. Task description',
            files: 'Files that will be modified',
            consensus_mode: 'majority or unanimous',
            dry_run: 'Preview without executing agents (shows what would happen)',
            mock: 'Simulate agent responses for testing (no real CLIs needed)',
            fast: 'Skip loading project context (CLAUDE.md) for faster agent responses',
            verbose: 'Show detailed progress (default: true)',
            json: 'Output JSON results, emit progress events',
            timeout: 'Agent execution timeout in ms (default: 600000)',
            skip_implementation: 'Stop after approval, don\'t implement'
          },
          execution_modes: {
            dry_run: 'Shows what would happen without any execution',
            mock: 'Simulates agent responses for testing (no real CLIs needed)',
            fast: 'Skip project context for faster responses (--setting-sources "")',
            real: 'Actually executes AI agents (requires claude/codex/gemini CLIs)'
          },
          examples: {
            dry_run: 'corrum run --task "Add JWT auth" --dry-run',
            mock: 'corrum run --task "Add JWT auth" --mock',
            fast: 'corrum run --task "Add JWT auth" --fast',
            full_execution: 'corrum run --task "Add JWT auth"',
            with_options: 'corrum run --task "Add JWT auth" --consensus-mode unanimous --timeout 600000',
            mock_with_json: 'corrum run --task "Add JWT auth" --mock --json'
          },
          visual_output: {
            phase_icons: '🔍 → 📝 → 👀 → 🤝 → 🔨 → ✅',
            features: ['Spinners during agent execution', 'Color-coded vote display', 'Expertise matching with focus areas', 'Total execution time']
          },
          phases: ['analysis', 'planning', 'review', 'consensus', 'implementation']
        }
      }, null, 2));
    } else {
      console.log(GUIDE_TEXT);
    }
  });
