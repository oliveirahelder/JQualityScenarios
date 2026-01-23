# QABOT - Centralized Intelligence Platform

A sophisticated platform that connects Jira, GitHub, and Confluence to automate test scenario generation, audit technical impacts in real-time, and publish validated "As-Built" documentation with full traceability.

## 🎯 Project Vision

QABOT anticipates test scenarios from Sprint creation, analyzes developer code changes, executes functional tests only after Staging deployment, and maintains human-reviewed documentation—ensuring 100% traceability from Sprint creation to final publication.

## 🏗️ Architecture

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + ShadcnUI
- **Backend**: Next.js API Routes (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **AI Engine**: Gemini Pro API (semantic analysis) + OpenAI (scenario generation)
- **Integrations**: Jira API, GitHub API, Confluence API, CI/CD Webhooks

## 📋 Data Model

- **Sprint**: Tracks Sprint creation with start/end dates and associated tickets
- **Ticket**: Jira ticket representation with Gross Time calculation
- **DevInsight**: Developer PR notes + AI-analyzed code diffs
- **TestScenario**: BDD/Gherkin scenarios with traceability
- **DocumentationDraft**: AI-generated content awaiting QA review
- **Deployment**: CI/CD deployment tracking for Staging/Production

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- API keys: Jira, GitHub, Confluence, OpenAI, Gemini Pro

### Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Setup database
npx prisma migrate dev --name init

# Start development server
npm run dev
```

Visit `http://localhost:3000` to access the platform.

## 📚 API Routes (Phase 1)

- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `POST /api/scenarios/generate` - Generate test scenarios from Jira
- `GET /api/scenarios` - Retrieve saved scenarios
- `POST /api/scenarios/save` - Save generated scenarios

## 🛣️ Development Roadmap

### Phase 1: Foundation & Database Migration ✅ (In Progress)
- [x] Next.js 14 setup with Tailwind + ShadcnUI
- [x] Prisma ORM with PostgreSQL schema
- [x] Authentication (JWT + Role-based access)
- [x] Scenario generation API migration
- [ ] Frontend dashboard rebuild

### Phase 2: Sprint & History Engine (3-4 weeks)
- Jira Sprint listener (webhook/polling)
- Semantic search with Gemini Pro
- Historical ticket search + Confluence page reading
- DevInsight entity for PR analysis

### Phase 3: Deploy Trigger & QA Review Hub (3-4 weeks)
- CI/CD webhook integration
- Staging deployment confirmation logic
- QA Hub dashboard with test evidence attachment
- Documentation draft review UI
- Confluence publishing workflow

### Post-Phase 3: Optimization
- Automated test script generation (Cypress/Playwright)
- Gross Lead Time reporting & traceability dashboards
- Multi-org/multi-repo support

## 🔐 Authentication & Authorization

Role-based access control (RBAC):
- **QA**: Create/review/publish documentation, execute tests
- **Developer**: Read-only access to tickets and insights
- **DevOps**: Manage deployments and webhooks
- **Admin**: Full system access

## 🔧 Environment Variables

See `.env.example` for all required configuration variables.

## 📖 Documentation

- [Architecture Design](./docs/architecture.md) (Coming soon)
- [API Reference](./docs/api.md) (Coming soon)
- [Database Schema](./docs/schema.md) (Coming soon)

## 🤝 Contributing

This is a focused, enterprise project. For significant changes, please discuss with the core team first.

## 📝 License

Internal use only.
