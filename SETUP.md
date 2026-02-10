# Installation and Setup

This guide sets up JQuality for local development using SQLite.

## Prerequisites
- Node.js 18+
- npm
- Git

## 1) Install

```bash
git clone <repo>
cd JQualityScenarios
npm install
```

## 2) Environment

```bash
cp .env.example .env.local
```

Minimum required values:
- DATABASE_URL (SQLite by default)
- JWT_SECRET

## 3) Database

```bash
npx prisma generate
npx prisma migrate dev
```

This creates `prisma/database.db`.

If you already have data, avoid `migrate reset`. Use `migrate deploy` instead:

```bash
npx prisma migrate deploy
```

## 4) Run

```bash
npm run dev -- --webpack
```

Open http://localhost:3000

## 5) First-time configuration (in the app)

1. Login as admin (or register an admin user if needed).
2. Go to **Settings** and configure:
   - Admin: Jira base URL, Confluence base URL, sprints to sync, AI gateway
   - User: Jira/Confluence/GitHub tokens
3. Sync sprints from Jira.

## Admin user (optional)
If you need to create an admin user manually:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"password","name":"Admin","role":"ADMIN"}'
```

## AI Gateway
The app expects an OpenAI-compatible endpoint. Configure it in **Admin Settings**:
- Base URL (example: https://ai-gateway.example.com)
- API key
- Default model

## Troubleshooting

### Prisma client missing
Run:
```bash
npx prisma generate
```

### Next.js dev server error
Run:
```bash
npm run dev -- --webpack
```

### Integration errors
Make sure:
- Admin base URLs are set
- User tokens are configured

Last updated: 2026-02-10
