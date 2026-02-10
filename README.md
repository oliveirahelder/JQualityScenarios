# JQuality Platform

Internal Quality Assurance platform for Jira-based teams. It generates QA scenarios, keeps documentation history, and tracks sprint delivery and quality metrics.

## Highlights
- Generate manual QA scenarios and Gherkin drafts from Jira tickets
- Keep a searchable documentation history (manual + automation drafts)
- Track sprint metrics, delivery signals, and QA coverage
- Integrations: Jira, Confluence, GitHub (optional)

## Quick Start

Prerequisites:
- Node.js 18+
- npm

```bash
npm install
cp .env.example .env.local
npx prisma generate
npx prisma migrate dev
npm run dev -- --webpack
```

App runs at http://localhost:3000

Default local database is SQLite at `prisma/database.db`.

## Configuration

Most configuration happens inside the app:
- **Admin Settings**: Jira base URL, Confluence base URL, sprints-to-sync, AI gateway settings
- **User Settings**: Jira/Confluence/GitHub tokens (per user)

The `.env.local` file is used for:
- Database connection (SQLite by default)
- JWT settings
- Optional fallback tokens (if per-user tokens are not set)

See `SETUP.md` for the full setup guide.

## Project Structure

```
app/            Next.js pages and API routes
components/     UI components
lib/            core integrations and business logic
prisma/         Prisma schema and migrations
public/         static assets
```

## Notes
- This project uses Next.js 16. Run dev with `npm run dev -- --webpack`.
- If Prisma client is missing: run `npx prisma generate`.

Last updated: 2026-02-10
