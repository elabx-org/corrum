import { Command } from 'commander';

const GUIDE_TEXT = `
# Corrum - Multi-Agent Code Review Orchestrator

## Overview
Corrum is a helper tool that manages multi-agent AI code reviews. It tracks proposals,
reviews, and decisions - letting AI agents focus on the actual analysis while Corrum
handles the workflow orchestration.

**Key principle**: Corrum helps manage the review process, it doesn't gatekeep.
When users ask for a review, Corrum always proceeds.

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
| analyze        | Check if task needs Corrum review          |
| propose        | Create a new proposal                       |
| next           | Get next action for a proposal             |
| add-review     | Record a review from an agent              |
| decide         | Record final decision (arbiter/human)      |
| complete       | Mark proposal as implemented               |
| status         | Check proposal status                       |
| list           | List all proposals with filters            |
| stats          | Show metrics and statistics                |
| verify         | Post-implementation verification           |
| guide          | Show this guide                            |

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

## Roles

- Planner (default: claude): Creates proposals
- Reviewer (default: codex): Reviews proposals, votes APPROVE/REJECT/REVISE
- Arbiter (gemini/claude): Resolves disputes when reviewers disagree
- Implementer (default: claude): Implements approved proposals

### Role Overrides

You can override roles when analyzing a task:

    corrum analyze --task "Add auth" --planner gemini --reviewer claude --implementer codex

This allows flexible agent assignment based on task needs.

## State Machine

Proposal lifecycle:
  draft → pending_review → approved → implemented
                        ↘ revision (if REVISE vote)
                        ↘ disputed (if conflicting votes) → arbiter decides

## JSON Output

All commands support --json flag for machine-readable output:

    corrum analyze --task "Add auth" --json
    corrum status --proposal "..." --json

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
          { name: 'analyze', description: 'Check if task needs Corrum review', example: 'corrum analyze --task "Add auth"' },
          { name: 'propose', description: 'Create a new proposal', example: 'corrum propose --title "feature-name" --content "..."' },
          { name: 'next', description: 'Get next action for a proposal', example: 'corrum next --proposal "ID"' },
          { name: 'add-review', description: 'Record a review', example: 'corrum add-review --proposal "ID" --agent codex --vote APPROVE' },
          { name: 'decide', description: 'Record final decision', example: 'corrum decide --proposal "ID" --outcome approved' },
          { name: 'complete', description: 'Mark as implemented', example: 'corrum complete --proposal "ID"' },
          { name: 'status', description: 'Check proposal status', example: 'corrum status --proposal "ID"' },
          { name: 'list', description: 'List proposals', example: 'corrum list --status approved' },
          { name: 'stats', description: 'Show statistics', example: 'corrum stats' },
          { name: 'verify', description: 'Verify implementation', example: 'corrum verify --proposal "ID"' }
        ],
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
        }
      }, null, 2));
    } else {
      console.log(GUIDE_TEXT);
    }
  });
