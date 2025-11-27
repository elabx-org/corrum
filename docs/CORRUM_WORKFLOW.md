# Corrum: Multi-Agent Collaborative Review Workflow

**Version**: 1.0
**Status**: Experimental
**Last Updated**: 2025-11-22

---

## Overview

The **Corrum** (from Latin "quorum" - the minimum number needed for decision-making) is a multi-agent collaborative workflow designed to improve code quality, security, and architectural decisions through diverse AI perspectives.

### Philosophy

Rather than relying on a single AI agent's solution, the Corrum creates a structured review process where multiple AI agents with different perspectives collaborate to:
- Challenge assumptions
- Identify edge cases and security vulnerabilities
- Propose alternative approaches
- Reach consensus on the best solution

---

## Corrum Roles

### 1. **The Planner** (Proposer)
- **Role**: Analyzes the user's request and creates the initial solution proposal. This role is dynamic and can be assigned to any capable model.
- **Default**: Claude Code
- **Candidates**: Claude Code, Gemini, Codex CLI

### 2. **The Implementer**
- **Role**: Implements the final, approved solution. This role is typically fixed.
- **Default**: Claude Code

### 3. **The Reviewers**
- **Role**: Review the proposal for security, best practices, and alternative solutions. Multiple reviewers can be used.
- **Candidates**: Codex CLI, Gemini, Claude Code (if not the planner)

### 4. **The Arbiter**
- **Role**: Acts as a neutral tie-breaker if the other agents disagree. Must be a different model family than the reviewer.
- **Candidates**: Gemini, Claude Code, Codex CLI

### 5. **Expert Agents** (Delegated Specialists)
- **Role**: The Implementer (Claude Code) can delegate specific, well-defined tasks to a team of expert agents. This allows for a "divide and conquer" approach to complex implementations.
- **Examples**:
    - **Testing Agent**: Generates unit tests, integration tests, and end-to-end tests.
    - **Database Agent**: Writes complex SQL queries, designs schemas, and generates migration scripts.
    - **Refactor Agent**: Refactors code to improve readability, performance, or to adhere to new patterns.
    - **Docstring Agent**: Writes high-quality documentation and docstrings for the code.
- **Invocation**: The Implementer can invoke these agents as needed during the implementation stage.
    ```bash
    # Example: Claude Code delegating test generation
    testing_agent exec "Generate comprehensive unit tests for the changes in `[file_path]`."
    ```

#### Delegation Strategy (for Claude Code)

The Implementer (Claude Code) is expected to autonomously decide when to delegate to expert agents. The decision process should follow these steps:

1.  **Decomposition**: Break down the high-level implementation task into a series of smaller, concrete sub-tasks (e.g., "update database schema," "add new API endpoint," "generate unit tests").
2.  **Complexity Assessment**: For each sub-task, evaluate its complexity and whether it requires specialized knowledge. A routine task like adding a simple field to a model might not require delegation, but a complex data migration or a performance-critical query would be a strong candidate.
3.  **Expert Matching**: Compare the sub-task against the list of available expert agents defined in `.corrum-config.toml`. If there is a clear match (e.g., a "database migration" task and a `db_agent`), delegation is recommended.
4.  **Integration**: After an expert agent completes its task, the Implementer is responsible for integrating the results back into the main codebase, ensuring that the new code is correctly connected and functions as expected.
5.  **User Override**: The user can always override this autonomous behavior by providing explicit instructions in the initial prompt, such as `"Do not use any expert agents for this task"` or `"Use the refactor_agent to clean up the existing code before you begin."`



---

## Workflow Stages

### Stage 1: Task Reception & Initial Analysis (Planner)

**Human** → **Planner**

The user assigns a task and can optionally specify which model should act as the Planner.

**Example with default Planner (Claude Code):**
```
"Add email notification when inventory item is marked as outgrown. Use Corrum."
```

**Example with a specified Planner (Gemini):**
```
"Use Corrum with Gemini as the planner to design a new 'outfit suggestion' feature."
```

**Planner's Actions**:
1. Analyze requirements.
2. Review existing codebase patterns.
3. Identify affected components.
4. Draft initial solution proposal.

**Output**: A structured solution proposal document.

---

### Stage 2: Solution Proposal

**Claude Code** creates a solution document containing:

```markdown
## Proposed Solution

### Summary
[One-paragraph overview]

### Implementation Plan
1. [Step 1]
2. [Step 2]
...

### Files to Modify
- `backend/app/routers/items.py` - Add notification trigger
- `backend/app/services/notifications.py` - Add email template
- `frontend/src/components/ItemDetailPage.tsx` - Update UI feedback

### Security Considerations
- [List potential security implications]

### Alternative Approaches Considered
1. [Alternative 1] - Rejected because...
2. [Alternative 2] - Rejected because...

### Open Questions
- Should this be configurable per-user?
- Email immediately or batch daily?
```

**Claude then saves this** to `docs/corrum/proposals/YYYYMMDD-task-name.md`

---

### Stage 3: Corrum Review

**Claude Code** → **Codex CLI** (+ **Arbiter** if needed)

**Claude invokes Codex review**:
```bash
codex exec "Review the solution proposal in docs/corrum/proposals/20251122-outgrown-notification.md. Analyze for:
1. Security vulnerabilities
2. Edge cases not considered
3. Better alternative approaches
4. Code quality and maintainability concerns
5. Performance implications

Provide structured feedback with severity ratings (CRITICAL/HIGH/MEDIUM/LOW) and vote APPROVE/REJECT/REVISE."
```

**Codex provides feedback** saved to `docs/corrum/reviews/20251122-outgrown-notification-codex.md`

---

### Stage 4: Feedback Integration & Iteration

**Claude reviews Codex feedback** and either:

#### Option A: Agreement (APPROVE vote)
- Incorporate minor suggestions
- Proceed to Stage 5

#### Option B: Disagreement (REJECT/major REVISE)
- Claude addresses critical issues
- If fundamental disagreement exists:
  - **Invoke Arbiter Agent** for tie-breaking
  - Present both Claude's and Codex's positions
  - Arbiter votes on approach

#### Option C: Revision Needed
- Claude revises proposal
- Return to Stage 3 with revised proposal (max 2 iterations)

---

### Stage 5: Final Consensus Vote

**All Corrum members vote**:
- **Claude Code**: APPROVE/REJECT + justification
- **Codex CLI**: APPROVE/REJECT + justification
- **Arbiter** (if invoked): APPROVE/REJECT + justification

**Consensus Rules**:
- **2-agent Corrum**: Both must APPROVE
- **3-agent Corrum**: Majority (2/3) must APPROVE
- If no consensus after 2 revisions: Escalate to human for decision

**Output**: `docs/corrum/decisions/20251122-outgrown-notification.md`

```markdown
## Final Decision: APPROVED

### Votes
- Claude Code: APPROVE
- Codex CLI: APPROVE
- Arbiter: N/A (not invoked)

### Final Solution Summary
[Consensus solution with all incorporated feedback]

### Implementation Checklist
- [ ] Backend notification service
- [ ] Email template
- [ ] Frontend UI updates
- [ ] Tests added
- [ ] Documentation updated
```

---

### Stage 6: Implementation & Verification

**Claude Code implements** the approved solution

**Post-Implementation Review** (Optional):
```bash
codex exec "Review the implemented changes for the outgrown notification feature. Verify:
1. Matches approved proposal
2. No security regressions
3. Follows project coding standards
4. All edge cases handled"
```

**Final verification** saved to `docs/corrum/verifications/20251122-outgrown-notification.md`

---

## Directory Structure

```
docs/
└── corrum/
    ├── README.md                          # This workflow guide
    ├── proposals/                         # Initial solution proposals
    │   └── YYYYMMDD-task-name.md
    ├── reviews/                           # Agent feedback documents
    │   ├── YYYYMMDD-task-name-codex.md
    │   └── YYYYMMDD-task-name-arbiter.md
    ├── decisions/                         # Final consensus decisions
    │   └── YYYYMMDD-task-name.md
    └── verifications/                     # Post-implementation reviews
        └── YYYYMMDD-task-name.md
```

---

## Document Templates

### Proposal Template

```markdown
# Proposal: [Task Name]

**Date**: YYYY-MM-DD
**Author**: Claude Code
**Status**: DRAFT | UNDER_REVIEW | APPROVED | REJECTED

## Problem Statement
[Clear description of what needs to be solved]

## Proposed Solution
[Detailed solution approach]

## Implementation Plan
1. [Step-by-step breakdown]

## Files Affected
- `path/to/file.py` - [What changes]

## Security Considerations
- [Potential risks and mitigations]

## Performance Impact
- [Expected performance implications]

## Alternative Approaches
1. [Alternative 1] - [Pros/Cons]

## Open Questions
- [Questions needing resolution]

## Testing Strategy
- [How to verify solution works]
```

### Review Template

```markdown
# Review: [Task Name]

**Date**: YYYY-MM-DD
**Reviewer**: Codex CLI | Arbiter
**Proposal Version**: [Link to proposal]

## Overall Assessment
**Vote**: APPROVE | REJECT | REVISE

## Security Analysis
### Critical Issues
- [Issue 1]

### High Priority
- [Issue 1]

### Medium Priority
- [Issue 1]

### Low Priority / Suggestions
- [Issue 1]

## Edge Cases Identified
1. [Edge case] - [Proposed handling]

## Alternative Approaches
1. [Better approach?] - [Justification]

## Code Quality Concerns
- [Maintainability issues]
- [Coupling/complexity concerns]

## Performance Concerns
- [Potential bottlenecks]

## Recommendations
1. [Specific actionable recommendation]

## Additional Context
[Any other relevant observations]
```

### Decision Template

```markdown
# Final Decision: [Task Name]

**Date**: YYYY-MM-DD
**Status**: APPROVED | REJECTED
**Corrum Members**: Claude Code, Codex CLI, [Arbiter if used]

## Votes
- **Claude Code**: APPROVE/REJECT - [Brief justification]
- **Codex CLI**: APPROVE/REJECT - [Brief justification]
- **Arbiter**: APPROVE/REJECT - [Brief justification] (if invoked)

## Final Consensus Solution
[Synthesized solution incorporating all feedback]

## Key Changes from Original Proposal
1. [Change 1] - [Reason]

## Implementation Checklist
- [ ] Task 1
- [ ] Task 2
- [ ] Tests added
- [ ] Documentation updated

## Post-Implementation Verification Plan
[How to verify solution works as intended]
```

---

## When to Use the Corrum

### ✅ Use Corrum For:
- **Security-sensitive features** (authentication, authorization, data handling)
- **Architectural decisions** (database schema changes, new major components)
- **Complex business logic** (multi-step workflows, state machines)
- **Public API changes** (breaking changes, new endpoints)
- **Performance-critical code** (database queries, image processing)
- **User-facing features with UX implications**

### ⚠️ Optional for:
- **Bug fixes** (unless security-related)
- **UI polish** (styling, minor UX improvements)
- **Documentation updates**
- **Refactoring** (unless major architectural refactor)

### ❌ Skip Corrum For:
- **Trivial changes** (typo fixes, comment updates)
- **Emergency hotfixes** (use fast-track, review after)
- **Experimental prototypes** (user explicitly requests speed)

---

## Benefits of This Approach

### 1. **Reduced Blind Spots**
- Different agents have different training data and biases
- Codex may catch security issues Claude misses
- Arbiter provides fresh perspective without anchoring bias

### 2. **Improved Security**
- Dedicated security review stage
- Multiple agents analyzing for vulnerabilities
- Forced documentation of security considerations

### 3. **Better Architectural Decisions**
- Explicit consideration of alternatives
- Forced justification of chosen approach
- Prevents "first solution" bias

### 4. **Knowledge Preservation**
- All proposals, reviews, and decisions documented
- Future reference for similar problems
- Training data for team members

### 5. **Higher Confidence**
- Human can trust multiply-reviewed solutions
- Clear audit trail of decision-making
- Reduced need for human deep-dive reviews

---

## Potential Challenges & Mitigations

### Challenge 1: **Slower Development Speed**
**Mitigation**:
- Use Corrum selectively (see "When to Use" section)
- Run agents in parallel when possible
- Fast-track critical bugs, review after

### Challenge 2: **Analysis Paralysis**
**Mitigation**:
- Maximum 2 revision iterations
- Escalate to human if no consensus
- Arbiter breaks ties decisively

### Challenge 3: **Cost (API Calls)**
**Mitigation**:
- Codex runs locally when possible
- Use smaller models for simple reviews
- Skip Arbiter unless truly needed

### Challenge 4: **Conflicting Agent Opinions**
**Mitigation**:
- Structured voting system
- Arbiter as neutral tie-breaker
- Human has final say always

### Challenge 5: **Context Limitations**
**Mitigation**:
- Proposals include all necessary context
- Link to relevant code/docs
- Arbiter gets summary, not full codebase

---

## Example: Full Corrum Workflow

### Task: "Add rate limiting to photo upload endpoint"

#### Stage 1: Initial Analysis
Claude analyzes codebase, identifies:
- Current photo upload in `backend/app/routers/photos.py`
- Existing rate limiting pattern in `auth.py`
- No rate limiting on photo uploads currently

#### Stage 2: Proposal
Claude creates `docs/corrum/proposals/20251122-photo-upload-rate-limit.md`:
```markdown
## Proposed Solution
Add IP-based rate limiting: 20 uploads per 15 minutes

## Implementation
1. Create `PhotoUploadRateLimiter` class
2. Add middleware to `/api/photos` endpoint
3. Return 429 Too Many Requests when exceeded

## Security Considerations
- Prevents abuse/DoS via photo uploads
- IP-based (could be bypassed with VPN)
- Consider user-based limiting for authenticated users

## Alternatives
1. User-based only (doesn't protect registration endpoint)
2. Token bucket algorithm (more complex)
```

#### Stage 3: Codex Review
```bash
codex exec "Review docs/corrum/proposals/20251122-photo-upload-rate-limit.md"
```

Codex response in `docs/corrum/reviews/20251122-photo-upload-rate-limit-codex.md`:
```markdown
## Vote: REVISE

## Critical Issues
- IP-based limiting vulnerable to NAT/proxy abuse
- No cleanup strategy for expired rate limit entries
- Should limit by both IP AND user_id

## Recommendations
1. Hybrid approach: IP-based (20/15min) + User-based (50/hour)
2. Add Redis TTL or cleanup job
3. Whitelist admin users from rate limits
4. Add rate limit headers (X-RateLimit-Remaining)

## Security Enhancement
Consider file size in rate limit calculation (not just count)
```

#### Stage 4: Integration
Claude revises proposal incorporating Codex feedback:
- Hybrid IP + user-based limiting
- Redis TTL for auto-cleanup
- Rate limit headers
- Admin exemption

#### Stage 5: Consensus Vote
- **Claude**: APPROVE (addressed all concerns)
- **Codex**: APPROVE (security improved)

Decision saved to `docs/corrum/decisions/20251122-photo-upload-rate-limit.md`

#### Stage 6: Implementation
Claude implements approved solution, commits changes

#### Post-Implementation Review
Codex verifies implementation matches approved design

---

## Configuration

### Enabling/Disabling Corrum

Create `.corrum-config.toml` in project root:

```toml
[corrum]
enabled = true
mode = "strict"  # strict | advisory | disabled

[members]
claude_code = true
codex_cli = true
arbiter = false  # Enable only when needed

[arbiter]
type = "gemini"  # gemini | claude | gpt4 | deepseek
model = "gemini-pro"

[rules]
max_iterations = 2
require_unanimous = false  # false = majority vote
auto_approve_trivial = true  # Skip corrum for trivial changes

[expert_agents]
testing_agent = "claude-sonnet-4-5"
db_agent = "gemini-pro"
refactor_agent = "claude-opus-4-5"


[triggers]
security_keywords = ["auth", "password", "token", "sql", "eval", "exec"]
file_patterns = ["*/routers/*", "*/auth/*", "alembic/versions/*"]
```

---

## Future Enhancements

### 1. **Automated Corrum Triggering**
Claude automatically detects when Corrum should be used based on:
- Keywords in task (security, auth, database, etc.)
- Files being modified (auth/, migrations/, etc.)
- Complexity estimation

### 2. **Specialized Reviewers**
- **Security Specialist**: Dedicated security auditor agent
- **Performance Specialist**: Database query optimization
- **UX Specialist**: User experience review
- **Accessibility Specialist**: WCAG compliance check
- **Modernization Specialist (Gemini)**: Use Gemini's broad knowledge to review code for outdated patterns and suggest modern alternatives.

### 3. **Machine Learning from Decisions**
- Analyze which agent suggestions were most valuable
- Identify patterns in disagreements
- Improve proposal quality over time

### 4. **Integration with CI/CD**
- Automatic Corrum review on PR creation
- Block merge until Corrum approves
- Post-merge verification stage

### 5. **Metrics & Analytics**
- Track Corrum effectiveness (bugs prevented)
- Measure review time vs. value added
- Identify most common security issues

---

## Conclusion

The Corrum workflow introduces a structured, multi-agent collaborative approach to code review and decision-making. By leveraging the diverse strengths of different AI agents, we can:

- **Catch more bugs** before they reach production
- **Improve security** through dedicated review stages
- **Make better architectural decisions** via explicit alternative analysis
- **Document our reasoning** for future reference
- **Build higher quality software** with greater confidence

While it introduces some process overhead, the benefits in critical paths (security, architecture, complex features) far outweigh the costs.

---

**Questions? Feedback?**
This is an experimental workflow. Feedback and iterations welcomed!

**Document Maintained By**: Human + Claude Code + Codex CLI
**Next Review**: When first 5 tasks completed using Corrum