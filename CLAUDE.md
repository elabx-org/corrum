# CLAUDE.md - Corrum Project Guide

This file contains important context for Claude Code when working on this project.

## Project Overview

**Corrum** is a multi-agent AI code review orchestrator. It manages the workflow for getting code reviews from multiple AI agents (Claude, Codex, Gemini), tracking proposals, reviews, decisions, and consensus.

**Key Principle**: Corrum is a workflow state manager, NOT an agent spawner. Claude Code (via its Task tool) handles agent orchestration, while Corrum tracks state.

## Architecture

```
Happy CLI → Claude Code (orchestrator) → Corrum (state manager)
                    ↓
            Task tool spawns agents
```

### Core Design Decisions

1. **Expertise is model-agnostic**: Expertise profiles define *what* domain to focus on (security, database, etc.), NOT which model runs it.

2. **Roles define models**: The `[roles]` config determines which AI CLI tool handles each role (planner, reviewer, arbiter).

3. **Focus injection**: The matched expertise's `promptFocus` is injected into whatever model is assigned to a role.

4. **State machine**: XState v5 manages proposal lifecycle (draft → pending_review → approved/rejected → implemented).

## Quick Start

```bash
# Initialize project
corrum init

# Check if review needed
corrum analyze --task "Add JWT authentication"

# Full automated workflow (dry-run to preview)
corrum run --task "Add JWT authentication" --dry-run

# Full automated workflow (actually execute agents)
corrum run --task "Add JWT authentication"

# Generate prompt for Claude Code Task tool
corrum prompt --role planner --task "Add JWT auth" --json

# Create proposal
corrum propose --title "jwt-auth" --content "..."

# Get next action
corrum next --proposal "20251127-jwt-auth"

# Record review
corrum add-review --proposal "..." --agent codex --vote APPROVE

# Check status
corrum status --proposal "..."
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `corrum init` | Initialize project with config and directories |
| `corrum analyze --task "..."` | Check if Corrum review is needed |
| `corrum run --task "..."` | **Full automated workflow** - executes agents, shows visual progress |
| `corrum workflow --task "..."` | Start workflow with progress events |
| `corrum prompt --role <role>` | Generate prompts for Task tool agents |
| `corrum propose --title "..."` | Create a proposal |
| `corrum add-review` | Record agent review |
| `corrum status --proposal "..."` | Check consensus status with workflow progress |
| `corrum guide` | Show full workflow guide |
| `corrum guide --json` | Get machine-readable documentation |

## The `run` Command (Full Automated Workflow)

The `run` command executes the complete Corrum workflow automatically, spawning AI agents and showing visual progress:

```bash
# Dry-run: preview what would happen without executing agents
corrum run --task "Add JWT authentication" --dry-run

# Full execution: actually run AI agents (claude, codex, gemini)
corrum run --task "Add JWT authentication"

# With options
corrum run --task "Add JWT auth" \
  --files "src/auth/**" \
  --consensus-mode unanimous \
  --timeout 600000 \
  --skip-implementation
```

### Options

| Option | Description |
|--------|-------------|
| `--task <description>` | Required. Task description |
| `--files <files...>` | Files that will be modified |
| `--consensus-mode <mode>` | `majority` or `unanimous` |
| `--dry-run` | Preview without executing agents (shows what would happen) |
| `--mock` | Use simulated agent responses for testing (no real CLIs needed) |
| `--verbose` | Show detailed progress (default: true) |
| `--json` | Output results as JSON, emit progress events |
| `--timeout <ms>` | Agent execution timeout (default: 300000) |
| `--skip-implementation` | Stop after approval, don't implement |

### Execution Modes

```bash
# DRY-RUN: Shows what would happen without any execution
corrum run --task "Add JWT auth" --dry-run

# MOCK: Simulates agent responses (for testing without real CLIs)
corrum run --task "Add JWT auth" --mock

# REAL: Actually executes AI agents (requires claude/codex/gemini CLIs)
corrum run --task "Add JWT auth"
```

**When to use each mode:**
- `--dry-run`: Preview workflow without any execution
- `--mock`: Test full workflow with simulated responses (useful when CLIs not installed)
- (no flag): Production use with real AI agents

### Visual Output

The run command shows real-time progress with:
- Phase icons: 🔍 → 📝 → 👀 → 🤝 → 🔨 → ✅
- Spinners during agent execution
- Color-coded vote display (✓ APPROVE, ✗ REJECT, ⚠ REVISE)
- Expertise matching with focus areas
- Total execution time

### Phases

1. **Analysis** - Check if review needed, match expertise
2. **Planning** - Execute planner agent to create proposal
3. **Review** - Execute reviewer agents in sequence
4. **Consensus** - Evaluate votes per consensus mode
5. **Implementation** - Execute implementer agent (if approved)

## The `prompt` Command (Claude Code Integration)

This is the key command for Claude Code orchestration:

```bash
# Generate planner prompt with expertise focus
corrum prompt --role planner --task "Add JWT auth" --json

# Generate reviewer prompt for existing proposal
corrum prompt --role reviewer --proposal "ID" --json

# Generate arbiter prompt for disputes
corrum prompt --role arbiter --proposal "ID" --json

# Generate implementer prompt after approval
corrum prompt --role implementer --proposal "ID" --json
```

Returns:
```json
{
  "role": "planner",
  "model": "claude",
  "expertise": "security",
  "promptFocus": "Focus on: OWASP top 10...",
  "prompt": "You are a technical planner...",
  "context": { ... }
}
```

## Expertise System

### Profiles (model-agnostic)

| Profile | Keywords | Focus |
|---------|----------|-------|
| security | auth, jwt, password, token | OWASP, injection, auth bypass |
| database | sql, migration, schema | Data integrity, N+1, transactions |
| api | endpoint, rest, graphql | Backwards compat, versioning |
| performance | cache, optimize, latency | Memory leaks, complexity |
| frontend | react, component, a11y | WCAG, responsive design |
| payments | stripe, billing, invoice | PCI, idempotency, fraud |
| general | (fallback) | Code quality, testing |

### How Matching Works

1. Task keywords are matched against expertise profiles
2. File patterns are matched (keywords weighted 2x vs patterns 1x)
3. Top expertise's `promptFocus` is injected into assigned agents
4. Roles config determines which model runs (not the expertise)

## Consensus Modes

- **majority** (default): Simple majority wins
- **unanimous**: All must agree

Natural language detection in task:
- "all agree", "unanimous", "must all agree" → unanimous mode
- "majority wins", "majority vote" → majority mode

Or explicit: `--consensus-mode unanimous`

## Triggers

Corrum review is automatically required for:

**User request patterns** (always triggers):
- "use corrum", "code review", "review this", "multi-agent review"

**Security keywords**: auth, password, token, jwt, encrypt, security

**Database keywords**: sql, database, migration, schema

**API keywords**: api, endpoint, public

**Sensitive operations**: payment, billing, delete, drop

**File patterns**: `**/auth/**`, `**/routers/**`, `**/*.sql`

## File Structure

```
src/
├── cli.ts              # Entry point
├── commands/           # CLI commands
│   ├── analyze.ts      # Task analysis (--progress flag)
│   ├── run.ts          # Full automated workflow with visual UI
│   ├── workflow.ts     # Workflow orchestration with progress events
│   ├── status.ts       # Status with workflow progress
│   ├── prompt.ts       # Generate agent prompts
│   ├── propose.ts      # Create proposals
│   ├── guide.ts        # Documentation
│   └── ...
├── core/
│   ├── analyzer.ts     # Task analysis + expertise matching
│   ├── expertise-matcher.ts  # Expertise scoring
│   ├── consensus.ts    # Vote evaluation (evaluateConsensus, evaluateConsensusSimple)
│   ├── events.ts       # Workflow event system (NDJSON progress)
│   ├── agent-executor.ts  # Spawn AI CLI tools (claude, codex, gemini)
│   └── state-machine.ts # XState proposal lifecycle
├── config/
│   ├── defaults.ts     # Default expertise, agent profiles
│   └── loader.ts       # Config file generation
├── storage/
│   └── sqlite.ts       # SQLite backend (better-sqlite3)
├── utils/
│   ├── ui.ts           # Visual UI: Spinners, ProgressBar, colors
│   └── logger.ts       # Logging utilities
└── types/
    ├── config.ts       # CorrumConfig, ExpertiseProfile, etc.
    └── state.ts        # AnalysisResult, ExpertiseAssignment
```

## Testing

```bash
npm test           # Run all 145 tests
npm run build      # Build with tsup
```

## Progress Events & Real-Time Feedback

Corrum supports emitting progress events to stderr in NDJSON format for real-time feedback to Claude Code.

### The `--progress` Flag

Add `--progress` to commands to emit workflow events:

```bash
# Workflow with progress events
corrum workflow --task "Add JWT auth" --progress --json

# Analyze with progress
corrum analyze --task "Add JWT auth" --progress --json

# Status with progress
corrum status --proposal "..." --progress --json
```

### Event Types

Events are emitted to **stderr** as NDJSON, while results go to **stdout**:

```json
{"event":"workflow_started","task":"Add JWT auth","phase":"analysis","timestamp":"..."}
{"event":"expertise_matched","phase":"analysis","expertise":"security","score":6,"promptFocus":"..."}
{"event":"analysis_complete","phase":"analysis","requiresReview":true,"expertise":"security","triggers":["auth","jwt"]}
{"event":"phase_complete","phase":"analysis","details":{...}}
{"event":"review_requested","phase":"review","agent":"codex","current":1,"total":1}
{"event":"review_received","phase":"review","agent":"codex","vote":"APPROVE","current":1,"total":1}
{"event":"consensus_reached","phase":"consensus","outcome":"approved","mode":"majority"}
{"event":"workflow_complete","status":"approved","proposalId":"...","phase":"complete"}
```

### Workflow Phases

| Phase | Description |
|-------|-------------|
| `analysis` | Task analysis and expertise matching |
| `planning` | Proposal creation |
| `review` | Collecting reviews from agents |
| `consensus` | Evaluating votes |
| `arbitration` | Dispute resolution |
| `implementation` | Executing approved changes |
| `complete` | Workflow finished |

### Enhanced Status Output

The `status` command now includes workflow progress:

```json
{
  "proposal_id": "...",
  "status": "pending_review",
  "workflow": {
    "current_phase": "review",
    "phases_complete": ["analysis", "planning"],
    "phases_pending": ["consensus", "implementation", "complete"],
    "progress_pct": 45,
    "reviews_received": 1,
    "reviews_expected": 2
  },
  "consensus": {
    "reached": false,
    "mode": "majority"
  }
}
```

## Claude Code Orchestration Flow

```typescript
// 1. Analyze task
const analysis = await bash('corrum analyze --task "..." --json');

// 2. Generate planner prompt with expertise focus
const plannerPrompt = await bash('corrum prompt --role planner --task "..." --json');

// 3. Spawn planner via Task tool
const proposal = await Task({ prompt: plannerPrompt.prompt, subagent_type: 'general-purpose' });

// 4. Record proposal
await bash('corrum propose --title "..." --content "..."');

// 5. Generate reviewer prompts
const reviewerPrompt = await bash('corrum prompt --role reviewer --proposal "..." --json');

// 6. Spawn reviewers in parallel via Task tool
const reviews = await Promise.all([
  Task({ prompt: reviewerPrompt.prompt, subagent_type: 'general-purpose' }),
  // more reviewers...
]);

// 7. Record reviews
await bash('corrum add-review --proposal "..." --agent codex --vote APPROVE --content "..."');

// 8. Check consensus
const status = await bash('corrum status --proposal "..." --json');

// 9. If approved, implement
if (status.status === 'approved') {
  const implPrompt = await bash('corrum prompt --role implementer --proposal "..." --json');
  await Task({ prompt: implPrompt.prompt, subagent_type: 'general-purpose' });
  await bash('corrum complete --proposal "..."');
}
```

## Configuration

Config file: `.corrum-config.toml`

Key sections:
- `[roles]` - Which models handle planner/reviewer/arbiter
- `[rules]` - consensus_mode (majority/unanimous), max_iterations
- `[expertise.*]` - Domain-specific focus areas (model-agnostic)
- `[agent_profiles.*]` - Model + role combinations
- `[models.*]` - AI CLI tool configurations

## NPM Package

- Package: `@elabx-org/corrum`
- Registry: GitHub Packages
- Repo: https://github.com/elabx-org/corrum

## Dependencies

- **commander**: CLI framework
- **xstate**: State machine (v5)
- **better-sqlite3**: SQLite storage
- **micromatch**: File pattern matching
- **@iarna/toml**: TOML config parsing
- **zod**: Schema validation

## Agent CLI Configuration

### Claude CLI Headless Mode

By default, Corrum runs claude with flags for headless operation:

```bash
claude -p --dangerously-skip-permissions --tools "" "prompt"
```

This is necessary because:
- The `-p` flag enables print mode (non-interactive)
- The `--dangerously-skip-permissions` flag bypasses permission checks for automated execution
- The `--tools ""` flag disables all tools (agent only needs to generate text)

**Customizing via config** (`.corrum-config.toml`):

```toml
[models.claude]
cli = "claude"
headlessFlag = "-p"
extraFlags = ["--dangerously-skip-permissions", "--tools", ""]
```

### Codex Sandbox Bypass

By default, Corrum runs codex with flags to bypass sandbox restrictions for automated execution:

```bash
codex exec --dangerously-auto-approve --sandbox none --quiet "prompt"
```

This is necessary because:
- Codex's sandbox can block file operations in automated contexts
- The `--dangerously-auto-approve` flag auto-approves tool calls
- The `--sandbox none` disables sandbox restrictions
- The `--quiet` flag suppresses interactive UI elements

**Customizing via config** (`.corrum-config.toml`):

```toml
[models.codex]
cli = "codex"
headlessFlag = "exec"
extraFlags = ["--dangerously-auto-approve", "--sandbox", "none", "--quiet"]
```

**Alternative: Full sandbox bypass** (for Docker/hardened environments):

```toml
[models.codex]
cli = "codex"
headlessFlag = ""
extraFlags = ["--dangerously-bypass-approvals-and-sandbox"]
```

See: https://developers.openai.com/codex/cli/reference/

## Development Notes

1. **Don't hardcode model-to-expertise bindings** - Keep expertise model-agnostic
2. **Use `corrum guide --json`** for machine-readable docs in automations
3. **Expertise matching is keyword-based** - Add keywords to expertise profiles
4. **145 tests must pass** before any changes
5. **Build before testing CLI** - `npm run build && node dist/cli.js`
6. **State in SQLite** - `.corrum.db` tracks proposals, reviews, decisions

## IMPORTANT: After Any Changes

**Always update the Corrum guide after implementing or making any changes:**

1. **Update `src/commands/guide.ts`** - Ensure the `guideCommand` output reflects new features, commands, or workflow changes
2. **Update this CLAUDE.md** - Add new commands, config options, or architecture changes
3. **Update `src/config/loader.ts`** - If config options changed, update `generateDefaultConfig()` so `corrum init` creates accurate configs
4. **Run tests** - `npm test` must pass (currently 145 tests)
5. **Rebuild** - `npm run build` to ensure CLI reflects changes

This ensures:
- `corrum guide` shows accurate, up-to-date documentation
- `corrum init` creates configs with all current options
- Future Claude Code sessions have accurate context in CLAUDE.md
