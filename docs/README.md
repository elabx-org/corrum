# Corrum: Multi-Agent Review System

This directory contains the Corrum multi-agent collaborative review workflow documentation and artifacts.

## What is Corrum?

Corrum (from "quorum") is a structured process where multiple AI agents collaborate to review, critique, and approve solutions before implementation. Think of it as a code review process, but with AI agents bringing different perspectives.

### Dynamic Role Assignment
Corrum is now even more flexible by allowing you to dynamically assign the "Planner" role to different AI models. This means you can choose which AI creates the initial proposal, leveraging the unique strengths of each model for your specific task. See `CORRUM_WORKFLOW.md` for more details.

## Quick Start

1. **Read the workflow**: See `./CORRUM_WORKFLOW.md` for complete documentation
2. **When to use**: Security-sensitive features, architectural changes, complex business logic
3. **Process**: Proposal → Review → Consensus → Implementation → Verification

## Directory Structure

```
corrum/
├── README.md                    # You are here
├── QUICK_REFERENCE.md           # Cheat sheet for daily Corrum usage
├── TEMPLATE_PROPOSAL.md         # Template for creating proposals
├── TEMPLATE_REVIEW.md           # Template for creating reviews
├── TEMPLATE_ARBITER_PROMPT.md   # Arbiter prompts with anti-bias guidelines
├── TEMPLATE_GEMINI_ARBITER_PROMPT.md # Gemini-specific arbiter prompt
└── features/                    # Corrum-reviewed features (organized by feature)
    ├── rate-limiting/
    │   ├── README.md      # Feature overview and status
    │   ├── 20251122-baby-essentials-shopping-rate-limit.md (proposal v2)
    │   ├── 20251122-baby-essentials-shopping-rate-limit-codex.md (review)
    │   └── 20251122-baby-essentials-shopping-rate-limit.md (decision)
    └── glass-theme-modernization/
        ├── README.md      # Feature overview and status
        ├── 20251122-glass-theme-modernization.md (proposal v2)
        ├── 20251122-glass-theme-modernization-implementation-codex.md (review)
        ├── 20251122-glass-theme-modernization-revision-summary.md
        ├── 20251122-glass-theme-modernization-final-approval.md
        └── 20251122-glass-theme-modernization-amendment-1.md
```

**Note**: Features are organized in dedicated subfolders under `features/` for better organization and discoverability.

## Corrum Members

- **Claude Code**: Primary implementer, solution architect (Claude model)
- **Codex CLI**: Security auditor, best practices reviewer (GPT model)
- **Gemini**: Versatile reviewer, arbiter, and proposer (Gemini model)
- **Arbiter** (optional): Tie-breaker, unbiased evaluator

### Model Redundancy and Fallbacks

To ensure the Corrum workflow remains operational even if one model is unavailable (e.g., due to API issues or exhausted credits), the system is designed with built-in redundancy. The recommended practice is to use the shell's `||` operator to chain commands, creating a fallback sequence.

**Example:**
```bash
gemini exec "..." || codex exec "..."
```

This command attempts to use Gemini first. If it fails for any reason, it automatically falls back to using Codex. This strategy leverages the diversity of available models to make the review process more resilient and reliable. See the `QUICK_REFERENCE.md` for specific command examples.

### Cross-Model Arbitration Rule

**IMPORTANT**: The Arbiter must use a different model family than the Reviewer to ensure genuine independence. This prevents a model from validating its own logic and promotes diverse analysis.

| If Reviewer is... | Then Arbiter can be...  |
|-------------------|-------------------------|
| Codex CLI (GPT)   | Claude Code OR Gemini   |
| Claude Code       | Codex CLI (GPT) OR Gemini |
| Gemini            | Claude Code OR Codex CLI (GPT) |

**Why?** Same-model arbitration (e.g., GPT reviewing GPT's review) provides only simulated independence. Different models have different training data, blind spots, and reasoning approaches. This diversity produces truly independent second opinions and more robust outcomes.

**Note**: Spawning a Claude Code agent (subprocess) does NOT count as a different model—it's still Claude underneath. The same applies to other model families.

## Quick Reference

### For Humans
When assigning a task that requires Corrum:
```
"Add email notifications for inventory sharing - use Corrum workflow"
```

### For Claude Code
When invoking Corrum review:
```bash
# Save proposal first to docs/corrum/proposals/YYYYMMDD-task-name.md
# Then invoke Codex review:
codex exec "Review docs/corrum/proposals/20251122-task-name.md for security, edge cases, and better alternatives. Provide structured feedback with vote: APPROVE/REJECT/REVISE"
```

## Current Status

**Status**: Active & Proven
**Features Reviewed**: 2
- ✅ Rate Limiting (Approved, Not Yet Implemented)
- ✅ Glass Theme Modernization (Approved & Implemented, Production Ready)

**Success Rate**: 100% (2/2 features approved after revisions)

**Value Demonstrated**:
- Caught 1 HIGH + 4 MEDIUM issues in Glass Theme implementation
- Caught 3 MEDIUM security issues in Rate Limiting proposal
- Improved code quality through collaborative review
- Documented decision-making rationale for future reference

## Benefits

✅ Catch security vulnerabilities before implementation
✅ Consider multiple approaches, not just first idea
✅ Document decision-making rationale
✅ Build higher quality, more secure features
✅ Reduce human review burden

## See Also

- `CORRUM_WORKFLOW.md` - Complete workflow documentation with examples
- `../CLAUDE.md` - General project documentation
- `../SECURITY.md` - Security standards Corrum helps enforce
