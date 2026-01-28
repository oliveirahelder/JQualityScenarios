# JQuality Platform

**Centralized Quality Assurance & Test Automation Platform**

A modern internal platform that automates test scenario generation, documentation, and code impact analysis across Jira, GitHub, and Confluence integrations—designed for QA engineers, developers, and technical leadership.

---

## What is JQuality?

JQuality is an enterprise-grade platform that eliminates manual test writing by automatically generating BDD/Gherkin test scenarios from Jira tickets and analyzing code impact from GitHub pull requests. The platform maintains 100% traceability from ticket → code → test → documentation.

### Key Benefits
- **⚡ 10x Faster Testing**: Automatic test scenario generation replaces manual writing
- **📊 Complete Traceability**: Link tickets, code changes, tests, and documentation
- **🤖 AI-Powered**: OpenAI-driven scenario generation with intelligent context extraction
- **📚 Auto-Documentation**: Generate and publish documentation directly to Confluence
- **🎯 Risk Analysis**: Automatic code impact assessment for every pull request
- **🔍 Smart Search**: Semantic search across tickets and documentation

---

## Platform Overview

### For QA Engineers
- **Auto-Generate Tests**: Create comprehensive BDD scenarios in seconds
- **Review & Approve**: Curate generated content before publishing
- **Track Coverage**: Monitor test scenario generation across sprints
- **Historical Search**: Find related tests and edge cases instantly

### For Developers
- **Code Impact Insights**: See which components changed and their risk levels
- **Test Coverage**: Access generated tests for code review
- **Sprint Analytics**: Track development metrics and patterns
- **Integration Status**: Monitor Jira, GitHub, and Confluence connections

### For Technical Leaders
- **Executive Dashboard**: Sprint health, delivery metrics, quality trends
- **Team Analytics**: Test generation rates, documentation status, approval workflows
- **Risk Assessment**: Automatic risk level detection for deployments
- **Audit Trail**: Complete traceability for compliance requirements

---

## Core Features

### 1. Sprint Management
Sync Jira sprints in real-time and track all tickets with automatic code impact classification.

| Risk Level | Use Case | Examples |
|---|---|---|
| 🔴 High | Database, Auth, APIs | Schema changes, OAuth2, Payment gateway |
| 🟡 Medium | Error handling, Performance | Timeouts, Caching, Config updates |
| 🔵 Standard | UI, Tests, Dependencies | Button fixes, test additions, library updates |

### 2. Automatic Test Generation
Generate complete BDD/Gherkin scenarios with happy paths and edge cases automatically.

```gherkin
Scenario: User login with OAuth2
  Given I am on the login page
  When I click "Login with Google"
  Then I am redirected to /dashboard
  And I receive a valid JWT token
  
Scenario: Login fails with invalid credentials
  Given I am on the login page
  When I enter invalid email "invalid@test.com"
  And I enter password "wrong123"
  Then I see error "Invalid credentials"
  And I remain on the login page
```

### 3. Code Impact Analysis
GitHub integration analyzes pull requests to identify changed components, risk levels, and affected features.

- **File Tracking**: Line-by-line changes per file
- **Component Analysis**: Automatic detection of changed modules
- **Risk Classification**: Intelligent risk level assignment
- **Dependency Graph**: Understanding of changed dependencies

### 4. Documentation Pipeline
Auto-generate "As-Built" documentation with QA review workflow and direct Confluence publishing.

**Workflow States**:
- 📝 **Draft**: Auto-generated content, ready for review
- 🔍 **Under Review**: QA team reviewing and editing
- ✅ **Approved**: Content approved, ready to publish
- 📄 **Published**: Live in Confluence

### 5. Semantic Search
AI-powered search across all tickets and documentation with intelligent relevance ranking.

**Example Queries**:
- "How do I configure OAuth2?"
- "Which tickets changed authentication?"
- "Show me payment processing bugs"
- "Find database migration tests"

### 6. Dashboard & Analytics
Executive and team dashboards providing real-time insights into quality metrics and team performance.

**Metrics Tracked**:
- Test scenario generation rate
- Documentation approval time
- Code impact distribution
- Risk assessment accuracy
- Team productivity trends

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, React 18, Tailwind CSS |
| **Backend** | Node.js, TypeScript, Next.js API Routes |
| **Database** | PostgreSQL 14+, Prisma ORM |
| **AI Engine** | OpenAI (GPT-4 for scenarios), Gemini Pro (search) |
| **Integrations** | Jira API, GitHub API, Confluence API |
| **Authentication** | JWT, OAuth2, Role-Based Access Control |

---

## Quick Start

### Prerequisites
- **Node.js** 18 or higher
- **PostgreSQL** 14 or higher (or Docker)
- **API Keys**: Jira, GitHub, OpenAI, Gemini Pro

### Installation (5 minutes)

```bash
# 1. Clone and install
git clone <repository>
cd JQualityScenarios
npm install

# 2. Setup environment
cp .env.example .env.local
# Edit .env.local with your API keys and database URL

# 3. Setup database
npx prisma migrate dev
npx prisma generate

# 4. Start development server
npm run dev
```

Visit **http://localhost:3000** and login with your credentials.

> **Full setup guide**: See [SETUP.md](SETUP.md) for detailed configuration (20 minutes)

---

## User Roles & Permissions

| Role | Permissions | Use Case |
|---|---|---|
| **QA Engineer** | Generate, review, approve scenarios & docs | Test automation, quality assurance |
| **Developer** | View scenarios, code impact, analytics | Development, testing, PR reviews |
| **Technical Leader** | Dashboard access, analytics, admin settings | Team management, decision making |
| **Admin** | Full system access, user management, integrations | Platform maintenance, configuration |

---

## Common Tasks

### Generate Test Scenarios
1. Navigate to **Sprints** → Select a sprint
2. Click on any **ticket**
3. Click **Generate Scenarios**
4. Review and edit scenarios
5. Click **Save** to persist

### Publish Documentation
1. Go to **Documentation** → **Drafts**
2. Review content
3. Click **Approve**
4. Click **Publish to Confluence**

### View Code Impact
1. Open **Sprints** dashboard
2. Risk color codes appear next to tickets
3. Click a ticket to see modified files
4. Review risk assessment

### Search Documentation
1. Go to **Search** page
2. Enter natural language query
3. View results ranked by relevance
4. Click result to view full content

---

## Project Structure

```
JQualityScenarios/
├── app/                          # Next.js App Router
│   ├── api/                      # Backend API routes
│   │   ├── scenarios/            # Test scenario endpoints
│   │   ├── sprints/              # Sprint management
│   │   ├── documentation-drafts/ # Documentation pipeline
│   │   ├── integrations/         # Jira, GitHub, Confluence
│   │   └── metrics/              # Analytics and reporting
│   ├── dashboard/                # Executive dashboard
│   ├── scenarios/                # Scenario management UI
│   ├── sprints/                  # Sprint tracking UI
│   └── documentation/            # Documentation review UI
├── components/                   # Shared React components
│   └── ui/                       # Shadcn UI primitives
├── lib/                          # Core business logic
│   ├── jira-service.ts          # Jira integration
│   ├── github-service.ts        # GitHub integration
│   ├── jira-sprints.ts          # Sprint management
│   ├── semantic-search.ts       # AI search
│   └── prisma.ts                # Database client
├── prisma/                       # Database schema
│   ├── schema.prisma            # Data models
│   └── migrations/              # Database migrations
└── public/                       # Static assets
```

---

## Environment Configuration

Required environment variables (see `.env.example` for details):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/qabot_dev

# Jira
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@company.com
JIRA_API_TOKEN=your-api-token

# GitHub
GITHUB_TOKEN=ghp_xxxxx

# Confluence
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki
CONFLUENCE_API_TOKEN=your-token

# AI/LLM
OPENAI_API_KEY=sk-xxxxx
GEMINI_API_KEY=xxxxx
```

---

## API Overview

All API routes follow REST conventions and require authentication via JWT token.

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/scenarios/generate` | Generate test scenarios |
| `POST` | `/api/scenarios/save` | Save generated scenarios |
| `GET` | `/api/sprints` | List synced sprints |
| `POST` | `/api/sprints/sync` | Sync from Jira |
| `GET` | `/api/documentation-drafts` | List draft documents |
| `POST` | `/api/documentation-drafts` | Create documentation |
| `GET` | `/api/search` | Semantic search tickets |

See [API_REFERENCE.md](API_REFERENCE.md) for complete endpoint documentation.

---

## Development

### Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Run production server
npm run lint             # Run ESLint checks
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:generate  # Generate Prisma client
```

### Code Standards
- **Language**: TypeScript (strict mode)
- **Formatting**: 2 spaces, single quotes, no semicolons
- **Components**: React functional components with hooks
- **Naming**: PascalCase for components, camelCase for utilities
- **Linting**: ESLint with Next.js configuration

---

## Troubleshooting

### Database Connection Issues
```bash
# Check connection string
echo $DATABASE_URL

# Reset database
npx prisma migrate reset

# Check Prisma Studio
npm run prisma:studio
```

### API Integration Failures
1. Verify all API tokens in `.env.local`
2. Check integration status: **Settings** → **Integrations**
3. Review connection logs in dashboard
4. Contact platform admin for credential reset

### Port Already in Use
```bash
# Use alternative port
npm run dev -- -p 3001
```

---

## Support & Documentation

- **Getting Started**: [SETUP.md](SETUP.md) - Complete installation guide
- **API Reference**: [API_REFERENCE.md](API_REFERENCE.md) - Endpoint documentation
- **Development**: [Development guide](DEVELOPMENT.md) - For developers extending the platform

---

## License

Internal use only. All rights reserved.

---

**Questions?** Contact your technical team or platform admin.

Last updated: January 28, 2026
