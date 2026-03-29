---
name: Generate Mobile Screen
aliases: [gen-mobile, mobile]
description: "Generate production-ready React Native screens, components, or features for the Caicos technician app. Specify screen type, user interactions, offline support, and data requirements."
---

# Generate Mobile Screen

You are building React Native screens for the Caicos technician app. Load the **Caicos React Native Development** skill.

When the user specifies a mobile task, follow this workflow:

## 1. Clarify Requirements
Ask the user:
- What screen/component are you building? (e.g., "Service form screen", "JobCard component")
- What's the primary functionality?
- Does it need offline support?
- What data does it need? (local state, Zustand store, Supabase)
- Any specific Tamagui components or React Native APIs?
- Should photos/camera be involved?

## 2. Generate Code
- Use TypeScript (strict mode)
- React Native built-ins + Tamagui components
- Zustand for state management
- Proper type definitions for all data
- Include proper error handling
- Loading states and empty states
- Touch/gesture handling

## 3. Offline Support (if needed)
- Implement local SQLite storage
- Create sync queue for pending operations
- Handle connection state
- Show sync status to user

## 4. Testing
- Generate tests with Detox or React Native Testing Library
- Test user interactions
- Mock Supabase queries
- Test offline scenarios
- Minimum 80% coverage

## 5. Deliverables
- Complete screen file (.tsx)
- Types file if needed
- Zustand store if needed
- Test file
- Usage example

---

Example: "Generate the service form screen for recording chemical readings and taking photos"

Load skill: **Caicos React Native Development**
