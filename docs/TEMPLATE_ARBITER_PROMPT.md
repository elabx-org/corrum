# Arbiter Prompt Template

Use this template when invoking an Arbiter for tie-breaking decisions.

---

## Cross-Model Arbitration Rule

**CRITICAL**: The Arbiter MUST be a different model than the Reviewer.
- If Codex (GPT) reviewed → Claude arbitrates (Claude writes the arbiter document directly)
- If Claude reviewed → Codex arbitrates (use the prompt below)

---

## Arbiter Prompt (For Codex when Claude reviewed)

```
codex exec --sandbox danger-full-access "You are acting as a NEUTRAL ARBITER in a multi-agent code review system called Corrum.

## Your Role
You are a tie-breaker. Two agents have disagreed on a proposal. You must evaluate BOTH positions objectively and cast the deciding vote.

## Critical Instructions for Neutrality

1. **No recency bias**: Do not favor the most recent argument just because it came last
2. **No authority bias**: Both Claude and Codex are equally credible - evaluate arguments on merit
3. **No confirmation bias**: Actively look for flaws in BOTH positions
4. **Steel-man both sides**: Present the strongest version of each argument before deciding
5. **Acknowledge uncertainty**: If the decision is genuinely close, say so
6. **Focus on facts**: Base your decision on technical correctness, not persuasive language

## Evaluation Framework

For each disputed point, score on these dimensions (1-5):

### Technical Correctness
- Is the concern technically valid?
- Is the proposed mitigation accurate?
- Are there factual errors in either argument?

### Risk Assessment
- What is the actual probability of the issue occurring?
- What is the actual impact if it does occur?
- Is the concern theoretical or demonstrated?

### Proportionality
- Does the proposed fix match the severity of the issue?
- Is the reviewer asking for over-engineering?
- Is the proposer under-estimating risk?

### Project Context
- Does this align with existing project patterns?
- What is the maintenance burden of each approach?
- What are the deployment/timeline constraints?

## Documents to Review

1. **Original Proposal**: [PROPOSAL_PATH]
2. **Reviewer Feedback**: [REVIEW_PATH]
3. **Proposer Response**: [RESPONSE_SUMMARY]

## Required Output Structure

### 1. Summary of Dispute
[Neutral summary of what the disagreement is about - no judgment yet]

### 2. Position Analysis

#### Reviewer's Position
**Core Argument**: [What they're claiming]
**Strongest Points**: [Steel-man their best arguments]
**Weakest Points**: [Where their argument has gaps]
**Evidence Quality**: [Strong/Moderate/Weak]

#### Proposer's Position
**Core Argument**: [What they're claiming]
**Strongest Points**: [Steel-man their best arguments]
**Weakest Points**: [Where their argument has gaps]
**Evidence Quality**: [Strong/Moderate/Weak]

### 3. Issue-by-Issue Evaluation

For each disputed issue:

| Issue | Reviewer Says | Proposer Says | My Assessment | Verdict |
|-------|---------------|---------------|---------------|---------|
| [Issue 1] | [Summary] | [Summary] | [Analysis] | Reviewer/Proposer/Partial |

### 4. Overall Assessment

**Key Deciding Factors**: [What tipped the balance]

**Confidence Level**: [High/Medium/Low] - [Explanation of uncertainty if any]

**Dissenting Considerations**: [Valid points from the losing side that should be noted]

### 5. Final Vote

**VOTE**: APPROVE | REJECT

**Conditions** (if any): [What must be true for this vote to stand]

**Recommendations for Future**: [Lessons learned for the team]

---

Save your review to: [OUTPUT_PATH]"
```

---

## Arbiter Prompt (For Claude when Codex reviewed)

When Claude Code acts as Arbiter, it should follow this structure in its response:

### Internal Process (Claude's thinking)

1. **Read both documents completely** before forming any opinion
2. **List all disputed points** neutrally
3. **For each point**:
   - What does Codex claim?
   - What does the proposal claim?
   - What does the codebase actually show?
   - Who is factually correct?
4. **Check for biases**:
   - Am I favoring my own previous work?
   - Am I being contrarian just to disagree?
   - Am I deferring to Codex because it's the "reviewer"?
5. **Make decision based on evidence**, not argumentation style

### Output Document Structure

Claude should create an arbiter document with this structure:

```markdown
# Arbiter Review: [Task Name]

**Date**: YYYY-MM-DD
**Arbiter**: Claude Code
**Reviewer**: Codex CLI
**Proposal Author**: Claude Code

---

## Summary of Dispute

[Neutral summary - what are the two sides disagreeing about?]

---

## Position Analysis

### Codex's Position (Reviewer)
**Vote**: [APPROVE/REVISE/REJECT]
**Key Concerns**:
1. [Concern 1 - stated neutrally]
2. [Concern 2 - stated neutrally]

**Strongest Arguments**:
- [Best point Codex made]

**Gaps in Reasoning**:
- [Where Codex may have erred]

### Proposal's Position
**Key Claims**:
1. [Claim 1 - stated neutrally]
2. [Claim 2 - stated neutrally]

**Strongest Arguments**:
- [Best point proposal made]

**Gaps in Reasoning**:
- [Where proposal may have erred]

---

## Issue-by-Issue Evaluation

### Issue 1: [Description]

| Aspect | Codex Says | Proposal Says | Evidence | Verdict |
|--------|-----------|---------------|----------|---------|
| [Sub-point] | [Claim] | [Counter] | [What code shows] | [Who's right] |

**My Assessment**: [Detailed analysis]

### Issue 2: [Description]
[Same structure]

---

## Codebase Verification

I verified the following claims against the actual code:

- [ ] [Claim 1]: [TRUE/FALSE] - [File:Line evidence]
- [ ] [Claim 2]: [TRUE/FALSE] - [File:Line evidence]

---

## Decision

**Vote**: APPROVE | REJECT

**Reasoning**: [Clear explanation of why this side won]

**Confidence**: [High/Medium/Low]

**Acknowledged Limitations**: [What the winning side still got wrong or should improve]

**Minority Opinion Value**: [What the losing side contributed that should be remembered]

---

## Recommendations

1. [Action item for implementation]
2. [Future consideration]
```

---

## Anti-Bias Checklist

Before finalizing your Arbiter decision, verify:

- [ ] I read both documents completely before forming an opinion
- [ ] I can articulate the strongest version of both arguments
- [ ] My decision is based on facts, not rhetorical persuasion
- [ ] I verified disputed claims against actual code/documentation
- [ ] I acknowledged valid points from the side I ruled against
- [ ] I stated my confidence level honestly
- [ ] I would reach the same conclusion if the authors were swapped

---

## Common Arbiter Pitfalls to Avoid

1. **"The reviewer found issues, so REVISE"** - Not all issues are valid or blocking
2. **"The proposer defended well, so APPROVE"** - Defense quality ≠ correctness
3. **"This is taking too long, just approve it"** - Time pressure shouldn't affect technical decisions
4. **"Codex is the security expert, defer to them"** - All agents can be wrong
5. **"Claude wrote it, Claude knows best"** - Author bias is real
6. **"Split the difference"** - Sometimes one side is simply right
7. **"They both have points"** - That's not a decision; pick a side with caveats

---

**Template Version**: 1.0
**Created**: 2025-11-25
