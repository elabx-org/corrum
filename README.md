# Corrum

Meta-orchestrator for multi-agent AI code reviews.

Corrum manages the workflow, decides when reviews are needed, assigns roles, tracks state, and tells AI agents (Claude Code, Codex, Gemini) what to do next.

## Requirements

- Node.js >= 20.0.0
- npm >= 9.0.0

## Installation

### Option 1: GitHub Packages (Recommended)

```bash
# Add GitHub Packages registry to .npmrc
echo "@elabx-org:registry=https://npm.pkg.github.com" >> ~/.npmrc

# Authenticate (needs a GitHub token with read:packages scope)
npm login --scope=@elabx-org --registry=https://npm.pkg.github.com

# Install globally
npm install -g @elabx-org/corrum

# Or install in a project
npm install @elabx-org/corrum
```

### Option 2: npm link (Local Development)

```bash
# Clone and enter the directory
cd /path/to/corrum

# Install dependencies and build
npm install

# Link globally for current user (no root required)
npm run local:install

# Now 'corrum' command is available
corrum --help

# To uninstall
npm run local:uninstall
```

### Option 3: Direct Execution

```bash
# Run directly without installing globally
npm run dev -- --help

# Or after building
npm run build
node dist/cli.js --help
```

### Option 4: Local Path Install

From another project:

```bash
# Install from local path
npm install /path/to/corrum

# Or add to package.json
{
  "dependencies": {
    "corrum": "file:/path/to/corrum"
  }
}
```

## Quick Start

```bash
# Initialize Corrum in your project
corrum init

# Analyze a task to see if review is needed
corrum analyze --task "Add authentication to the API"

# Create a proposal
corrum propose --title "api-authentication" --content "$(cat proposal.md)"

# Get next action
corrum next --proposal "20251127-api-authentication"

# Record a review
corrum add-review \
  --proposal "20251127-api-authentication" \
  --agent codex \
  --vote APPROVE \
  --content "Looks good!"

# Check status
corrum status --proposal "20251127-api-authentication"

# Mark as complete after implementation
corrum complete --proposal "20251127-api-authentication"
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `corrum init` | Initialize Corrum in a project |
| `corrum analyze` | Analyze if a task needs review |
| `corrum propose` | Create a new proposal |
| `corrum next` | Get next action for a proposal |
| `corrum add-review` | Record a review from an agent |
| `corrum decide` | Record final decision |
| `corrum complete` | Mark proposal as implemented |
| `corrum status` | Check status of proposals |
| `corrum list` | List proposals with filters |
| `corrum stats` | Show metrics and statistics |
| `corrum verify` | Post-implementation verification |

All commands support `--json` flag for JSON output.

## Configuration

Configuration is stored in `.corrum-config.toml`:

```toml
[corrum]
enabled = true
version = "0.1.0"

[triggers]
keywords = ["auth", "security", "database", "api", "payment"]
file_patterns = ["**/auth/**", "**/routers/**", "**/*.sql"]

[roles]
default_planner = "claude"
default_reviewers = ["codex"]
arbiters = ["gemini", "claude"]

[rules]
max_iterations = 2
require_unanimous = false
auto_skip_trivial = true

[storage]
backend = "sqlite"
state_file = ".corrum.db"
```

## Programmatic Usage

```typescript
import { Corrum } from 'corrum';

const corrum = new Corrum();

// Analyze a task
const analysis = corrum.analyze({
  task: 'Add rate limiting to uploads',
  files: ['backend/app/routers/photos.py']
});

if (analysis.requiresCorrum) {
  console.log('Review required:', analysis.reason);
  console.log('Planner:', analysis.assignedRoles.planner);
}

corrum.close();
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- init

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Lint
npm run lint
```

## Project Structure

```
corrum/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── index.ts            # Library exports
│   ├── commands/           # CLI command handlers
│   ├── core/               # Core logic (analyzer, state machine, etc.)
│   ├── config/             # Configuration loading
│   ├── storage/            # SQLite storage backend
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utilities (logging, date, etc.)
├── templates/              # Default document templates
├── tests/                  # Test files
└── docs/                   # Documentation
```

## License

Private - Not for distribution.

## Credits

Created with Claude Code and Happy.
