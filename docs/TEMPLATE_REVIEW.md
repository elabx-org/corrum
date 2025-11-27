# Review: [Task Name]

**Date**: YYYY-MM-DD
**Reviewer**: [Codex CLI | Arbiter | Agent Name]
**Proposal**: [Link to proposal file]
**Review Type**: [Security | Architecture | Code Quality | Performance | All]

---

## Overall Assessment

**Vote**: 🔴 REJECT | 🟡 REVISE | 🟢 APPROVE

**Confidence Level**: [High | Medium | Low]

**Summary**:
[One-paragraph assessment of the proposal]

---

## Critical Issues (Must Fix Before Implementation)

### 🔴 CRITICAL-1: [Issue Title]
**Severity**: CRITICAL
**Category**: [Security | Data Loss | Breaking Change | Availability]

**Description**:
[Detailed explanation of the issue]

**Impact**:
- [Who/what is affected]
- [Potential consequences]

**Reproduction**:
```
[Steps to trigger or example scenario]
```

**Recommendation**:
[Specific fix or alternative approach]

**References**:
- [CVE, OWASP reference, or documentation]

---

### 🔴 CRITICAL-2: [Issue Title]
[Same structure as above]

---

## High Priority Issues (Should Fix)

### 🟠 HIGH-1: [Issue Title]
**Severity**: HIGH
**Category**: [Security | Performance | Reliability | Maintainability]

**Description**:
[Detailed explanation]

**Impact**:
[Consequences if not addressed]

**Recommendation**:
[Suggested fix]

---

## Medium Priority Issues (Consider Fixing)

### 🟡 MEDIUM-1: [Issue Title]
**Severity**: MEDIUM
**Category**: [Code Quality | Edge Cases | UX | Documentation]

**Description**:
[Explanation of the issue]

**Recommendation**:
[Suggested improvement]

**Alternative**:
[If fix is complex, suggest alternative approach]

---

## Low Priority / Suggestions (Nice to Have)

### 🟢 LOW-1: [Suggestion Title]
**Category**: [Optimization | Code Style | Documentation]

**Suggestion**:
[What could be improved]

**Benefit**:
[Why this would be valuable]

---

## Security Analysis

### Authentication & Authorization
- [ ] ✅ Proper authentication required
- [ ] ✅ Authorization checks in place
- [ ] ⚠️ Issue: [Description]
- [ ] ❌ Missing: [What's missing]

### Input Validation
- [ ] ✅ All user inputs validated
- [ ] ✅ SQL injection protected (ORM used)
- [ ] ✅ XSS protected (React escaping)
- [ ] ⚠️ Issue: [Description]

### Data Protection
- [ ] ✅ Sensitive data encrypted
- [ ] ✅ No secrets in code
- [ ] ✅ Proper access controls
- [ ] ⚠️ Issue: [Description]

### Rate Limiting
- [ ] ✅ Rate limiting implemented
- [ ] ⚠️ Missing for: [Which endpoints]
- [ ] ❌ Not needed for this feature

### Additional Security Checks
- [ ] ✅ CSRF protection (if needed)
- [ ] ✅ Secure headers configured
- [ ] ✅ File upload validation (if applicable)
- [ ] ✅ No eval/exec of user input

**Security Score**: [0-10]/10

---

## Edge Cases Identified

### Edge Case 1: [Scenario]
**Likelihood**: [High | Medium | Low]
**Current Handling**: [How proposal addresses it or doesn't]
**Recommendation**: [How to handle]

### Edge Case 2: [Scenario]
**Likelihood**: [High | Medium | Low]
**Current Handling**: [Description]
**Recommendation**: [How to handle]

---

## Performance Analysis

### Database Performance
**Queries Added**: [Number]
**Query Complexity**: [O(n), O(n²), etc.]
**Index Coverage**: [Covered | Missing indexes]

**Concerns**:
- [Potential N+1 query issue]
- [Missing index on frequently queried column]

**Recommendations**:
- [Add index on column X]
- [Use join instead of separate queries]

### Frontend Performance
**Bundle Impact**: [+/- X KB]
**Render Performance**: [Concern or okay]
**API Calls**: [Number added]

**Recommendations**:
- [Lazy load component X]
- [Batch API calls]

### Backend Performance
**CPU**: [Impact assessment]
**Memory**: [Impact assessment]
**I/O**: [Impact assessment]

**Load Testing**: [Recommended | Not needed]

---

## Code Quality Assessment

### Maintainability
**Score**: [1-10]/10

**Strengths**:
- [Well-structured]
- [Clear naming]

**Concerns**:
- [Too much complexity in one function]
- [Tight coupling between components]

**Recommendations**:
- [Extract function X]
- [Use dependency injection]

### Readability
**Score**: [1-10]/10

**Strengths**:
- [Clear variable names]

**Concerns**:
- [Insufficient comments for complex logic]

### Testing
**Coverage**: [Adequate | Insufficient]

**Missing Tests**:
- [ ] Edge case: [Description]
- [ ] Error handling: [Scenario]
- [ ] Integration: [Component interaction]

---

## Alternative Approaches

### Alternative 1: [Different Approach Name]
**How It Works**:
[Description of alternative]

**Advantages**:
- [Pro 1]
- [Pro 2]

**Disadvantages**:
- [Con 1]

**Comparison to Proposed**:
[Better/worse and why]

**Recommendation**: [Prefer this | Stick with original | Consider hybrid]

---

### Alternative 2: [Another Approach]
[Same structure as above]

---

## Best Practices Compliance

### Project Standards
- [ ] ✅ Follows CLAUDE.md patterns
- [ ] ✅ Uses custom Select component (not native)
- [ ] ✅ API integration pattern followed
- [ ] ✅ Unsaved changes warning implemented
- [ ] ⚠️ Deviation: [Description and justification]

### Industry Standards
- [ ] ✅ RESTful API design
- [ ] ✅ SOLID principles
- [ ] ✅ DRY (Don't Repeat Yourself)
- [ ] ⚠️ Violates: [Which principle and where]

### Framework-Specific
- [ ] ✅ React best practices (hooks, effects)
- [ ] ✅ FastAPI best practices (dependency injection)
- [ ] ✅ SQLAlchemy best practices (relationships)

---

## Dependencies Review

### New Dependencies
**Dependency**: `library-name@version`
- **Purpose**: [Why needed]
- **License**: [MIT, Apache, etc.] - ✅ Compatible
- **Security**: [Known vulnerabilities check]
- **Alternatives**: [Other options considered]
- **Recommendation**: [Approve | Find alternative | Not needed]

---

## Documentation Review

### Adequacy
- [ ] ✅ CLAUDE.md updated
- [ ] ⚠️ Missing: [What should be documented]
- [ ] ❌ Incomplete: [Section needs expansion]

### Clarity
**Score**: [1-10]/10
[Comments on documentation quality]

---

## Recommendations Summary

### Must Do (Blockers)
1. [Fix CRITICAL-1]
2. [Fix CRITICAL-2]

### Should Do (Strongly Recommended)
1. [Address HIGH-1]
2. [Add edge case handling for X]

### Could Do (Optional Improvements)
1. [Consider alternative approach for Y]
2. [Add performance optimization for Z]

---

## Questions for Proposal Author

1. **[Question 1]**
   - Context: [Why asking]
   - Options: [A, B, C]

2. **[Question 2]**
   - Context: [Why asking]

---

## Additional Context

[Any other observations, patterns noticed, or general comments]

---

## Revision Checklist

If vote is **REVISE**, author should address:
- [ ] All CRITICAL issues
- [ ] All HIGH priority issues
- [ ] Majority of MEDIUM issues (or justify why not)
- [ ] Answer all questions
- [ ] Update proposal document with changes

---

## Approval Conditions

**If APPROVE with conditions**:
This proposal is approved PROVIDED:
1. [Condition 1 is met]
2. [Condition 2 is met]

**Post-implementation verification required**:
- [ ] [Check 1]
- [ ] [Check 2]

---

## Final Notes

**Overall Opinion**:
[Final thoughts, commendation for good parts, encouragement]

**Collaboration Notes**:
[Any observations about working with the other agents or human]

---

**Reviewer Signature**: [Agent Name]
**Review Duration**: [X minutes]
**Next Steps**: [What happens next based on vote]
