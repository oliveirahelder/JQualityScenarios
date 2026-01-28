# API Reference

Complete API documentation for JQuality Platform developers.

---

## Authentication

All API endpoints require a JWT token passed via the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.example.com/api/endpoint
```

### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "password123"
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_123",
    "email": "user@company.com",
    "role": "QA"
  }
}
```

---

## Sprint Management

### Get All Sprints
```
GET /api/sprints
Authorization: Bearer TOKEN

Response: 200 OK
{
  "sprints": [
    {
      "id": "sprint_123",
      "name": "Sprint 45",
      "status": "ACTIVE",
      "startDate": "2026-01-27T00:00:00Z",
      "endDate": "2026-02-10T00:00:00Z",
      "ticketCount": 24,
      "jiraSprintId": "45"
    }
  ]
}
```

### Get Sprint Details
```
GET /api/sprints/:sprintId
Authorization: Bearer TOKEN

Response: 200 OK
{
  "id": "sprint_123",
  "name": "Sprint 45",
  "status": "ACTIVE",
  "tickets": [
    {
      "id": "ticket_456",
      "key": "PROJ-123",
      "title": "Login with OAuth2",
      "status": "IN_PROGRESS",
      "riskLevel": "HIGH",
      "scenariosGenerated": 3,
      "modifiedFiles": 5
    }
  ],
  "stats": {
    "total": 24,
    "completed": 8,
    "riskHigh": 3,
    "riskMedium": 7,
    "riskLow": 14
  }
}
```

### Sync Sprints from Jira
```
POST /api/sprints/sync
Authorization: Bearer TOKEN
Content-Type: application/json

Response: 200 OK
{
  "message": "Sync completed",
  "sprintsAdded": 2,
  "sprintsUpdated": 1,
  "ticketsProcessed": 45
}
```

---

## Test Scenarios

### Generate Scenarios
```
POST /api/scenarios/generate
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "ticketId": "ticket_456",
  "ticketKey": "PROJ-123",
  "title": "User authentication with OAuth2",
  "description": "Implement OAuth2 login flow with Google provider"
}

Response: 200 OK
{
  "scenarios": [
    {
      "id": "scenario_789",
      "title": "User successfully logs in with Google",
      "gherkin": "Scenario: User successfully logs in with Google\n  Given I am on the login page\n  When I click \"Login with Google\"\n  Then I am redirected to /dashboard",
      "type": "HAPPY_PATH",
      "createdAt": "2026-01-28T10:30:00Z"
    },
    {
      "id": "scenario_790",
      "title": "Login fails with invalid credentials",
      "gherkin": "Scenario: Login fails with invalid credentials\n  Given I am on the login page\n  When I click \"Login with Google\"\n  And Google returns an error\n  Then I see \"Authentication failed\"",
      "type": "ERROR_CASE",
      "createdAt": "2026-01-28T10:30:00Z"
    }
  ]
}
```

### Save Scenarios
```
POST /api/scenarios/save
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "ticketId": "ticket_456",
  "scenarios": [
    {
      "title": "User successfully logs in",
      "gherkin": "Scenario: User successfully logs in\n  Given user is on login page\n  When user clicks login\n  Then user is authenticated",
      "type": "HAPPY_PATH"
    }
  ]
}

Response: 201 CREATED
{
  "message": "Scenarios saved successfully",
  "count": 1,
  "ticketId": "ticket_456"
}
```

### Get Ticket Scenarios
```
GET /api/scenarios/:ticketId
Authorization: Bearer TOKEN

Response: 200 OK
{
  "ticketId": "ticket_456",
  "scenarios": [
    {
      "id": "scenario_789",
      "title": "User successfully logs in",
      "gherkin": "...",
      "type": "HAPPY_PATH",
      "status": "ACTIVE",
      "createdAt": "2026-01-28T10:30:00Z"
    }
  ]
}
```

---

## Documentation

### List Drafts
```
GET /api/documentation-drafts
Authorization: Bearer TOKEN

Response: 200 OK
{
  "drafts": [
    {
      "id": "draft_111",
      "title": "OAuth2 Integration Guide",
      "status": "DRAFT",
      "ticketKey": "PROJ-123",
      "createdAt": "2026-01-28T10:30:00Z",
      "updatedAt": "2026-01-28T15:45:00Z",
      "content": "..."
    }
  ]
}
```

### Create Documentation Draft
```
POST /api/documentation-drafts
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "ticketId": "ticket_456",
  "title": "OAuth2 Integration Guide",
  "content": "## Overview\n\nThis guide covers OAuth2 implementation..."
}

Response: 201 CREATED
{
  "id": "draft_111",
  "title": "OAuth2 Integration Guide",
  "status": "DRAFT",
  "createdAt": "2026-01-28T10:30:00Z"
}
```

### Update Draft Status
```
PATCH /api/documentation-drafts/:draftId
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "status": "APPROVED",
  "content": "Updated content..."
}

Response: 200 OK
{
  "id": "draft_111",
  "status": "APPROVED",
  "updatedAt": "2026-01-28T16:00:00Z"
}
```

### Publish to Confluence
```
POST /api/documentation-drafts/:draftId/publish
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "confluenceSpaceKey": "DOC",
  "parentPageId": "123456"
}

Response: 200 OK
{
  "message": "Published to Confluence",
  "confluencePageId": "654321",
  "confluenceUrl": "https://company.atlassian.net/wiki/spaces/DOC/pages/654321"
}
```

---

## Search

### Semantic Search
```
GET /api/search?query=oauth2+configuration&limit=10
Authorization: Bearer TOKEN

Response: 200 OK
{
  "query": "oauth2 configuration",
  "results": [
    {
      "id": "result_1",
      "type": "TICKET",
      "title": "PROJ-123: OAuth2 Implementation",
      "relevance": 0.95,
      "content": "...",
      "source": {
        "key": "PROJ-123",
        "url": "https://jira.company.com/browse/PROJ-123"
      }
    },
    {
      "id": "result_2",
      "type": "DOCUMENTATION",
      "title": "OAuth2 Configuration Guide",
      "relevance": 0.87,
      "content": "...",
      "source": {
        "pageId": "654321",
        "url": "https://confluence.company.com/wiki/..."
      }
    }
  ],
  "totalResults": 2
}
```

---

## Code Impact Analysis

### Get Ticket Code Impact
```
GET /api/tickets/:ticketId/impact
Authorization: Bearer TOKEN

Response: 200 OK
{
  "ticketId": "ticket_456",
  "riskLevel": "HIGH",
  "riskReason": "Changes to authentication module",
  "modifiedFiles": [
    {
      "path": "src/auth/oauth.ts",
      "additions": 150,
      "deletions": 30,
      "status": "MODIFIED"
    },
    {
      "path": "src/auth/oauth.test.ts",
      "additions": 200,
      "deletions": 0,
      "status": "ADDED"
    }
  ],
  "affectedComponents": [
    "Authentication",
    "OAuth2",
    "Login"
  ],
  "prLink": "https://github.com/company/repo/pull/456"
}
```

---

## Metrics & Analytics

### Get Sprint Metrics
```
GET /api/metrics/sprints/:sprintId
Authorization: Bearer TOKEN

Response: 200 OK
{
  "sprintId": "sprint_123",
  "metrics": {
    "totalTickets": 24,
    "completedTickets": 8,
    "testsGenerated": 45,
    "docsGenerated": 8,
    "docsApproved": 6,
    "avgTimeToApprove": 2.5,
    "riskDistribution": {
      "HIGH": 3,
      "MEDIUM": 7,
      "LOW": 14
    }
  }
}
```

### Get Jira Metrics
```
GET /api/metrics/jira
Authorization: Bearer TOKEN

Response: 200 OK
{
  "metrics": {
    "leadTime": 5.2,
    "cycleTime": 3.8,
    "throughput": 24,
    "defectRate": 0.08,
    "testCoverage": 0.92
  },
  "period": {
    "startDate": "2026-01-27",
    "endDate": "2026-02-10",
    "days": 14
  }
}
```

---

## Settings & Integrations

### Test Integration Connection
```
POST /api/admin/settings/test-connection
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "integration": "JIRA",
  "credentials": {
    "baseUrl": "https://company.atlassian.net",
    "user": "user@company.com",
    "apiToken": "token123"
  }
}

Response: 200 OK
{
  "status": "SUCCESS",
  "message": "Connection successful",
  "details": {
    "cloudId": "abc123",
    "projects": 12
  }
}
```

### Update Integration Settings
```
PATCH /api/admin/settings/integrations/:integration
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "baseUrl": "https://company.atlassian.net",
  "user": "user@company.com",
  "apiToken": "new-token-123",
  "isEnabled": true
}

Response: 200 OK
{
  "message": "Integration updated",
  "integration": "JIRA",
  "status": "ACTIVE"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |
| `FORBIDDEN` | 403 | User lacks permission for this action |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `INTEGRATION_ERROR` | 503 | External API (Jira, GitHub) unavailable |

---

## Rate Limiting

API requests are limited to prevent abuse:

- **Default**: 100 requests per minute per user
- **Headers**: Include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 2026-01-28T11:30:00Z
```

---

## Webhook Events

When you subscribe to webhooks, you'll receive POST requests with these events:

### `scenario.generated`
```json
{
  "event": "scenario.generated",
  "timestamp": "2026-01-28T10:30:00Z",
  "data": {
    "ticketId": "ticket_456",
    "count": 3,
    "scenarioIds": ["scenario_789", "scenario_790", "scenario_791"]
  }
}
```

### `documentation.published`
```json
{
  "event": "documentation.published",
  "timestamp": "2026-01-28T11:00:00Z",
  "data": {
    "draftId": "draft_111",
    "confluencePageId": "654321",
    "title": "OAuth2 Integration Guide"
  }
}
```

---

## Pagination

List endpoints support pagination:

```
GET /api/sprints?page=1&limit=20&sort=-createdAt

Query Parameters:
- page: Page number (default: 1)
- limit: Results per page (default: 20, max: 100)
- sort: Sort field with optional - prefix for descending
```

Response includes:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## SDK/Client Libraries

Official client libraries coming soon for:
- Python
- JavaScript/Node.js
- Java
- Go

---

Last updated: January 28, 2026
