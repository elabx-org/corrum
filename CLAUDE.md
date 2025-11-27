# Corrum - Multi-Agent Code Review Orchestrator

## What is Corrum?

Corrum is a CLI tool that orchestrates multi-agent AI code reviews. It decides when reviews are needed, assigns roles, tracks state, and tells you what to do next.

## When to Use Corrum

Before implementing any task, run:

```bash
corrum analyze --task "your task description"
```

If `requires_corrum: true`, follow the Corrum workflow. If `false`, proceed with implementation.

## Corrum Workflow

### 1. Analyze the Task
```bash
corrum analyze --task "Add authentication to API" --files "src/auth/*.ts"
```

### 2. Create a Proposal (if required)
```bash
corrum propose --title "api-authentication" --content "$(cat << 'EOF'
# Proposal: API Authentication

## Summary
Add JWT-based authentication to all API endpoints.

## Implementation Plan
1. Add auth middleware
2. Create login/logout endpoints
3. Add token refresh mechanism

## Security Considerations
- Use secure token storage
- Implement rate limiting on auth endpoints
EOF
)"
```

### 3. Get Next Action
```bash
corrum next --proposal "20251127-api-authentication"
```

### 4. Request Review (run the generated command)
The `next` command will output a command to request review from another agent (e.g., Codex).

### 5. Record the Review
```bash
corrum add-review \
  --proposal "20251127-api-authentication" \
  --agent codex \
  --vote APPROVE \
  --content "Review content here"
```

### 6. Check Status
```bash
corrum status --proposal "20251127-api-authentication"
```

### 7. Mark Complete After Implementation
```bash
corrum complete --proposal "20251127-api-authentication"
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `corrum analyze --task "..."` | Check if Corrum review needed |
| `corrum propose --title "..."` | Create a proposal |
| `corrum next --proposal "..."` | Get next action |
| `corrum add-review --proposal "..." --agent X --vote Y` | Record review |
| `corrum status` | Show all proposals |
| `corrum status --proposal "..."` | Show specific proposal |
| `corrum complete --proposal "..."` | Mark as implemented |

## Triggers

Corrum review is automatically required for tasks involving:
- **Security**: auth, password, token, jwt, encrypt, security
- **Database**: sql, database, migration, schema
- **API**: api, endpoint, public
- **Sensitive**: payment, billing, delete, drop

## Roles

- **Planner** (default: Claude): Creates proposals
- **Reviewer** (default: Codex): Reviews proposals
- **Arbiter** (Gemini/Claude): Resolves disputes

## JSON Output

All commands support `--json` for machine-readable output:
```bash
corrum analyze --task "Add auth" --json
```
