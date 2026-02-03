# Copilot / AI Agent Instructions (code-driven)

Purpose: provide concise, immediately actionable guidance that reflects the current code (not legacy docs).

## Quick architecture overview 🔧
- Next.js 14 App Router with server-side route modules in `app/api/*/route.ts` (each route exports methods like `GET`, `POST`).
- Single backend: Node + Next API layer, PostgreSQL via Prisma (`lib/prisma.ts`), and integration services in `lib/` (Jira/GitHub/Confluence/AI).
- Authentication: JWT-based tokens in `lib/auth.ts`. Use `withAuth()` and `withRole()` wrappers in `lib/middleware.ts` to protect routes.

## Where to look (code-first) 📁
- API routes: `app/api/**/route.ts` (follow existing patterns in `app/api/scenarios/generate/route.ts`)
- Auth & RBAC: `lib/auth.ts`, `lib/middleware.ts` (token = `extractTokenFromHeader`, payload shape in `TokenPayload`)
- AI generation: `lib/ai-client.ts` (OpenAI client), `lib/jira-service.ts` (prompt + parsing rules)
- Semantic search / Confluence: `lib/semantic-search.ts` (Confluence CQL, base candidates, CF-Access headers)
- Database: `prisma/schema.prisma`, migrations under `prisma/migrations/`

## Critical code patterns (copy/paste) ✍️
- Protected route pattern:

```ts
export const POST = withAuth(
  withRole('ADMIN')(async (req: NextRequest & { user?: any }) => {
    // use req.user (TokenPayload) and prisma client
    return NextResponse.json({ ok: true })
  })
)
```

- Error handling pattern: catch errors, console.error(...), return `NextResponse.json({ error }, { status })`.
- DB queries: import `prisma` from `lib/prisma.ts` and prefer `select` to limit fields.

## AI/LLM specifics (important) 🤖
- Use `generateJsonWithOpenAI()` in `lib/ai-client.ts`. It requires `OPENAI_API_KEY` and respects `OPENAI_MODEL`.
- `lib/jira-service.ts` expects the AI to return a precise JSON shape for scenarios. It contains robust extraction & repair logic (find `{...}` in raw text, repair escaped strings, parse into `manual` + `gherkin`).
  - If you change the system prompt, ensure the JSON schema remains compatible: { manual: [...], gherkin: [...] }
  - Fallback: on parse failure, the code returns the raw content inside `gherkin` to preserve output.

## Semantic search & Confluence nuances 🔎
- `lib/semantic-search.ts` generates search terms, builds safe CQL, and cycles multiple base URL candidates (handles `/wiki` and `/confluence` variants).
- It supports Cloudflare Access headers (`CF-Access-Client-Id` / `CF-Access-Client-Secret`) when provided in credentials.
- If no results are found for scoped CQL, it falls back to a broader search (see `runSearch` fallback logic).

## Environment variables & where they matter 🔐
- Database: `DATABASE_URL` (used by Prisma)
- Jira: `JIRA_BASE_URL`, `JIRA_USER`, `JIRA_API_TOKEN` (used in `lib/jira-service.ts`) — note: code selects API version (`2` vs `3`) based on deployment type
- Confluence: `CONFLUENCE_BASE_URL`, `CONFLUENCE_API_TOKEN` (used in `lib/semantic-search.ts` / `lib/confluence-config.ts`)
- AI: `OPENAI_API_KEY`, optional `OPENAI_MODEL` (used in `lib/ai-client.ts`)
- Auth: `JWT_SECRET`, `JWT_EXPIRES_IN` (used in `lib/auth.ts`)

## Developer workflows (commands) ✅
- Dev server: `npm run dev`
- Build: `npm run build` and `npm start` for production
- Prisma: `npx prisma generate`, `npx prisma migrate dev --name <desc>`, `npm run prisma:studio`
- Lint: `npm run lint`

## Conventions & PR checklist 🔧
- TypeScript strict mode; follow existing style (2 spaces, single quotes). Keep `no any` where possible.
- Ensure API route: authentication check, user exists, required credentials configured, and clear status codes.
- DB changes must include a Prisma migration and `prisma generate` run locally.
- If changing AI prompts or expected JSON, update `lib/jira-service.ts` parsing logic or tests.

## Legacy files & housekeeping ⚠️
- Agent docs in `.github/agents/*` have been refactored to a code-first format and now reference concrete files (`app/api/**`, `lib/**`, `prisma/**`). If you'd like, I can remove any obsolete files or add a small PR template for agent changes.

---
If any section is unclear or you'd like extra examples (e.g., a sample secure route + Prisma change + LLM update), tell me which area to expand and I'll iterate.
