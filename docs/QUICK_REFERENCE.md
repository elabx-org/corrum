# Corrum Quick Reference Card

A cheat sheet for using the Corrum multi-agent review workflow.


---

## Using Expert Agents

The Implementer (Claude Code) can delegate sub-tasks to a team of specialized "expert agents." This is useful for complex tasks that can be broken down into smaller, well-defined units of work.

**Note on Autonomy**: The goal is for Claude Code to make these delegation decisions *autonomously*. The examples below show what Claude Code might do during an implementation, not necessarily commands you need to write.

### Example Invocations (by Claude Code)
```bash
# Delegate test generation to the testing_agent
testing_agent exec "Generate unit tests for the new feature in `[file_path]`."

# Delegate database migration to the db_agent
db_agent exec "Create a new migration script to add a 'last_login' column to the 'users' table."
```

### Encouraging Delegation (User Prompt)
You can encourage this behavior in your prompts to Claude Code:
```
"Implement the new analytics dashboard. Feel free to use expert agents for testing and database work if you think it's necessary."
```
These agents are defined in your `.corrum-config.toml` file.

---

## Dynamic Role Assignment

You can specify which model acts as the "Planner" for a task. The Planner is responsible for creating the initial proposal. If no planner is specified, Claude Code is the default.

### Invoking a Specific Planner
```
"Use Corrum with Gemini as the planner to [your task]"
"Use Corrum with Codex as the planner to [your task]"
```

This allows you to leverage the unique strengths of each model for the initial creative and design phase. The Implementer role (who writes the final code) typically remains as Claude Code.

---

## For Humans: How to Request Corrum Review

### Explicit Request
```
"Add rate limiting to photo uploads - use Corrum workflow"
```

### Implicit (Auto-Triggered)
Corrum automatically activates for:
- Security keywords: auth, password, token, sql, encryption
- Critical files: auth/, routers/, models.py, migrations
- Complex tasks (estimated 7+ complexity)

### Skip Corrum (Fast Track)
```
"Quick fix: typo in login button - skip Corrum"
```

---

## For Claude Code: Running Corrum

### Step 1: Create Proposal
```bash
# Save to: docs/corrum/proposals/YYYYMMDD-task-name.md
# Use template: docs/corrum/TEMPLATE_PROPOSAL.md
```

### Step 2: Invoke Codex Review
```bash
codex exec "Review the solution proposal in docs/corrum/proposals/20251122-photo-upload-rate-limit.md.

Analyze for:
1. Security vulnerabilities (OWASP Top 10)
2. Edge cases not considered
3. Better alternative approaches
4. Code quality and maintainability
5. Performance implications

Provide structured feedback with:
- Severity ratings (CRITICAL/HIGH/MEDIUM/LOW)
- Specific recommendations
- Alternative approaches if better
- Final vote: APPROVE | REJECT | REVISE

Save review to docs/corrum/reviews/20251122-photo-upload-rate-limit-codex.md"
```

### Step 3: Integration
- If **APPROVE**: Create decision document, implement
- If **REVISE**: Address feedback, iterate (max 2 times)
- If **REJECT** or **tie**: Invoke Arbiter (optional)

### Step 4: Invoke Arbiter (If Needed)

**IMPORTANT: Cross-Model Arbitration Rule**
The Arbiter MUST use a different model family than the Reviewer.

| If Reviewer is... | Then Arbiter can be... |
|---|---|
| Codex CLI (GPT) | Claude Code OR Gemini |
| Claude Code | Codex CLI (GPT) OR Gemini |
| Gemini | Claude Code OR Codex CLI (GPT) |

Same-model arbitration (e.g., GPT arbitrating GPT's review) is NOT allowed—it provides only simulated independence.

**See `TEMPLATE_ARBITER_PROMPT.md` and `TEMPLATE_GEMINI_ARBITER_PROMPT.md` for detailed Arbiter prompts and anti-bias guidelines.**

**When Codex was Reviewer, Claude Code arbitrates:**
Claude Code should read both documents, verify claims against actual code, then provide its own vote in the arbiter document following the template structure.

**When Claude Code was Reviewer, Codex arbitrates:**
```bash
codex exec --sandbox danger-full-access "You are a NEUTRAL ARBITER in Corrum. Your job is to break a tie between two AI agents.

CRITICAL NEUTRALITY RULES:
1. No recency bias - don't favor the last argument
2. No authority bias - both agents are equally credible
3. Steel-man both sides before deciding
4. Verify disputed claims against actual code
5. Base decision on technical facts, not persuasive language

DOCUMENTS:
- Proposal: docs/corrum/features/[feature]/YYYYMMDD-task.md
- Review: docs/corrum/features/[feature]/YYYYMMDD-task-codex.md
- Claude's response: [summarize position]

OUTPUT REQUIRED:
1. Neutral summary of dispute
2. Strongest arguments for EACH side
3. Issue-by-issue evaluation with evidence
4. Final VOTE: APPROVE or REJECT (not REVISE)
5. Confidence level and acknowledged limitations

Save to docs/corrum/features/[feature]/YYYYMMDD-task-arbiter.md"
```

### Step 5: Create Decision Document
```bash
# Save consensus to: docs/corrum/decisions/YYYYMMDD-task-name.md
```

### Step 6: Implementation
[Implement approved solution]

### Step 7: Post-Implementation Verification (Optional)
```bash
codex exec "Review the implemented changes for [feature name]. Verify:
1. Matches approved proposal
2. No security regressions
3. Follows project coding standards
4. All edge cases handled
5. Tests adequate

Save to docs/corrum/verifications/20251122-task-name.md"
```

---

## Voting System

### 2-Agent Corrum (Claude + Codex)
- **Both APPROVE** → Implement
- **One REJECT** → Revise or invoke Arbiter
- **Both REJECT** → Major revision or escalate to human

### 3-Agent Corrum (Claude + Codex + Arbiter)
- **2+ APPROVE** → Implement
- **2+ REJECT** → Major revision or escalate to human
- **All disagree** → Escalate to human

---

## File Naming Convention

```
YYYYMMDD-short-task-name.md

Examples:
20251122-photo-upload-rate-limit.md
20251122-email-notifications.md
20251123-oauth-integration.md
```

Use same base name across all stages:
```
proposals/20251122-photo-upload-rate-limit.md
reviews/20251122-photo-upload-rate-limit-codex.md
reviews/20251122-photo-upload-rate-limit-arbiter.md
decisions/20251122-photo-upload-rate-limit.md
verifications/20251122-photo-upload-rate-limit.md
```

---

## Severity Levels

### 🔴 CRITICAL
- **Security vulnerability** (SQL injection, XSS, auth bypass)
- **Data loss risk**
- **System unavailability**
- **Breaking change without migration**

**Action**: MUST fix before implementation

### 🟠 HIGH
- **Performance degradation** (significant)
- **Poor error handling** (user-facing)
- **Missing authorization checks**
- **Complex code without tests**

**Action**: SHOULD fix before implementation

### 🟡 MEDIUM
- **Edge cases** not handled
- **Code maintainability** concerns
- **Moderate coupling**
- **Documentation gaps**

**Action**: CONSIDER fixing, or document as known limitation

### 🟢 LOW
- **Code style** suggestions
- **Minor optimizations**
- **Nice-to-have features**
- **Documentation polish**

**Action**: Optional, can be deferred

---

## Common Review Focus Areas

### Security Review Checklist
- [ ] Authentication required?
- [ ] Authorization checks present?
- [ ] Input validation (SQL injection, XSS)?
- [ ] Rate limiting on sensitive endpoints?
- [ ] Secrets/credentials handling?
- [ ] File upload validation?
- [ ] CSRF protection (if needed)?
- [ ] Secure headers configured?

### Performance Review Checklist
- [ ] Database query efficiency (N+1 queries)?
- [ ] Proper indexing?
- [ ] Caching strategy?
- [ ] Bundle size impact (frontend)?
- [ ] Memory leaks?
- [ ] Async operations optimized?

### Code Quality Review Checklist
- [ ] Functions single responsibility?
- [ ] Clear naming conventions?
- [ ] Proper error handling?
- [ ] Adequate test coverage?
- [ ] Documentation complete?
- [ ] Follows project patterns?

---

## When to Use Corrum

### ✅ Always Use
- Authentication/authorization changes
- Database schema migrations
- Security-sensitive features
- Public API changes
- Payment/financial features

### 🟡 Consider Using
- Complex business logic
- Performance-critical code
- User-facing features
- Multi-step workflows
- Refactoring (major)

### ❌ Skip Corrum
- Typo fixes
- Comment updates
- Styling tweaks
- Documentation edits
- Emergency hotfixes (review after)

---

## Codex Commands Reference

### Basic Review
```bash
codex exec "Review [file] for security and best practices"
```

### Security-Focused Review
```bash
codex exec "Perform security audit of [file] focusing on OWASP Top 10"
```

### Architecture Review
```bash
codex exec "Review architecture of [feature] for scalability and maintainability"
```

### Performance Review
```bash
codex exec "Analyze [file] for performance bottlenecks and optimization opportunities"
```

### Full Stack Review
```bash
codex exec "Review full implementation of [feature] including frontend, backend, and database. Check security, performance, and code quality."
```

---

## Gemini Commands Reference

### Basic Review with Fallback
```bash
# Tries Gemini first, if it fails (e.g., no credits), it falls back to Codex.
gemini exec "Review [file] for security, best practices, and potential improvements." || codex exec "Review [file] for security and best practices"
```

### Arbiter Invocation with Fallback
```bash
# Tries Gemini first, if it fails, it falls back to Codex as the arbiter.
gemini exec "You are acting as a NEUTRAL ARBITER... (see TEMPLATE_GEMINI_ARBITER_PROMPT.md)" || codex exec "You are acting as a NEUTRAL ARBITER... (see TEMPLATE_ARBITER_PROMPT.md)"
```
**Note**: The `||` operator provides resilience. If the primary `gemini` command fails for any reason (API error, exhausted credits), the secondary `codex` command will be executed automatically.

---

## Templates Location

- **Proposal**: `docs/corrum/TEMPLATE_PROPOSAL.md`
- **Review**: `docs/corrum/TEMPLATE_REVIEW.md`
- **Arbiter (Claude/Codex)**: `docs/corrum/TEMPLATE_ARBITER_PROMPT.md`
- **Arbiter (Gemini)**: `docs/corrum/TEMPLATE_GEMINI_ARBITER_PROMPT.md`

Copy and fill in templates for each new task.

---

## Escalation Path

```
Task Assigned
    ↓
Claude Creates Proposal
    ↓
Codex Reviews ──→ APPROVE ──→ Implement
    ↓
  REVISE ──→ Claude Revises ──→ [Back to Codex]
    ↓
  REJECT ──→ Invoke Arbiter (MUST be different model!)
    ↓
    ├─ If Codex (GPT) reviewed → Claude or Gemini arbitrates
    ├─ If Claude reviewed → Codex (GPT) or Gemini arbitrates
    └─ If Gemini reviewed → Claude or Codex (GPT) arbitrates
    ↓
Arbiter Decides ──→ Majority Wins ──→ Implement
    ↓
  Still No Consensus ──→ ESCALATE TO HUMAN
```

**Cross-Model Rule**: Never use same model for both Review and Arbitration.

---

## Metrics to Track

After each Corrum review, consider tracking:
- **Issues Found**: CRITICAL / HIGH / MEDIUM / LOW counts
- **Iterations**: How many revision rounds?
- **Time**: Total review time
- **Outcome**: Implemented / Rejected / Deferred
- **Value**: Did review prevent bugs? (post-launch analysis)

---

## Tips for Effective Proposals

1. **Be specific**: Vague proposals get vague reviews
2. **Show your work**: Explain why you chose this approach
3. **Consider security first**: Don't wait for reviewer to find issues
4. **List edge cases**: Show you've thought them through
5. **Provide context**: Link to related code/issues/docs
6. **Ask questions**: If unsure, make it explicit
7. **Estimate impact**: Performance, bundle size, complexity

---

## Tips for Effective Reviews

1. **Be constructive**: Suggest fixes, not just problems
2. **Prioritize**: Not every issue is CRITICAL
3. **Provide examples**: Show code snippets or scenarios
4. **Explain reasoning**: Why is this a problem?
5. **Consider trade-offs**: Sometimes "good enough" is okay
6. **Respect context**: Reviewer may not have full codebase knowledge
7. **Vote clearly**: APPROVE/REJECT/REVISE with justification

---

## Configuration Quick Reference

Edit `.corrum-config.toml`:

```toml
[corrum]
enabled = true
mode = "advisory"  # strict | advisory | disabled

[members]
codex_cli = true
arbiter = false

[rules]
max_iterations = 2
require_unanimous = false
```

---

## Help & Resources

- **Full Workflow**: `CORRUM_WORKFLOW.md`
- **Examples**: `docs/corrum/proposals/` (once created)
- **Templates**: `docs/corrum/TEMPLATE_*.md`
- **Config**: `.corrum-config.toml`

---

**Last Updated**: 2025-11-25
**Quick Reference Version**: 1.1

**v1.1 Changes**: Added cross-model arbitration rule - Arbiter must use different model than Reviewer
