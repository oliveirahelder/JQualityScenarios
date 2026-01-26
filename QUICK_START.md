# Quick Start - 5 Minute Overview

---

## What is JQuality?

**Automatic test generation platform that creates BDD test scenarios and documentation when developers work.**

### How It Works
```
Developer commits code → JQuality analyzes → Tests generated → Published
```

---

## Core Features

### 1. Sprint Management
View all Jira sprints with:
- Test scenario count per ticket
- Code impact areas (Auth, API, DB, etc)
- Documentation status

### 2. Test Scenario Generation
Automatically generates BDD/Gherkin tests:
```gherkin
Scenario: Login with Google
  Given I'm on the login page
  When I click "Login with Google"
  Then I'm redirected to Google Auth
  And I receive a JWT token
```

### 3. Code Impact Analysis
Automatically detects what code changed:
- 🔴 High Risk: Database, Authentication, APIs
- 🟡 Medium Risk: Error Handling, Performance
- 🔵 Standard: UI, Tests, Dependencies

### 4. Documentation Pipeline
Auto-generate and publish docs:
- Draft → Review → Approved → Published
- Full traceability to Jira tickets and GitHub PRs

### 5. Historical Search
Find related tickets and documentation using natural language.

---

## Getting Started

### Step 1: Install (20 minutes)
```bash
npm install
npx prisma migrate dev
npm run dev
```

See [SETUP.md](SETUP.md) for detailed instructions.

### Step 2: Create Account
Visit http://localhost:3000 and sign up.

### Step 3: Sync Sprints
Go to **Sprints** → Click "Sync from Jira"

### Step 4: Generate Tests
Click on a ticket → "Generate Scenarios"

### Step 5: Review & Publish
Go to **Documentation** → Review drafts → Publish

---

## By Role

### For QA/Testers
1. Sync sprints from Jira
2. Generate test scenarios
3. Review documentation drafts
4. Publish to Confluence

### For Developers
1. Setup locally
2. Understand APIs in [API_ROUTES.md](API_ROUTES.md)
3. Make contributions

### For DevOps/Admin
1. Configure database
2. Setup webhooks
3. Deploy and monitor

---

## Key Concepts

| Term | Meaning |
|------|---------|
| **Sprint** | Jira sprint with tickets |
| **Ticket** | Jira issue/task |
| **Scenario** | BDD test case (Gherkin format) |
| **DevInsight** | GitHub PR analysis (code impact) |
| **Documentation Draft** | Auto-generated documentation |
| **Impact Area** | Component affected by code change |

---

## Commands

```bash
# Start
npm run dev

# Build
npm run build

# Database
npx prisma migrate dev
npx prisma studio     # View data

# Deploy
npm run build && npm start
```

---

## API Endpoints (Main)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/login` | Login |
| `GET /api/sprints` | List sprints |
| `POST /api/scenarios/generate` | Generate tests |
| `GET /api/documentation-drafts` | List docs |
| `POST /api/search` | Search (semantic) |

Full docs: [API_ROUTES.md](API_ROUTES.md)

---

## Documentation

- **[README.md](README.md)** - Project overview
- **[SETUP.md](SETUP.md)** - Installation (20 min)
- **[FEATURES.md](FEATURES.md)** - Feature guide (15 min)
- **[API_ROUTES.md](API_ROUTES.md)** - API docs (20 min)
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues (10 min)

---

## Requirements

- Node.js 18+
- PostgreSQL 14+
- API keys: Jira, GitHub, OpenAI, Gemini

---

## Next Steps

1. **Install**: Follow [SETUP.md](SETUP.md)
2. **Learn**: Read [FEATURES.md](FEATURES.md)
3. **Develop**: Check [API_ROUTES.md](API_ROUTES.md)
4. **Stuck?**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

**Ready? → [SETUP.md](SETUP.md)**
