# Repository Guidelines

## Project Structure & Module Organization

- `app/` contains Next.js App Router pages and API routes (`app/api/**/route.ts`).
- `components/` hosts shared UI components; `components/ui/` holds Shadcn-style primitives.
- `lib/` contains server-side utilities (auth, Jira/GitHub/Confluence clients, Prisma helpers).
- `prisma/` includes `schema.prisma` and migrations for the Postgres schema.
- `public/` stores static assets like `logo.svg`.

## Build, Test, and Development Commands

- `npm run dev` starts the Next.js dev server on port 3000.
- `npm run build` builds the production bundle.
- `npm run start` runs the production server after a build.
- `npm run lint` runs `next lint`.
- `npm run prisma:migrate` or `npx prisma migrate dev` applies local schema migrations.
- `npm run prisma:studio` opens Prisma Studio for local inspection.

## Coding Style & Naming Conventions

- Indentation is 2 spaces; use single quotes and omit semicolons in TS/TSX.
- React components use PascalCase (`Sidebar.tsx`), hooks/utilities use camelCase.
- Keep API route folders named after resources (e.g., `app/api/scenarios/`).
- Linting uses Next.js ESLint config (`next lint`); no formatter is enforced.

## Testing Guidelines

- There is no automated test runner configured in `package.json` yet.
- Validate changes by running `npm run lint` and exercising relevant UI/API flows manually.
- Scenario outputs are BDD/Gherkin artifacts; verify generation through `/api/scenarios/*` when changing scenario logic.

## Commit & Pull Request Guidelines

- Commits are short, imperative phrases with capitalization (e.g., `Improve scenario generation`).
- Avoid verbose scopes/prefixes unless necessary; keep messages under ~70 chars.
- PRs should describe the user impact, list key files touched, and note any DB/migration changes.
- Include screenshots or GIFs for UI changes and link related Jira/GitHub issues when available.

## Configuration & Secrets

- Local config relies on `.env` values such as `DATABASE_URL` and `NODE_ENV`.
- Do not commit secrets; follow `SETUP.md` for database and integration setup steps.
