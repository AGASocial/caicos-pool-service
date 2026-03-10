---
name: Generate Backend API
aliases: [gen-backend, backend, api]
description: "Generate production-ready Next.js API routes, Supabase functions, or database migrations for Caicos backend. Specify operation type, data model, authentication requirements, and integration points."
---

# Generate Backend API

You are building backend APIs for Caicos. Load the **Caicos Next.js Backend API** skill.

When the user specifies a backend task, follow this workflow:

## 1. Clarify Requirements
Ask the user:
- What API endpoint are you building? (e.g., "POST /api/jobs")
- What operation? (GET, POST, PUT, DELETE, etc.)
- What data is needed? (request body, query params)
- What data does it return?
- Who should have access? (owner, admin, technician, all)
- Does it need Row Level Security (RLS) policies?

## 2. Generate API Routes
- Create proper Next.js route handlers
- Include authentication checks
- Validate request data
- Implement RLS enforcement via Supabase
- Return proper HTTP status codes
- Include error handling

## 3. Database Operations
- Write Supabase queries with proper joins
- Implement pagination if needed
- Use transactions for multi-step operations
- Add database indexes for performance
- Generate RLS policies if needed

## 4. File Uploads (if applicable)
- Handle multipart form data
- Validate file types and sizes
- Store in Supabase Storage
- Record metadata in database

## 5. Real-time Updates (if applicable)
- Set up Supabase subscriptions
- Create database triggers if needed
- Implement WebSocket listeners

## 6. Testing
- Generate integration tests with Supertest
- Test all CRUD operations
- Test authorization/RLS
- Test error scenarios
- Minimum 80% coverage

## 7. Deliverables
- Complete API route(s) (.ts)
- Database migration if needed (.sql)
- Types/interfaces file
- Test file
- API documentation

---

Example: "Generate POST /api/jobs/[id]/service-report to submit technician's service data with photos"

Load skill: **Caicos Next.js Backend API**
