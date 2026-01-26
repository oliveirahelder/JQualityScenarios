# Features Guide

JQuality provides 7 core features to automate quality assurance, streamline documentation, and analyze code impact.

---

## 1. Sprint Management

**What**: Sync Jira sprints and track code impact automatically.

**How to use**:
1. Go to **Sprints** page
2. Click **Sync from Jira** button
3. All sprints load in ~5 seconds
4. View tickets with impact colors:
   - 🔴 Red: High Risk (DB, Auth, APIs)
   - 🟡 Yellow: Medium Risk (Error Handling, Config)
   - 🔵 Blue: Standard (UI, Tests, Dependencies)

---

## 2. Test Scenario Generation

**What**: Auto-generates BDD/Gherkin test scenarios from Jira tickets.

**How to use**:
1. Go to **Sprints** → select a sprint
2. Click on a **ticket**
3. Click **Generate Scenarios**
4. Review scenarios (formatted as Given/When/Then)
5. Click **Save Scenarios** to store for QA review

**Example**:
```gherkin
Scenario: Login with OAuth2
  Given I am on the login page
  When I click "Login with Google"
  Then I am redirected to dashboard
  And I receive a valid JWT token
```

---

## 3. Documentation Pipeline

**What**: Auto-generates "As-Built" documentation and publishes to Confluence with QA approval.

**States**:
- 📝 Draft: Generated, needs review
- 🔍 Under Review: QA reviewing
- ✅ Approved: Ready to publish
- 📄 Published: Live in Confluence

**How to use**:
1. Go to **Documentation** → **Drafts**
2. Click a draft to review content
3. Click **Approve** (or request changes)
4. Click **Publish to Confluence**
5. Documentation goes live automatically

---

## 4. Code Impact Analysis

**What**: Analyzes GitHub PRs to show which code areas were changed and risk level.

**Risk Levels**:
- 🔴 High: Database schema, authentication, critical APIs
- 🟡 Medium: Error handling, performance, configuration
- 🔵 Standard: UI components, tests, dependencies

**How to view**:
- In **Sprints**: See impact color in ticket list
- In **Ticket Details**: View modified files and line counts
- In **Dashboard**: See sprint-wide impact summary

---

## 5. Semantic Search

**What**: Search tickets and documentation using AI-powered semantic search.

**How to use**:
1. Go to **Search** page
2. Type natural language query:
   - "How to set up OAuth?"
   - "Which tickets changed authentication?"
   - "Payment bugs reported"
3. See results ranked by relevance
4. JQuality suggests related docs and patterns

---

## 6. Dashboards & Reports

**Sprint Dashboard**: Overview of all sprints, tickets, code impact, QA metrics.

**QA Dashboard**: Test scenarios generated, documentation in review, coverage gaps.

**Metrics Dashboard**: Historical lead time, test patterns, rejection rates, time-to-publish.

**Available metrics**:
- Tickets completed (%)
- Code changes analyzed
- Test scenarios generated
- Docs published
- QA bounce-back rate
- Lead time

---

## 7. Settings & Administration

**User Management**: Create/delete users, assign roles (Admin, QA, Developer, DevOps).

**Integration Settings**: Test Jira, GitHub, Confluence connections.

**API Keys**: Manage OpenAI, Gemini, Jira, GitHub, Confluence tokens.

---

## Complete Workflow Example

**Day 1**: PM creates sprint in Jira with 4 tickets
- JX-501: Payment API
- JX-502: Payment UI
- JX-503: Refund Logic
- JX-504: Webhooks

**Day 2**: DevOps clicks "Sync from Jira" → all tickets load

**Days 3-5**: Developers push PRs
- JQuality detects code changes
- Marks Payment API PR as 🔴 High Risk (DB + Auth)
- Marks Payment UI PR as 🔵 Standard (UI only)

**Day 6**: QA generates test scenarios
- Generate 8 BDD scenarios for Payment API
- Generate 6 BDD scenarios for Refund Logic
- Save all scenarios for review

**Day 7**: Documentation published
- JQuality generates "As-Built" docs
- QA approves in Documentation page
- Published to Confluence automatically

**Result**: Sprint complete with full traceability (ticket → code → tests → docs)

---

## Features by Role

**QA**: Generate scenarios, review/approve documentation, publish to Confluence, semantic search, view coverage.

**Developer**: View code impact, read-only ticket access, check test scenarios for their features.

**DevOps**: Sync sprints, manage webhooks, monitor integrations, view reports.

**Admin**: All features + user management + integration config + API key management.

---

See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for quick commands.
