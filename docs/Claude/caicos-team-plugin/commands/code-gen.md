---
name: "/code-gen"
description: Generate code for a specific feature. Routes to NextJS or React Native Developer based on the feature type.
---

# /code-gen

Generate code for a Caicos feature. Automatically routes to the appropriate developer specialist.

## Usage

```
/code-gen [component/feature name] [for: web|mobile]
```

## Examples

```
/code-gen Jobs management page for: web

/code-gen Service form with chemical readings for: mobile

/code-gen Authentication route for: web

/code-gen Daily job list dashboard for: mobile
```

## What Happens

1. **Determine target**: Web (NextJS) or Mobile (React Native)

2. **Load relevant Developer Agent**
   - NextJS Developer: Web features
   - React Native Developer: Mobile features

3. **Developer reviews**
   - Feature specification
   - Database schema
   - Existing code patterns
   - Dependencies

4. **Generate code**
   - TypeScript with strict mode
   - Database queries respecting RLS
   - Error handling & loading states
   - Consistent with codebase style

5. **Output**
   - Complete, production-ready code
   - Ready for QA validation
   - Ready to merge to main branch

## Response Example

```
🔧 CODE GENERATION

Feature: Jobs Management Page
Target: Web (NextJS)
Developer: NextJS Developer Agent
Status: Starting code generation...

Analyzing:
  ✓ Feature spec (FEATURE-ADMIN-PORTAL.md)
  ✓ Database schema (service_jobs table)
  ✓ Existing patterns (dashboard.tsx)
  ✓ Dependencies (Supabase RLS, auth context)

Generating code...

[Code output in appropriate language/framework]

Ready for QA validation: /run-tests
```

## What Gets Generated

**For NextJS (Web):**
- Page components with layouts
- API routes or Server Actions
- Database queries with Supabase client
- Forms with validation
- Type definitions (TypeScript)

**For React Native (Mobile):**
- Screen components with navigation
- Zustand store for state
- Supabase queries/subscriptions
- Offline handling with AsyncStorage
- Type definitions (TypeScript)

## Next Steps After Code Gen

```
1. Generate code → /code-gen
2. Validate quality → /run-tests
3. Deploy/merge → Master Agent coordinates
```
