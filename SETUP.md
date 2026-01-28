# Installation & Setup Guide

Complete setup of JQuality Platform from scratch in **20-30 minutes**.

---

## Prerequisites

Before you start, ensure you have:

- ✅ **Node.js 18+** - [Download](https://nodejs.org/)
- ✅ **PostgreSQL 14+** - [Download](https://www.postgresql.org/) or use Docker
- ✅ **Git** - [Download](https://git-scm.com/)
- ✅ API Keys: Jira, GitHub, OpenAI, Gemini Pro
- ✅ Confluence instance (optional, for documentation publishing)

**Check versions**:
```bash
node --version    # Should be v18 or higher
npm --version     # Should be v8 or higher
```

---

## Step 1: Clone & Install (5 minutes)

```bash
# Clone the repository
git clone <your-repo-url>
cd JQualityScenarios

# Install dependencies
npm install
```

Expected output: `added XXX packages in X.XXs`

---

## Step 2: Database Setup (5 minutes)

Choose one option:

### Option A: PostgreSQL Local (Recommended for Development)

**Windows:**
```bash
# Start PostgreSQL service
net start postgresql-x64-14

# Connect with psql
psql -U postgres

# In psql:
CREATE DATABASE qabot_dev;
CREATE USER qabot_user WITH PASSWORD 'qabot_password';
GRANT ALL PRIVILEGES ON DATABASE qabot_dev TO qabot_user;
\q
```

**macOS:**
```bash
# Start PostgreSQL
brew services start postgresql

# Connect and create database
psql postgres
CREATE DATABASE qabot_dev;
CREATE USER qabot_user WITH PASSWORD 'qabot_password';
GRANT ALL PRIVILEGES ON DATABASE qabot_dev TO qabot_user;
\q
```

### Option B: Docker (Recommended for Production)

```bash
docker run --name qabot-postgres \
  -e POSTGRES_DB=qabot_dev \
  -e POSTGRES_USER=qabot_user \
  -e POSTGRES_PASSWORD=qabot_password \
  -p 5432:5432 \
  -d postgres:14
```

### Option C: Cloud Database (Neon, Supabase, AWS RDS)

1. Sign up for a cloud provider
2. Create a new database
3. Copy the connection string
4. Use it in `.env.local` below

---

## Step 3: Environment Configuration (5 minutes)

Create environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# ==================== DATABASE ====================
DATABASE_URL="postgresql://qabot_user:qabot_password@localhost:5432/qabot_dev"

# ==================== JIRA ====================
JIRA_BASE_URL="https://your-company.atlassian.net"
JIRA_USER="your-email@company.com"
JIRA_API_TOKEN="your-jira-api-token"
JIRA_DEPLOYMENT="cloud"  # or "server"
JIRA_AUTH_TYPE="basic"   # or "oauth"

# ==================== GITHUB ====================
GITHUB_TOKEN="ghp_your-github-token"
GITHUB_OWNER="your-org"
GITHUB_REPO="your-repo"

# ==================== CONFLUENCE ====================
CONFLUENCE_BASE_URL="https://your-company.atlassian.net/wiki"
CONFLUENCE_USER="your-email@company.com"
CONFLUENCE_API_TOKEN="your-confluence-api-token"

# ==================== AI/LLM ====================
OPENAI_API_KEY="sk-your-openai-api-key"
GEMINI_API_KEY="your-gemini-api-key"

# ==================== APPLICATION ====================
NODE_ENV="development"
PORT=3000
NEXT_PUBLIC_API_URL="http://localhost:3000"

# ==================== JWT ====================
JWT_SECRET="your-secret-key-min-32-characters"
JWT_EXPIRATION="7d"
```

### Getting API Keys

**Jira API Token**:
1. Go to https://id.atlassian.com/manage/api-tokens
2. Create a new API token
3. Copy and save in `.env.local`

**GitHub Token**:
1. Go to https://github.com/settings/tokens
2. Create a new token with `repo` and `workflow` scopes
3. Copy and save in `.env.local`

**OpenAI API Key**:
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy and save in `.env.local`

**Gemini API Key**:
1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key
3. Copy and save in `.env.local`

**Confluence API Token**:
1. Go to https://id.atlassian.com/manage/api-tokens
2. Create a new API token
3. Copy and save in `.env.local`

---

## Step 4: Database Migration (5 minutes)

Initialize the database schema:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view data
npm run prisma:studio
```

Expected: Database tables created successfully ✓

---

## Step 5: Start Development Server (2 minutes)

```bash
npm run dev
```

Expected output:
```
> next dev
  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
  - Environments: .env.local
```

---

## Step 6: Verify Installation

1. Open http://localhost:3000 in your browser
2. You should see the **Login** page
3. If you see errors, check the troubleshooting section below

---

## Initial Setup in Application

### 1. Create Admin User

On first run, you may need to create an admin user:

```bash
# In application terminal or API call
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "securepassword",
    "name": "Admin",
    "role": "ADMIN"
  }'
```

### 2. Test Integrations

Go to **Settings** → **Integrations** and verify:
- ✅ Jira Connection Status
- ✅ GitHub Connection Status
- ✅ Confluence Connection Status

If any show "Failed", check the API keys in `.env.local`.

### 3. Sync First Sprint

1. Navigate to **Sprints**
2. Click **Sync from Jira**
3. Wait for sync to complete (usually 5-10 seconds)
4. Verify tickets appear with risk levels

---

## Production Deployment

### Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Environment Variables for Production

Ensure these are set in your production environment:

```bash
NODE_ENV=production
DATABASE_URL=<production-database-url>
JWT_SECRET=<strong-secret-key>
OPENAI_API_KEY=<production-key>
GEMINI_API_KEY=<production-key>
JIRA_BASE_URL=<production-jira>
GITHUB_TOKEN=<production-github-token>
CONFLUENCE_BASE_URL=<production-confluence>
```

### Database Backups

```bash
# Backup PostgreSQL database
pg_dump -U qabot_user qabot_dev > backup.sql

# Restore from backup
psql -U qabot_user qabot_dev < backup.sql
```

---

## Troubleshooting

### Issue: Database Connection Error

**Error**: `connect ECONNREFUSED 127.0.0.1:5432`

**Solution**:
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# If not running, start it
net start postgresql-x64-14  # Windows
brew services start postgresql  # macOS

# Verify DATABASE_URL in .env.local is correct
echo $DATABASE_URL
```

### Issue: Port 3000 Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Use alternative port
npm run dev -- -p 3001

# Or kill process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

### Issue: API Key Authentication Failures

**Symptoms**: Jira/GitHub integration not working

**Solution**:
1. Double-check API keys in `.env.local`
2. Verify keys have correct permissions:
   - **Jira**: Read Jira Software projects, boards, sprints
   - **GitHub**: Read repository, workflow permissions
   - **OpenAI**: API access enabled
3. Go to **Settings** → **Integrations** → Click **Test Connection**

### Issue: npm install fails

**Error**: `ERR! code ERESOLVE`

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Install with legacy peer deps
npm install --legacy-peer-deps
```

### Issue: Prisma Migration Error

**Error**: `Error: P3008`

**Solution**:
```bash
# Reset database (DEV ONLY - deletes all data)
npx prisma migrate reset

# Or manually drop and recreate
psql -U qabot_user qabot_dev
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q

npx prisma migrate dev
```

---

## Performance Tuning

### Database Optimization

```bash
# Add indexes for faster queries
npm run prisma:studio  # Open UI to analyze

# Or run:
psql qabot_dev -f optimize.sql
```

### API Response Caching

Edit `.env.local`:
```bash
# Cache scenarios for 1 hour
CACHE_SCENARIOS_TTL=3600

# Cache search results for 5 minutes
CACHE_SEARCH_TTL=300
```

### Memory Usage

For large sprints (1000+ tickets):
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

---

## Next Steps

1. ✅ **Installation Complete** - You're ready to use JQuality!
2. 📖 Read [README.md](README.md) for feature overview
3. 🚀 Start by syncing your first sprint from Jira
4. 🧪 Generate test scenarios for your first ticket
5. 📚 Review and publish documentation to Confluence

---

## Support

- **Check logs**: `npm run dev` shows real-time logs
- **Database issues**: Review Prisma Studio - `npm run prisma:studio`
- **Integration issues**: Check **Settings** → **Integrations** → **Connection Status**

---

**Installation successful?** Great! Now explore the platform and start automating your QA process. 🎉

Last updated: January 28, 2026
