# Cadenza App

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Prerequisites

1. Node.js (version 18 or higher)
2. A Supabase project

### Environment Setup

1. Create a `.env.local` file in the root directory with your Supabase credentials:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project dashboard under Settings > API.

### Installation

1. Install dependencies (also installs the git `commit-msg` hook via `prepare`):

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. If you cloned the repo before hooks were added, or hooks did not install, run manually from `admin-portal/`:

```bash
sh scripts/install-git-hooks.sh
```

3. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The login page shows the app version as `semver-build` (for example `1.0.0-12`). The build number increments automatically on every commit; see [Git hooks](#git-hooks) below.

## Features

- **Internationalization**: Support for English and Spanish
- **Authentication**: Supabase Auth with email/password and OAuth (Google, Apple)
- **Protected Routes**: Automatic redirect to login for unauthenticated users
- **Pool service operations**: Jobs, routes, properties, team, and reports for multi-tenant companies
- **Onboarding wizard**: First-time setup flow at `/wizard` (extendable for company setup)

## Authentication Flow

The app includes automatic authentication redirects:

- Unauthenticated users are redirected to `/auth/login`
- Authenticated users trying to access auth pages are redirected to `/dashboard`
- OAuth callbacks are handled automatically

## Project Structure

- `src/app/[locale]/` - Internationalized pages
- `src/components/` - Reusable UI components
- `src/lib/supabase.ts` - Supabase client configuration
- `src/middleware.ts` - Authentication and internationalization middleware
- `messages/` - Translation files for internationalization

## Documentation

Detailed documentation for specific features and implementations can be found in the `docs/` directory:

-   **[File Encryption & Security](docs/encryption.md)**: Details the Envelope Encryption system, key management, and database hardening measures.
-   **[Billing Setup](docs/BILLING-SETUP.md)**: Guide for setting up and managing billing integration.
-   **[Technical Specifications](docs/TECHNICAL-SPECIFICATIONS.md)**: In-depth technical specs for the application.
-   **[Google Sign-In](docs/GOOGLE_SIGN_IN_IMPLEMENTATION.md)**: Implementation details for Google OAuth.


## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next-intl Documentation](https://next-intl-docs.vercel.app/)

## Development

### Git hooks

`npm install` runs `scripts/install-git-hooks.sh`, which installs `pre-commit` and `prepare-commit-msg` hooks into the repository’s `.git/hooks/` directory.

On every commit, the hooks:

1. **pre-commit** — increment the build number in `version.json` and stage it
2. **prepare-commit-msg** — apply optional semver markers from the commit message

The login/register footer shows `1.0.0-{build}`. Merge and rebase commits skip the bump.

Optional semver bumps — include one of these in the commit message:

| Marker | Example result |
|--------|----------------|
| `[major]` or `version: major` | `2.0.0-{build}` |
| `[minor]` or `version: minor` | `1.1.0-{build}` |
| `[patch]` or `version: patch` | `1.0.1-{build}` |

Reinstall the hook manually:

```bash
sh scripts/install-git-hooks.sh
```

Before committing admin-portal changes, run `npm run build` locally (see `.cursor/rules/admin-portal-build-before-commit.mdc`).

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
