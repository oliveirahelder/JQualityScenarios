# QABOT Quick Reference - Developer Commands

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Then edit .env.local with your API keys

# Initialize database
npm run prisma:migrate

# Start development server
npm run dev
```

## 📌 Common Commands

### Development
```bash
# Start dev server on port 3000
npm run dev

# Start on different port
npm run dev -- -p 3001

# Build for production
npm build

# Start production server
npm start

# Run linter
npm run lint
```

### Database
```bash
# Run pending migrations
npm run prisma:migrate

# Push schema to database (without migration files)
npm run prisma:push

# Open Prisma Studio (GUI for database)
npm run prisma:studio

# Generate Prisma client
npm run prisma:generate
```

### API Testing

#### Login/Register
```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe",
    "role": "QA"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### Create Sprint
```bash
# Using Bearer token from login response
curl -X POST http://localhost:3000/api/sprints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "jiraId": "SPRINT-45",
    "name": "Sprint 45 - Q1 Features",
    "startDate": "2024-01-15T00:00:00Z",
    "endDate": "2024-01-29T23:59:59Z"
  }'
```

#### Generate Scenarios
```bash
curl -X POST http://localhost:3000/api/scenarios/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "ticketId": "PROJ-123",
    "confluence": "Optional documentation context"
  }'
```

#### Create Ticket
```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "sprintId": "sprint-uuid",
    "jiraId": "PROJ-123",
    "summary": "Fix login bug",
    "description": "Users cannot login with SSO",
    "status": "TODO",
    "assignee": "john@company.com",
    "priority": "HIGH"
  }'
```

#### Create Test Scenario
```bash
curl -X POST http://localhost:3000/api/scenarios/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "ticketId": "ticket-uuid",
    "title": "Login with SSO",
    "given": "User is on login page",
    "when": "User clicks SSO button",
    "then": "User is redirected to SSO provider",
    "testEnvironment": "https://staging.app.com"
  }'
```

#### Create Documentation Draft
```bash
curl -X POST http://localhost:3000/api/documentation-drafts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "sprintId": "sprint-uuid",
    "ticketId": "ticket-uuid",
    "title": "SSO Login Feature",
    "content": "# SSO Login\n\nThis feature enables...",
    "requirements": "Users must be able to login via SSO",
    "technicalNotes": "Uses OAuth 2.0"
  }'
```

## 🗂️ Project Navigation

```
QABOT/
├── app/
│   ├── api/                 ← API endpoints
│   ├── dashboard/           ← Main page
│   ├── login/              ← Auth page
│   ├── sprints/            ← Sprint management
│   ├── scenarios/          ← Scenario generation
│   ├── documentation/      ← Documentation review
│   ├── globals.css         ← Global styles
│   ├── layout.tsx          ← Root layout
│   └── page.tsx            ← Home redirect
├── components/
│   └── ui/                 ← UI components
├── lib/
│   ├── auth.ts             ← JWT utilities
│   ├── prisma.ts           ← Database client
│   ├── jira-service.ts     ← Jira integration
│   ├── password.ts         ← Password hashing
│   ├── middleware.ts       ← Auth middleware
│   └── utils.ts            ← Utilities
├── prisma/
│   ├── schema.prisma       ← Data models
│   └── migrations/         ← DB migrations
└── package.json            ← Dependencies
```

## 🔐 Authentication

### Roles & Permissions
- **QA**: Can create/review/publish documentation, execute tests
- **DEVELOPER**: Read-only access to tickets and insights
- **DEVOPS**: Manage deployments and webhooks
- **ADMIN**: Full system access

### Token Format
```
Header: Authorization: Bearer <JWT_TOKEN>
```

### Token Structure
```javascript
{
  "userId": "uuid",
  "email": "user@company.com",
  "role": "QA",
  "iat": 1234567890,
  "exp": 1234654290
}
```

## 🐛 Debugging

### Enable Verbose Prisma Logging
Add to `.env.local`:
```env
DATABASE_LOG=query,error,warn
```

### Check Database Connection
```bash
npm run prisma:studio
# Opens GUI at http://localhost:5555
```

### View Request Logs
```bash
# Dev server prints logs to console
npm run dev
# Watch for API request/response logs
```

### Validate Environment
```bash
# Verify all required env vars are set
node -e "console.log(process.env)"
```

## 📦 Dependencies Quick Lookup

| Package | Use Case |
|---------|----------|
| `next` | React framework |
| `prisma` | ORM for database |
| `jsonwebtoken` | JWT auth tokens |
| `bcryptjs` | Password hashing |
| `axios` | HTTP client |
| `openai` | GPT API |
| `google-generative-ai` | Gemini API |
| `tailwindcss` | CSS utility framework |

## 🔗 Important URLs

- **Dev Server**: http://localhost:3000
- **API Root**: http://localhost:3000/api
- **Prisma Studio**: http://localhost:5555
- **Jira API**: https://your-domain.atlassian.net/rest/api/3
- **GitHub API**: https://api.github.com

## 💾 Environment Variables Template

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/qabot_dev"

# Jira
JIRA_BASE_URL="https://your-org.atlassian.net"
JIRA_USER="your-email@company.com"
JIRA_API_TOKEN="your-token"

# GitHub
GITHUB_TOKEN="your-token"
GITHUB_BASE_URL="https://api.github.com"

# Confluence
CONFLUENCE_BASE_URL="https://your-org.atlassian.net/wiki"
CONFLUENCE_USER="your-email@company.com"
CONFLUENCE_API_TOKEN="your-token"

# AI
OPENAI_API_KEY="your-key"
GEMINI_API_KEY="your-key"

# App
JWT_SECRET="random-secret-string"
JWT_EXPIRES_IN="7d"
NEXT_PUBLIC_API_URL="http://localhost:3000"
NODE_ENV="development"
```

## 🆘 Troubleshooting Checklist

- [ ] All `.env.local` variables are set
- [ ] PostgreSQL is running (`psql -U postgres`)
- [ ] Port 3000 is not in use
- [ ] Latest npm packages installed (`npm install`)
- [ ] Prisma migrated (`npm run prisma:migrate`)
- [ ] API keys are valid and have correct permissions

## 📞 Useful Links

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [API Route Conventions](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Jira API Docs](https://developer.atlassian.com/cloud/jira/rest)
- [OpenAI API Docs](https://platform.openai.com/docs/api-reference)

---

**Last Updated**: January 23, 2026  
**Phase**: 1 - Foundation Complete
