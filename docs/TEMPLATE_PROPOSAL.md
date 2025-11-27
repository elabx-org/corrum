# Proposal: [Task Name]

**Date**: YYYY-MM-DD
**Author**: Claude Code
**Status**: DRAFT

---

## Problem Statement

[Clear, concise description of what needs to be solved and why]

**User Story** (if applicable):
> As a [user type], I want [goal] so that [benefit]

**Acceptance Criteria**:
- [ ] Criterion 1
- [ ] Criterion 2

---

## Proposed Solution

### Overview
[High-level description of the approach]

### Technical Approach
[Detailed explanation of how it will work]

### Why This Approach?
[Justification for chosen solution over alternatives]

---

## Implementation Plan

1. **[Step 1 Name]**
   - Action: [What to do]
   - Files: [Which files to modify]
   - Estimate: [Time/complexity]

2. **[Step 2 Name]**
   - Action: [What to do]
   - Files: [Which files to modify]
   - Estimate: [Time/complexity]

---

## Files Affected

### Backend
- `path/to/file.py` - [What changes and why]

### Frontend
- `path/to/component.tsx` - [What changes and why]

### Database
- `alembic/versions/xxx_migration.py` - [Schema changes]

---

## Security Considerations

### Potential Risks
1. **[Risk 1]**
   - Impact: [High/Medium/Low]
   - Mitigation: [How to prevent]

2. **[Risk 2]**
   - Impact: [High/Medium/Low]
   - Mitigation: [How to prevent]

### OWASP Top 10 Check
- [ ] Injection (SQL, Command, etc.)
- [ ] Broken Authentication
- [ ] Sensitive Data Exposure
- [ ] XML External Entities (XXE)
- [ ] Broken Access Control
- [ ] Security Misconfiguration
- [ ] Cross-Site Scripting (XSS)
- [ ] Insecure Deserialization
- [ ] Using Components with Known Vulnerabilities
- [ ] Insufficient Logging & Monitoring

---

## Performance Impact

**Expected Impact**: [Positive/Neutral/Negative]

### Database
- Queries added: [Number and complexity]
- Indexes needed: [Yes/No - which ones]
- Estimated load: [Negligible/Low/Medium/High]

### Frontend
- Bundle size change: [+/- KB]
- Render performance: [Impact]
- API calls added: [Number]

### Backend
- CPU impact: [Negligible/Low/Medium/High]
- Memory impact: [Negligible/Low/Medium/High]
- I/O impact: [Negligible/Low/Medium/High]

---

## Alternative Approaches Considered

### Alternative 1: [Name]
**Pros**:
- [Pro 1]
- [Pro 2]

**Cons**:
- [Con 1]
- [Con 2]

**Why Rejected**: [Reasoning]

### Alternative 2: [Name]
**Pros**:
- [Pro 1]

**Cons**:
- [Con 1]

**Why Rejected**: [Reasoning]

---

## Dependencies

### External Libraries
- [ ] No new dependencies
- [ ] New dependency: `library-name` - [Why needed, version, license]

### Feature Flags
- [ ] No feature flags needed
- [ ] Feature flag: `feature_name` - [Why needed, default value]

### Breaking Changes
- [ ] No breaking changes
- [ ] Breaking change: [Description and migration plan]

---

## Testing Strategy

### Unit Tests
- [ ] `test_function_name` - [What it tests]

### Integration Tests
- [ ] `test_integration_scenario` - [What it tests]

### Manual Testing Checklist
- [ ] [Test case 1]
- [ ] [Test case 2]
- [ ] Edge case: [Description]

---

## Open Questions

1. **[Question 1]**
   - Options: [A, B, C]
   - Recommendation: [Which and why]
   - Needs decision from: [Human/Corrum]

2. **[Question 2]**
   - Options: [A, B]
   - Recommendation: [Which and why]
   - Needs decision from: [Human/Corrum]

---

## Rollback Plan

**If something goes wrong**:
1. [Step 1 to revert]
2. [Step 2 to revert]

**Database migrations**: Tested rollback with `alembic downgrade -1`

---

## Documentation Updates Needed

- [ ] Update `CLAUDE.md` - [What section]
- [ ] Update `README.md` - [What section]
- [ ] Update `SECURITY.md` - [If security-related]
- [ ] Update API docs (Swagger) - [If API changes]
- [ ] Add user guide section - [If user-facing feature]

---

## Timeline Estimate

**Total Effort**: [X hours/days]

**Breakdown**:
- Planning: [X hours] ✅ (this document)
- Implementation: [X hours]
- Testing: [X hours]
- Documentation: [X hours]
- Review & Refinement: [X hours]

---

## Success Metrics

**How to measure success**:
- [ ] Metric 1: [Description]
- [ ] Metric 2: [Description]

**Definition of Done**:
- [ ] All acceptance criteria met
- [ ] Tests passing (unit + integration)
- [ ] Documentation updated
- [ ] Code reviewed and approved by Corrum
- [ ] No security vulnerabilities introduced
- [ ] Performance acceptable

---

## Appendix

### Related Issues/PRs
- Issue #123: [Description]
- PR #456: [Related work]

### References
- [External documentation]
- [Stack Overflow discussion]
- [RFC or spec]

### Diagrams
[Include architecture diagrams, sequence diagrams, or flowcharts if helpful]

```
[ASCII art or link to diagram]
```
