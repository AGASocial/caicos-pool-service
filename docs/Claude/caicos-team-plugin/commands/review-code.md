---
name: "/review-code"
description: Request code review from the appropriate developer specialist. Get feedback on implementation approach, patterns, and potential improvements.
---

# /review-code

Request code review from a developer specialist.

## Usage

```
/review-code [code/feature] [for: web|mobile]
```

## Examples

```
/review-code Service form implementation for: mobile

/review-code Admin dashboard queries for: web

/review-code Offline sync logic for: mobile

/review-code RLS policy implementation for: web
```

## What Reviewer Looks For

### Architecture & Design
- Does the approach make sense?
- Are there better patterns to use?
- Is code scalable?
- Proper separation of concerns?

### Performance
- Any obvious bottlenecks?
- Database queries optimized?
- Memory leaks possible?
- Rendering performance good?

### Code Quality
- Consistent with codebase?
- Proper error handling?
- Edge cases covered?
- Documentation clear?

### Best Practices
- Following framework conventions?
- TypeScript best practices?
- Security considerations?
- Testing approach sound?

## Response Example

```
👀 CODE REVIEW

Feature: Service Form (Mobile)
Reviewer: React Native Developer Agent
Type: Architecture & Performance Review

GOOD POINTS:
  ✓ Clean component structure
  ✓ Good use of Zustand for form state
  ✓ Proper offline handling with AsyncStorage
  ✓ Photo upload queue implemented well

SUGGESTIONS:
  ⚠️ Consider using React Hook Form instead of custom state
     Reason: Better performance for large forms

  ⚠️ Photo compression could be optimized
     Reason: Current quality loss is acceptable but could tune

  💡 Consider memoizing chemical readings list
     Reason: Minor performance improvement for re-renders

BLOCKERS: None
Overall: Good implementation. Suggestions are optional improvements.

Next: Ready for QA validation → /run-tests
```

## Types of Reviews

- **Architecture Review**: Is the overall approach sound?
- **Performance Review**: Any optimization opportunities?
- **Security Review**: Any security concerns?
- **Code Quality Review**: Does it match patterns?

## When to Use Review vs QA

| Need | Use |
|------|-----|
| Feedback before finalizing | `/review-code` |
| Validate before merge | `/run-tests` |
| Get suggestions | `/review-code` |
| Ensure quality gates | `/run-tests` |

## After Code Review

Implement suggestions from reviewer, then:
```
/run-tests [feature name]  (Full QA validation before merge)
```
