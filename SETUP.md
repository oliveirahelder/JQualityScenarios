# QABOT Platform Setup Guide

## Phase 1 Implementation Complete

This guide covers setting up the QABOT platform after Phase 1 (Foundation & Database Migration) is complete.

## Prerequisites

- Node.js 18+ ([download](https://nodejs.org/))
- PostgreSQL 14+ ([download](https://www.postgresql.org/) or use Docker)
- Git
- API Keys (instructions below)

## Step 1: Clone & Install Dependencies

```bash
# Navigate to the project directory
cd c:\Users\helder.oliveira\Desktop\QABOT\JQualityScenarios

# Install all dependencies
npm install
```

## Step 2: Database Setup

### Option A: Local PostgreSQL

1. **Install PostgreSQL** (if not already installed)
   - Windows: Use installer from postgresql.org
   - Docker: `docker run --name qabot-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:14`

2. **Create Database**
   ```bash
   psql -U postgres
   CREATE DATABASE qabot_dev;
   \q
   ```

3. **Update .env.local**
   ```
   DATABASE_URL="postgresql://postgres:password@localhost:5432/qabot_dev"
   ```

### Option B: Managed Database (Recommended for Production)

- **Neon**: https://neon.tech/
- **AWS RDS**: https://aws.amazon.com/rds/
- **Supabase**: https://supabase.com/

Update `DATABASE_URL` in `.env.local` with your managed database connection string.

## Step 3: Environment Configuration

1. **Copy environment template**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** with your credentials:

   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/qabot_dev"

   # API Keys - Generate from respective platforms
   JIRA_BASE_URL="https://your-domain.atlassian.net"
   JIRA_USER="your-email@company.com"
   JIRA_API_TOKEN="<generate from Jira Settings>"

   GITHUB_TOKEN="<generate from GitHub Settings>"
   GITHUB_BASE_URL="https://api.github.com"

   CONFLUENCE_BASE_URL="https://your-domain.atlassian.net/wiki"
   CONFLUENCE_USER="your-email@company.com"
   CONFLUENCE_API_TOKEN="<generate from Confluence Settings>"

   # AI Services
   OPENAI_API_KEY="<generate from OpenAI platform>"
   GEMINI_API_KEY="<generate from Google Cloud Console>"

   # Authentication
   JWT_SECRET="change-this-to-a-secure-random-string"
   JWT_EXPIRES_IN="7d"

   # Application
   NEXT_PUBLIC_API_URL="http://localhost:3000"
   NODE_ENV="development"
   ```

## Step 4: API Key Generation

### Jira API Token
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy and paste into `.env.local`

### GitHub Personal Access Token
1. Go to https://github.com/settings/tokens
2. Create new token with `repo`, `read:org` scopes
3. Copy and paste into `.env.local`

### Confluence API Token
1. Same as Jira API Token (same identity management)

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy and paste into `.env.local`

### Gemini API Key
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable Generative AI API
4. Create API key in Credentials section
5. Copy and paste into `.env.local`

## Step 5: Initialize Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

## Step 6: Create Admin User

Open Prisma Studio (`npm run prisma:studio`) or run a quick script:

```bash
# Create admin user via API
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@qabot.local",
    "password": "change-me-in-production",
    "name": "QABOT Admin",
    "role": "ADMIN"
  }'
```

## Step 7: Start Development Server

```bash
npm run dev
```

The application will start at `http://localhost:3000`

## Step 8: First Login

1. Navigate to http://localhost:3000/login
2. Sign in with your admin credentials
3. You'll be redirected to the dashboard

## Verify Installation

- [ ] Database connection working: Check `.prisma/` folder created
- [ ] API routes accessible: Visit `/api/sprints` (will return 401 if auth working)
- [ ] Frontend loads: http://localhost:3000 shows login page
- [ ] Authentication works: Can create account and login
- [ ] Jira integration: Generate scenario from a real Jira ticket

## Troubleshooting

### Port 3000 Already in Use
```bash
# Kill process on port 3000 (Windows PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# Or use different port
npm run dev -- -p 3001
```

### Database Connection Error
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Test connection string format
"postgresql://user:password@host:port/database"
```

### API Key Errors
- Ensure all `.env.local` keys are set
- Check API key permissions in respective platforms
- Verify baseURLs match your instance URLs

### Prisma Migration Issues
```bash
# Reset database (WARNING: deletes all data)
npm run prisma:push -- --force-reset

# Or delete and recreate
psql -U postgres
DROP DATABASE qabot_dev;
CREATE DATABASE qabot_dev;
\q
npm run prisma:push
```

## Project Structure

```
├── app/
│   ├── api/                    # Next.js API routes
│   │   ├── auth/               # Authentication endpoints
│   │   ├── sprints/            # Sprint management
│   │   ├── tickets/            # Ticket management
│   │   ├── scenarios/          # Scenario generation
│   │   ├── dev-insights/       # Developer insights
│   │   └── documentation-drafts/  # Documentation management
│   ├── dashboard/              # Main dashboard page
│   ├── login/                  # Login page
│   ├── sprints/                # Sprints UI
│   ├── scenarios/              # Scenario generation UI
│   └── documentation/          # Documentation review UI
├── components/
│   └── ui/                     # ShadcnUI components
├── lib/
│   ├── auth.ts                 # JWT utilities
│   ├── prisma.ts               # Prisma client
│   ├── password.ts             # Password hashing
│   ├── middleware.ts           # Auth middleware
│   └── jira-service.ts         # Jira API integration
├── prisma/
│   ├── schema.prisma           # Data models
│   └── migrations/             # Database migrations
└── package.json                # Dependencies
```

## Next Steps (Phase 2)

- [ ] Implement Jira Sprint listener (webhook)
- [ ] Add semantic search with Gemini Pro API
- [ ] Build historical ticket search feature
- [ ] Integrate Confluence page reading

See [Phase 2 Roadmap](./PHASE_2.md) for details.

## Support & Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Jira API Reference](https://developer.atlassian.com/cloud/jira/rest)
- [GitHub API Reference](https://docs.github.com/en/rest)
- [Confluence API Reference](https://developer.atlassian.com/cloud/confluence/rest)
