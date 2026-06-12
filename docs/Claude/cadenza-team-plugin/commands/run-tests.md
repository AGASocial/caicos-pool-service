---
name: "/run-tests"
description: Run QA validation on code or features. Checks code quality, feature compliance, database integrity, and security.
---

# /run-tests

Run QA validation on generated code or features.

## Usage

```
/run-tests [feature name] [category: code|feature|security|all]
```

## Examples

```
/run-tests Service form code

/run-tests Admin dashboard feature

/run-tests Authentication security

/run-tests Jobs page all
```

## What Gets Tested

### Code Quality (5-10 min)
- TypeScript strict mode compliance
- ESLint/Prettier rules
- No console errors or warnings
- Code pattern consistency
- Performance concerns

### Feature Compliance (10-15 min)
- Does it match the feature spec?
- All user flows working?
- Error/empty states handled?
- UI matches mockups?

### Database Integrity (5-10 min)
- RLS policies prevent data leaks
- Correct tables/columns used
- Multi-tenancy working
- Query efficiency reasonable

### Security (5 min)
- No hardcoded credentials
- Auth checks in place
- No SQL injection vulnerabilities
- RLS bypass not possible

## Response Example

```
🧪 QA VALIDATION REPORT

Feature: Service Form (Mobile)
Tested: Code Quality + Feature Compliance + Database
Status: ⚠️ PASS WITH WARNINGS

CODE QUALITY: ✅ PASS
  ✓ TypeScript strict mode
  ✓ No linting errors
  ✓ Consistent patterns
  ✓ Error handling in place

FEATURE COMPLIANCE: ✅ PASS
  ✓ All form fields present
  ✓ Chemical readings validation works
  ✓ Photo upload functions
  ✓ Save/submit flow complete
  ⚠ Minor: Loading spinner could be larger

DATABASE VALIDATION: ✅ PASS
  ✓ RLS policies enforced
  ✓ Correct tables (service_reports)
  ✓ Multi-tenancy isolation works
  ✓ Query performance good

SECURITY: ✅ PASS
  ✓ No hardcoded secrets
  ✓ Auth required for operations
  ✓ RLS prevents cross-tenant access

═══════════════════════════════════
Summary: ✅ READY TO MERGE
Blockers: 0
Warnings: 1 (minor UI improvement)
═══════════════════════════════════
```

## Possible Results

### ✅ PASS
All tests passed. Code is ready to merge. No issues found.

### ⚠️ PASS WITH WARNINGS
Code passes but has suggestions. Not blocking, can be addressed later or ignored.

### ❌ FAIL
Blockers found. Code must be fixed and resubmitted for QA.

## Common Failure Reasons

- [ ] TypeScript errors or missing types
- [ ] Feature doesn't match spec exactly
- [ ] RLS policy not enforced correctly
- [ ] Error states not handled
- [ ] Hardcoded credentials found
- [ ] Performance issues detected

## After QA Results

**If Pass ✅:**
```
Ready to merge! Submit to Master Agent for deployment.
```

**If Fail ❌:**
```
Blockers identified. Developer must fix and resubmit: /run-tests
```

**If Warnings ⚠️:**
```
Code is good to go. Consider addressing suggestions in next sprint.
```
