# Pool Service Pro 🏊

A multi-tenant SaaS mobile app for pool service technicians. Built with React Native (Expo) + Supabase.

## Features (MVP)

- 🔐 Multi-tenant auth (company signup → invite technicians)
- 📋 Daily job list with route ordering
- 📝 Full service form: chemical readings, tasks, equipment checks
- 📷 Photo capture (before/after, issues)
- 🏠 Property/customer management
- 🔒 Row Level Security — each company sees only their data

## Tech Stack

- **Frontend:** React Native + Expo SDK 52 + Expo Router v4
- **Backend:** Supabase (Postgres, Auth, Storage, RLS)
- **State:** Zustand
- **Language:** TypeScript

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Go to **Storage** → Create a bucket called `report-photos` (private)
4. Copy your project URL and anon key from **Settings → API**

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install & Run

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `i`/`a` for simulators.

### 4. Seed Test Data

1. Register an account through the app (this creates your company)
2. Run `supabase/seed.sql` in the SQL Editor to add sample properties and jobs

## Project Structure

```
app/                    # Expo Router screens
├── (auth)/             # Login & Register
├── (app)/
│   ├── (tabs)/         # Jobs, Properties, Settings
│   ├── job/[id].tsx    # Service form (main workflow)
│   └── property/       # Property detail & creation
src/
├── lib/supabase.ts     # Supabase client config
├── hooks/              # useAuth, useJobs, useProperties
├── types/database.ts   # TypeScript types
└── constants/          # Chemical readings, task lists
supabase/
├── schema.sql          # Full database + RLS policies
└── seed.sql            # Sample data
```

## Roadmap

- [ ] **Offline mode** — SQLite cache + sync queue
- [ ] **Route optimization** — Google Maps / OR-Tools
- [ ] **Push notifications** — new job assignments
- [ ] **Customer portal** — service history, invoices
- [ ] **Recurring schedules** — auto-generate weekly jobs
- [ ] **Reporting dashboard** — chemical trends, tech productivity
