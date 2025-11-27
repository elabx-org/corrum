# Corrum Package Specification

**Version**: 0.1.0 (Draft)
**Status**: Planning
**Created**: 2025-11-27
**Author**: Human + Claude Code

---

## Executive Summary

Corrum is an npm package that acts as a **meta-orchestrator** for multi-agent AI code reviews. It manages the workflow, decides when reviews are needed, assigns roles, tracks state, and tells Claude Code (or other AI agents) what to do next.

**Key Principle**: Corrum handles the *process*, AI agents handle the *thinking*.

---

## Problem Statement

Currently, the Corrum multi-agent review workflow is:
- **Manual**: Claude Code must remember when to use it
- **Inconsistent**: Different projects may implement it differently
- **Stateless**: No tracking of proposal status across sessions
- **Undocumented decisions**: Hard to query "why was this approved?"

---

## Solution

An npm package that:
1. **Decides** if a task needs Corrum review (based on rules)
2. **Assigns** roles (planner, reviewer, arbiter)
3. **Tracks** workflow state (draft → review → approved → implemented)
4. **Generates** commands for Claude Code to execute
5. **Enforces** rules (cross-model arbitration, max iterations)
6. **Queries** history and status

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User                                 │
│              "Add rate limiting to uploads"                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code (Brain)                       │
│  - Understands task requirements                             │
│  - Generates proposal/review CONTENT                         │
│  - Executes AI CLI commands (codex, gemini)                  │
│  - Implements approved solutions                             │
└──────────────────────────┬──────────────────────────────────┘
                           │ calls
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Corrum Package (Director)                   │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Analyzer   │  │   State     │  │   Roles     │          │
│  │  Engine     │  │   Machine   │  │   Engine    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Template   │  │   Config    │  │   Storage   │          │
│  │  Generator  │  │   Loader    │  │   Layer     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## CLI Commands

### `corrum init`

Initialize Corrum in a project.

```bash
npx corrum init [--force]
```

**Creates**:
- `.corrum-config.toml` - Configuration file
- `docs/corrum/` - Directory structure
- `docs/corrum/templates/` - Customizable templates

**Output**:
```
✓ Created .corrum-config.toml
✓ Created docs/corrum/proposals/
✓ Created docs/corrum/reviews/
✓ Created docs/corrum/decisions/
✓ Created docs/corrum/verifications/
✓ Corrum initialized successfully!
```

---

### `corrum analyze`

Analyze a task to determine if Corrum review is needed.

```bash
npx corrum analyze --task "Add rate limiting to photo uploads"
npx corrum analyze --task "Fix typo in README"
npx corrum analyze --task "Add auth feature" --force --planner gemini
```

**Options**:
| Flag | Description |
|------|-------------|
| `--task` | Task description (required) |
| `--files` | Files that will be modified (optional, improves accuracy) |
| `--force` | Force Corrum review regardless of rules |
| `--skip` | Skip Corrum review regardless of rules |
| `--planner` | Override default planner (claude/codex/gemini) |

**Output** (JSON):
```json
{
  "requires_corrum": true,
  "reason": "Matched keywords: ['rate limit'], Security-related task",
  "confidence": 0.85,
  "matched_rules": {
    "keywords": ["rate limit"],
    "file_patterns": [],
    "complexity": null
  },
  "assigned_roles": {
    "planner": "claude",
    "reviewers": ["codex"],
    "arbiter": null
  },
  "next_action": "create_proposal",
  "instructions": "Create a proposal document covering security implications, performance impact, and alternative approaches."
}
```

---

### `corrum propose`

Create a new proposal.

```bash
npx corrum propose \
  --title "photo-upload-rate-limit" \
  --content "$(cat proposal.md)"

# Or from stdin
cat proposal.md | npx corrum propose --title "photo-upload-rate-limit"

# Or interactive (opens editor)
npx corrum propose --title "photo-upload-rate-limit" --edit
```

**Options**:
| Flag | Description |
|------|-------------|
| `--title` | Short kebab-case title (required) |
| `--content` | Proposal content in markdown |
| `--edit` | Open in $EDITOR |
| `--template` | Use custom template |

**Output** (JSON):
```json
{
  "proposal_id": "20251127-photo-upload-rate-limit",
  "file": "docs/corrum/proposals/20251127-photo-upload-rate-limit.md",
  "status": "draft",
  "created_at": "2025-11-27T10:30:00Z",
  "next_action": "request_review",
  "review_command": "codex exec \"Review docs/corrum/proposals/20251127-photo-upload-rate-limit.md for security vulnerabilities, edge cases, and alternative approaches. Vote: APPROVE/REJECT/REVISE. Save to docs/corrum/reviews/20251127-photo-upload-rate-limit-codex.md\""
}
```

---

### `corrum next`

Get the next action for a proposal.

```bash
npx corrum next --proposal "20251127-photo-upload-rate-limit"
```

**Output** (JSON):
```json
{
  "proposal_id": "20251127-photo-upload-rate-limit",
  "status": "pending_review",
  "next_action": "request_review",
  "agent": "codex",
  "command": "codex exec \"Review docs/corrum/proposals/20251127-photo-upload-rate-limit.md...\"",
  "instructions": "Run the above command and record the review using 'corrum add-review'"
}
```

**Possible `next_action` values**:
| Action | Description |
|--------|-------------|
| `create_proposal` | Need to create proposal document |
| `request_review` | Need to get review from specified agent |
| `revise_proposal` | Address feedback and update proposal |
| `invoke_arbiter` | Disagreement - need tie-breaker |
| `implement` | Approved - proceed with implementation |
| `escalate_human` | No consensus - human decision needed |
| `mark_complete` | Implementation done - mark as complete |

---

### `corrum add-review`

Record a review from an agent.

```bash
npx corrum add-review \
  --proposal "20251127-photo-upload-rate-limit" \
  --agent codex \
  --vote APPROVE \
  --content "$(cat review.md)"
```

**Options**:
| Flag | Description |
|------|-------------|
| `--proposal` | Proposal ID (required) |
| `--agent` | Reviewing agent: claude/codex/gemini (required) |
| `--vote` | APPROVE/REJECT/REVISE (required) |
| `--content` | Review content in markdown |
| `--severity` | Override detected severity counts |

**Output** (JSON):
```json
{
  "proposal_id": "20251127-photo-upload-rate-limit",
  "review_file": "docs/corrum/reviews/20251127-photo-upload-rate-limit-codex.md",
  "votes": [
    {"agent": "codex", "vote": "APPROVE", "recorded_at": "2025-11-27T10:45:00Z"}
  ],
  "consensus": true,
  "status": "approved",
  "next_action": "implement",
  "checklist": [
    "Implement rate limiting in backend/app/routers/photos.py",
    "Add tests for rate limiting",
    "Update documentation"
  ]
}
```

---

### `corrum decide`

Record final decision for a proposal.

```bash
npx corrum decide \
  --proposal "20251127-photo-upload-rate-limit" \
  --outcome approved \
  --summary "Implemented hybrid IP + user-based rate limiting"
```

**Options**:
| Flag | Description |
|------|-------------|
| `--proposal` | Proposal ID (required) |
| `--outcome` | approved/rejected/deferred (required) |
| `--summary` | Decision summary |

**Output**:
```json
{
  "proposal_id": "20251127-photo-upload-rate-limit",
  "decision_file": "docs/corrum/decisions/20251127-photo-upload-rate-limit.md",
  "outcome": "approved",
  "recorded_at": "2025-11-27T11:00:00Z"
}
```

---

### `corrum complete`

Mark a proposal as implemented.

```bash
npx corrum complete --proposal "20251127-photo-upload-rate-limit"
```

**Output**:
```json
{
  "proposal_id": "20251127-photo-upload-rate-limit",
  "status": "implemented",
  "completed_at": "2025-11-27T14:00:00Z",
  "duration": "3h 30m"
}
```

---

### `corrum status`

Check status of a proposal or all proposals.

```bash
# Specific proposal
npx corrum status --proposal "20251127-photo-upload-rate-limit"

# All proposals
npx corrum status
```

**Output** (single proposal):
```json
{
  "proposal_id": "20251127-photo-upload-rate-limit",
  "title": "Photo Upload Rate Limit",
  "status": "approved",
  "created_at": "2025-11-27T10:30:00Z",
  "planner": "claude",
  "reviewers": ["codex"],
  "votes": [
    {"agent": "codex", "vote": "APPROVE"}
  ],
  "iterations": 1,
  "next_action": "implement"
}
```

**Output** (all proposals - table format):
```
ID                                  Status      Votes       Next Action
──────────────────────────────────────────────────────────────────────────
20251127-photo-upload-rate-limit    approved    codex:✓     implement
20251126-dark-mode-toggle           review      -           request_review
20251125-auth-refactor              rejected    codex:✗     escalate_human
```

---

### `corrum list`

List proposals with filters.

```bash
npx corrum list
npx corrum list --status pending
npx corrum list --status approved --not-implemented
npx corrum list --since 2025-11-01
npx corrum list --planner gemini
```

**Options**:
| Flag | Description |
|------|-------------|
| `--status` | Filter by status |
| `--not-implemented` | Only approved but not implemented |
| `--since` | Filter by date |
| `--planner` | Filter by planner agent |
| `--format` | Output format: table/json/csv |

---

### `corrum stats`

Show Corrum metrics and statistics.

```bash
npx corrum stats
npx corrum stats --since 2025-11-01
```

**Output**:
```
Corrum Statistics
─────────────────────────────────────
Total Proposals:        15
  Approved:             12 (80%)
  Rejected:              2 (13%)
  Pending:               1 (7%)

Reviews:
  Total Reviews:        28
  Avg per Proposal:     1.9
  Arbiter Invocations:  3

Issues Found:
  Critical:              1
  High:                  5
  Medium:               12
  Low:                   8

Agents:
  Claude (planner):     12 proposals
  Codex (reviewer):     15 reviews
  Gemini (arbiter):      3 decisions

Avg Time to Approval:   2.3 hours
```

---

### `corrum verify`

Run post-implementation verification.

```bash
npx corrum verify --proposal "20251127-photo-upload-rate-limit"
```

Generates verification command for reviewer to check implementation matches proposal.

---

## Configuration

### `.corrum-config.toml`

```toml
# Corrum Configuration
# Docs: https://github.com/your-org/corrum

[corrum]
enabled = true
version = "0.1.0"

# ─────────────────────────────────────────────────────────────
# TRIGGERS - When to automatically require Corrum review
# ─────────────────────────────────────────────────────────────

[triggers]
# Keywords in task description that trigger Corrum
keywords = [
  "auth", "authentication", "authorization",
  "password", "token", "jwt", "session",
  "security", "encrypt", "decrypt", "hash",
  "sql", "database", "migration", "schema",
  "rate limit", "rate-limit", "throttle",
  "payment", "billing", "subscription",
  "api", "endpoint", "public",
  "delete", "remove", "drop"
]

# File patterns that trigger Corrum when modified
file_patterns = [
  "**/auth/**",
  "**/routers/**",
  "**/models.py",
  "**/schemas.py",
  "alembic/versions/**",
  "**/middleware/**",
  "**/*.sql"
]

# Complexity threshold (1-10, triggers if above)
complexity_threshold = 7

# ─────────────────────────────────────────────────────────────
# ROLES - Agent assignment
# ─────────────────────────────────────────────────────────────

[roles]
# Default planner (creates proposals)
default_planner = "claude"

# Default reviewers (in order)
default_reviewers = ["codex"]

# Arbiter selection strategy: "round-robin" | "least-used" | "specific"
arbiter_strategy = "round-robin"

# Available arbiters (must be different model family than reviewer)
arbiters = ["gemini", "claude"]

# ─────────────────────────────────────────────────────────────
# RULES - Workflow rules
# ─────────────────────────────────────────────────────────────

[rules]
# Maximum revision iterations before escalating
max_iterations = 2

# Require unanimous approval (false = majority)
require_unanimous = false

# Auto-skip Corrum for trivial changes
auto_skip_trivial = true

# Trivial patterns (skip Corrum)
trivial_patterns = [
  "typo", "typos",
  "comment", "comments",
  "readme", "documentation",
  "formatting", "style"
]

# ─────────────────────────────────────────────────────────────
# PATHS - File locations
# ─────────────────────────────────────────────────────────────

[paths]
# Base directory for Corrum documents
base_dir = "docs/corrum"

# Subdirectories
proposals_dir = "proposals"
reviews_dir = "reviews"
decisions_dir = "decisions"
verifications_dir = "verifications"

# ─────────────────────────────────────────────────────────────
# TEMPLATES - Document templates
# ─────────────────────────────────────────────────────────────

[templates]
# Use custom templates (relative to base_dir)
proposal = "templates/proposal.md"
review = "templates/review.md"
decision = "templates/decision.md"

# ─────────────────────────────────────────────────────────────
# AGENTS - AI CLI configuration
# ─────────────────────────────────────────────────────────────

[agents.claude]
cli = "claude"
headless_flag = "-p"
model_family = "anthropic"

[agents.codex]
cli = "codex"
headless_flag = "exec"
model_family = "openai"

[agents.gemini]
cli = "gemini"
headless_flag = ""
model_family = "google"

# ─────────────────────────────────────────────────────────────
# STORAGE - State persistence
# ─────────────────────────────────────────────────────────────

[storage]
# Storage backend: "json" | "sqlite"
backend = "json"

# State file location
state_file = ".corrum-state.json"

# ─────────────────────────────────────────────────────────────
# NOTIFICATIONS (future)
# ─────────────────────────────────────────────────────────────

[notifications]
enabled = false
# slack_webhook = ""
# email = ""
```

---

## State Machine

### Proposal Lifecycle

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
┌───────┐    ┌──────────────┐    ┌────────────┐    ┌─────────┴───┐
│ draft │───▶│pending_review│───▶│  approved  │───▶│ implemented │
└───────┘    └──────────────┘    └────────────┘    └─────────────┘
                    │                   ▲
                    │                   │
                    ▼                   │
             ┌────────────┐             │
             │  revision  │─────────────┘
             └────────────┘
                    │
                    │ (max iterations)
                    ▼
             ┌────────────┐
             │  disputed  │
             └────────────┘
                    │
          ┌────────┴────────┐
          ▼                 ▼
   ┌────────────┐    ┌────────────┐
   │  rejected  │    │  escalated │
   └────────────┘    └────────────┘
```

### State Transitions

| From | To | Trigger |
|------|-----|---------|
| `draft` | `pending_review` | Proposal created |
| `pending_review` | `approved` | All reviewers APPROVE |
| `pending_review` | `revision` | Any reviewer votes REVISE |
| `pending_review` | `disputed` | Conflicting votes |
| `revision` | `pending_review` | Proposal revised |
| `revision` | `escalated` | Max iterations reached |
| `disputed` | `approved` | Arbiter votes APPROVE |
| `disputed` | `rejected` | Arbiter votes REJECT |
| `approved` | `implemented` | Implementation complete |

---

## Project Structure

```
corrum/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
│
├── src/
│   ├── index.ts                 # Main exports
│   ├── cli.ts                   # CLI entry point (commander)
│   │
│   ├── commands/                # CLI command handlers
│   │   ├── init.ts
│   │   ├── analyze.ts
│   │   ├── propose.ts
│   │   ├── next.ts
│   │   ├── add-review.ts
│   │   ├── decide.ts
│   │   ├── complete.ts
│   │   ├── status.ts
│   │   ├── list.ts
│   │   ├── stats.ts
│   │   └── verify.ts
│   │
│   ├── core/                    # Core logic
│   │   ├── analyzer.ts          # Task analysis engine
│   │   ├── state-machine.ts     # XState workflow
│   │   ├── roles.ts             # Role assignment logic
│   │   ├── consensus.ts         # Vote counting & rules
│   │   └── command-generator.ts # AI CLI command generation
│   │
│   ├── config/                  # Configuration
│   │   ├── loader.ts            # TOML config loader
│   │   ├── schema.ts            # Config validation (zod)
│   │   └── defaults.ts          # Default configuration
│   │
│   ├── storage/                 # State persistence
│   │   ├── index.ts             # Storage interface
│   │   ├── json-storage.ts      # JSON file backend
│   │   └── sqlite-storage.ts    # SQLite backend (optional)
│   │
│   ├── templates/               # Document templates
│   │   ├── proposal.ts
│   │   ├── review.ts
│   │   └── decision.ts
│   │
│   ├── utils/                   # Utilities
│   │   ├── date.ts              # Date formatting (YYYYMMDD)
│   │   ├── markdown.ts          # Markdown parsing
│   │   ├── glob.ts              # File pattern matching
│   │   └── logger.ts            # Colored console output
│   │
│   └── types/                   # TypeScript types
│       ├── config.ts
│       ├── proposal.ts
│       ├── review.ts
│       └── state.ts
│
├── templates/                   # Default templates (copied on init)
│   ├── proposal.md
│   ├── review.md
│   └── decision.md
│
├── tests/
│   ├── analyzer.test.ts
│   ├── state-machine.test.ts
│   ├── roles.test.ts
│   ├── commands/
│   │   └── *.test.ts
│   └── fixtures/
│       └── *.toml
│
└── docs/
    ├── getting-started.md
    ├── configuration.md
    ├── cli-reference.md
    └── integration-guide.md
```

---

## Dependencies

### Production Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `commander` | CLI framework | ^12.0.0 |
| `xstate` | State machine | ^5.0.0 |
| `@iarna/toml` | TOML parsing | ^3.0.0 |
| `zod` | Schema validation | ^3.22.0 |
| `micromatch` | Glob pattern matching | ^4.0.5 |
| `chalk` | Terminal colors | ^5.3.0 |
| `ora` | Spinners | ^8.0.0 |
| `date-fns` | Date formatting | ^3.0.0 |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler |
| `vitest` | Testing framework |
| `@types/node` | Node.js types |
| `tsup` | Build tool |
| `eslint` | Linting |
| `prettier` | Formatting |

---

## Implementation Plan

### Phase 1: Foundation (MVP)
**Goal**: Basic working CLI

- [ ] Project setup (package.json, tsconfig, etc.)
- [ ] CLI framework with commander
- [ ] `corrum init` - create directory structure
- [ ] `corrum analyze` - basic keyword matching
- [ ] `corrum propose` - create proposal file
- [ ] `corrum status` - show proposal status
- [ ] JSON storage backend
- [ ] Basic config loading

**Deliverable**: Can create and track proposals

---

### Phase 2: Workflow Engine
**Goal**: Full state machine and review tracking

- [ ] XState state machine integration
- [ ] `corrum next` - determine next action
- [ ] `corrum add-review` - record reviews
- [ ] `corrum decide` - record decisions
- [ ] Vote counting and consensus logic
- [ ] Cross-model arbiter enforcement
- [ ] Command generation for AI CLIs

**Deliverable**: Full workflow from proposal to decision

---

### Phase 3: Intelligence
**Goal**: Smart task analysis

- [ ] File pattern matching for triggers
- [ ] Complexity analysis (optional ts-morph integration)
- [ ] Trivial task detection
- [ ] Improved role assignment logic
- [ ] Template customization

**Deliverable**: Accurate automatic Corrum triggering

---

### Phase 4: Polish
**Goal**: Production-ready

- [ ] `corrum list` with filters
- [ ] `corrum stats` with metrics
- [ ] `corrum verify` for post-implementation
- [ ] `corrum complete` for marking done
- [ ] SQLite storage backend (optional)
- [ ] Comprehensive tests
- [ ] Documentation
- [ ] npm publish

**Deliverable**: Published npm package

---

### Phase 5: Integrations (Future)
**Goal**: Ecosystem integration

- [ ] GitHub Actions integration
- [ ] VS Code extension
- [ ] Slack/Discord notifications
- [ ] Web dashboard
- [ ] Claude Code slash command (`/corrum`)

---

## API (Programmatic Usage)

For tools that want to use Corrum programmatically:

```typescript
import { Corrum } from 'corrum';

const corrum = new Corrum({
  configPath: '.corrum-config.toml',
  // or inline config
});

// Analyze a task
const analysis = await corrum.analyze({
  task: 'Add rate limiting to photo uploads',
  files: ['backend/app/routers/photos.py']
});

if (analysis.requires_corrum) {
  // Create proposal
  const proposal = await corrum.propose({
    title: 'photo-upload-rate-limit',
    content: proposalMarkdown
  });

  // Get next action
  const next = await corrum.next(proposal.id);
  console.log(next.command); // Command to run
}

// Add review
await corrum.addReview({
  proposalId: '20251127-photo-upload-rate-limit',
  agent: 'codex',
  vote: 'APPROVE',
  content: reviewMarkdown
});

// Check status
const status = await corrum.status('20251127-photo-upload-rate-limit');
```

---

## Open Questions

1. **Package name**: `corrum`, `corrum-cli`, `@org/corrum`?
2. **Storage default**: JSON file or SQLite?
3. **Complexity analysis**: Include ts-morph or keep lightweight?
4. **Claude Code integration**: Automatic via CLAUDE.md instructions or slash command?
5. **Multi-repo support**: Global config + per-project overrides?

---

## Success Criteria

1. **Functional**: All CLI commands work as specified
2. **Reliable**: State is never lost, even on crashes
3. **Fast**: Commands complete in <500ms
4. **Portable**: Works on macOS, Linux, Windows (WSL)
5. **Documented**: Clear docs for users and contributors
6. **Tested**: >80% code coverage

---

## References

- [Current Corrum Workflow](./CORRUM_WORKFLOW.md)
- [Quick Reference](./QUICK_REFERENCE.md)
- [XState Documentation](https://xstate.js.org/)
- [Commander.js](https://github.com/tj/commander.js)
- [Claude Code](https://www.npmjs.com/package/@anthropic-ai/claude-code)
- [Codex CLI](https://github.com/openai/codex)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)

---

## Changelog

### 2025-11-27 - Initial Draft
- Created specification document
- Defined CLI commands and options
- Designed state machine
- Outlined implementation phases
- Listed dependencies

---

**Document Status**: Draft - Ready for Review
**Next Steps**: Review with stakeholders, finalize package name, begin Phase 1
