# JQuality - Test Automation & Documentation Platform

**Automate test scenario generation and documentation from Jira, GitHub, and Confluence.**

---

## What is JQuality?

JQuality automatically generates BDD test scenarios and documentation when developers create Jira tickets and open GitHub PRs. Instead of QA teams writing tests manually after development, JQuality creates them in real-time with full code traceability.

### The Problem
- ❌ QA teams write tests manually (slow, error-prone)
- ❌ Context is lost after development
- ❌ Documentation gets outdated
- ❌ No traceability between code and tests

### The Solution
- ✅ Automatic test generation from Jira tickets
- ✅ Code impact analysis from GitHub PRs
- ✅ BDD/Gherkin test scenarios
- ✅ Auto-published documentation to Confluence
- ✅ **100% traceability**: ticket → code → test → docs

---

## Architecture

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14 + Tailwind CSS |
| Backend | Node.js API Routes |
| Database | PostgreSQL + Prisma ORM |
| AI Engine | OpenAI (scenarios) + Gemini Pro (search) |
| Integrations | Jira, GitHub, Confluence APIs |

---

## Core Features

### 1. Sprint Management
- Real-time sync from Jira
- Track ticket progress
- Code impact analysis
- Test scenario count

### 2. Automatic Test Generation
- BDD/Gherkin scenarios
- Happy path + edge cases
- Error handling scenarios

### 3. Code Impact Analysis
- Detects changed components
- Risk level classification
- File-by-file tracking

### 4. Documentation Pipeline
- Auto-generate drafts
- QA review workflow
- Publish to Confluence

### 5. Historical Search
- Semantic search across tickets
- Find related documentation

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- API keys: Jira, GitHub, OpenAI, Gemini

### Installation
```bash
cd JQualityScenarios
npm install
cp .env.example .env.local
# Edit .env.local with API keys
npx prisma migrate dev
npm run dev
```

Visit `http://localhost:3000`

---

## Getting Started

1. **Install**: [SETUP.md](SETUP.md) (20 minutes)
2. **Overview**: [QUICK_START.md](QUICK_START.md) (5 minutes)
3. **Features**: [FEATURES.md](FEATURES.md) (15 minutes)
4. **APIs**: [API_ROUTES.md](API_ROUTES.md) (20 minutes)
5. **Issues**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## User Roles

| Role | Permissions |
|------|-----------|
| **QA** | Generate/edit/publish scenarios & docs |
| **Developer** | View-only access |
| **DevOps** | Manage webhooks and sync |
| **Admin** | Full system access |

---

## License

Proprietary - JQuality Platform 2026

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

