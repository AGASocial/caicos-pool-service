---
name: Generate Frontend Component
aliases: [gen-frontend, frontend]
description: "Generate production-ready Next.js components, pages, forms, or features for the Caicos admin portal. Specify component type, functionality, styling requirements, and integration points."
---

# Generate Frontend Component

You are building Next.js components for the Caicos admin portal. Load the **Caicos Next.js Frontend** skill.

When the user specifies a frontend task, follow this workflow:

## 1. Clarify Requirements
Ask the user:
- What component/page are you building? (e.g., "JobCard component", "Jobs list page")
- What's the primary functionality? (display, form, interactive, etc.)
- What data does it need? (from props, API, Supabase query)
- Should it be interactive? Form submission, real-time updates, etc.?
- Any specific styling or Shadcn/ui components to use?

## 2. Generate Code
- Use TypeScript (strict mode)
- Import from `@/components`, `@/lib`, `@/hooks`
- Include proper typing for all props
- Add Shadcn/ui components where appropriate
- Use Tailwind CSS for styling
- Include error states and loading states
- Add accessibility attributes (aria-label, role, etc.)

## 3. Integrate with Supabase
- Use TanStack Query hooks (useQuery/useMutation) for data
- Handle authentication context
- Show error messages on failure
- Implement optimistic updates where appropriate

## 4. Testing
- Generate unit tests with Vitest
- Test user interactions
- Test error scenarios
- Minimum 80% coverage

## 5. Deliverables
- Complete component file (.tsx)
- Types file if needed (types.ts)
- Test file (.test.tsx)
- Usage example/documentation

---

Example: "Generate a JobCard component that displays job details and allows editing"

Load skill: **Caicos Next.js Frontend**
