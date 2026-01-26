# API Routes Reference

All routes require `Authorization: Bearer {token}` header except for `/auth/login` and `/auth/register`.

---

## Authentication

### POST /api/auth/login

Login user.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

**Response**:
```json
{
  "user": {
    "id": "uuid",
    "username": "admin",
    "role": "ADMIN",
    "createdAt": "2026-01-15T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### POST /api/auth/register

Register new user.

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "password": "secure-password"
  }'
```

---

## Sprints

### GET /api/sprints

List all sprints.

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/sprints
```

**Response**:
```json
{
  "sprints": [
    {
      "id": "uuid",
      "name": "Sprint 1 - Payment",
      "status": "ACTIVE",
      "startDate": "2026-01-15",
      "endDate": "2026-01-29",
      "ticketCount": 4,
      "completedCount": 2,
      "tickets": [...]
    }
  ]
}
```

---

### GET /api/sprints/{sprintId}

Get sprint details.

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/sprints/uuid
```

---

### POST /api/admin/sprints/sync

Sync sprints from Jira. (Admin only)

```bash
curl -X POST http://localhost:3000/api/admin/sprints/sync \
  -H "Authorization: Bearer {token}"
```

---

## Test Scenarios

### GET /api/scenarios

List all test scenarios.

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/scenarios
```

---

### POST /api/scenarios/generate

Generate scenarios for a ticket.

```bash
curl -X POST http://localhost:3000/api/scenarios/generate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "JX-123"
  }'
```

**Response**:
```json
{
  "scenarios": [
    {
      "id": "uuid",
      "title": "Login with OAuth2",
      "type": "HAPPY_PATH",
      "gherkin": "Given I am on login page\nWhen I click Login\nThen I see dashboard"
    }
  ]
}
```

---

### POST /api/scenarios/save

Save generated scenarios.

```bash
curl -X POST http://localhost:3000/api/scenarios/save \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "scenarioIds": ["uuid1", "uuid2"]
  }'
```

---

## Documentation

### GET /api/documentation-drafts

List documentation drafts.

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/documentation-drafts
```

**Response**:
```json
{
  "drafts": [
    {
      "id": "uuid",
      "title": "OAuth2 Feature",
      "status": "DRAFT",
      "ticketId": "JX-123",
      "createdAt": "2026-01-20T10:00:00Z"
    }
  ]
}
```

---

### GET /api/documentation-drafts/{draftId}

Get draft details.

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/documentation-drafts/uuid
```

---

## Search

### POST /api/search

Semantic search for tickets and documentation.

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How to set up OAuth?",
    "type": "tickets"
  }'
```

**Response**:
```json
{
  "results": [
    {
      "id": "JX-123",
      "title": "Implement OAuth2",
      "relevance": 0.95
    }
  ]
}
```

---

## Tickets

### GET /api/tickets

List all tickets.

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/tickets
```

---

### GET /api/tickets/{ticketId}

Get ticket details.

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/tickets/JX-123
```

---

## System

### GET /api/system/database-status

Check database connection status.

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/system/database-status
```

**Response**:
```json
{
  "status": "connected",
  "timestamp": "2026-01-20T14:30:00Z"
}
```

---

## Webhooks

### POST /api/webhooks/jira

Jira webhook endpoint. (No auth required)

```bash
curl -X POST http://localhost:3000/api/webhooks/jira \
  -H "Content-Type: application/json" \
  -d '{"event": "issue_updated", ...}'
```

---

### POST /api/webhooks/github

GitHub webhook endpoint. (No auth required)

```bash
curl -X POST http://localhost:3000/api/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"action": "opened", "pull_request": {...}}'
```

---

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 400 | Bad Request | Invalid request body |
| 500 | Server Error | Check logs |

---

## Authentication

**Get token**:
```bash
POST /api/auth/login
{username, password} → returns {token}
```

**Use token**:
```bash
Header: Authorization: Bearer {token}
```

**Token expiry**: 7 days

---

See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for common commands.

**Response** (201 Created):
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "joao.silva",
    "role": "QA",
    "createdAt": "2026-01-20T14:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors**:
- `400 Bad Request`: Username já existe ou password fraco

---

### GET /api/sprints

**Lista todas as sprints.**

**Request**:
```bash
GET http://localhost:3000/api/sprints
Authorization: Bearer {token}
```

**Response** (200 OK):
```json
{
  "sprints": [
    {
      "id": "sprint-uuid-1",
      "name": "Sprint 1 - Login Refactor",
      "status": "ACTIVE",
      "description": "Refactor da autenticação para OAuth2",
      "startDate": "2026-01-15",
      "endDate": "2026-01-29",
      "createdAt": "2026-01-15T09:00:00Z",
      "lastSyncedAt": "2026-01-20T14:30:00Z",
      "jiraSprintId": "123456",
      "jiraBoardId": "789",
      "ticketCount": 4,
      "completedCount": 2,
      "documentationStats": {
        "draft": 1,
        "underReview": 1,
        "approved": 2,
        "published": 1
      },
      "tickets": [
        {
          "id": "JX-123",
          "key": "JX-123",
          "title": "Implementar OAuth2",
          "description": "Integração com Google/GitHub",
          "status": "IN_PROGRESS",
          "assignee": "dev@company.com",
          "priority": "HIGH",
          "createdAt": "2026-01-15T10:00:00Z",
          "updatedAt": "2026-01-20T10:00:00Z",
          "scenarioCount": 8,
          "impactAreas": ["Auth", "API", "Database"],
          "devInsights": [
            {
              "id": "insight-uuid",
              "prNumber": 234,
              "prUrl": "https://github.com/org/repo/pull/234",
              "impactAreas": ["Auth", "API"],
              "filesChanged": 5,
              "linesAdded": 250,
              "linesRemoved": 120,
              "analyzedAt": "2026-01-20T10:00:00Z"
            }
          ],
          "testScenarios": [
            {
              "id": "scenario-uuid",
              "title": "Login com Google",
              "type": "HAPPY_PATH",
              "gherkin": "Dado que estou na página de login\nQuando clico em 'Login com Google'...",
              "createdAt": "2026-01-20T10:00:00Z"
            }
          ]
        }
      ]
    }
  ]
}
```

**Query Parameters**:
- `status`: `ACTIVE` | `CLOSED` (filtra por status)
- `limit`: número máximo de resultados (default: 50)
- `offset`: para pagination

**Errors**:
- `401 Unauthorized`: Token inválido
- `403 Forbidden`: Sem permissão

---

### GET /api/sprints/[sprintId]

**Detalhes de uma sprint específica.**

**Request**:
```bash
GET http://localhost:3000/api/sprints/sprint-uuid-1
Authorization: Bearer {token}
```

**Response**: Mesma estrutura que GET /api/sprints, mas objeto singular

**Errors**:
- `404 Not Found`: Sprint não existe
- `401 Unauthorized`: Token inválido

---

### POST /api/admin/sprints/sync

**Sincroniza sprints do Jira manualmente.**

**Requer Role**: `DEVOPS` ou `ADMIN`

**Request**:
```bash
POST http://localhost:3000/api/admin/sprints/sync?type=active
Authorization: Bearer {token}
Content-Type: application/json

{}
```

**Query Parameters**:
- `type`: `all` | `active` | `closed` (default: `all`)
  - `active`: Sincroniza sprints em progresso
  - `closed`: Sincroniza sprints fechadas (últimos 7 dias)
  - `all`: Ambas

**Response** (200 OK):
```json
{
  "message": "Sync completed successfully",
  "result": {
    "activeSprints": {
      "synced": 3,
      "sprints": [
        {
          "id": "JX-1",
          "name": "Sprint 1",
          "ticketsAdded": 12,
          "ticketsUpdated": 5
        }
      ]
    },
    "closedSprints": {
      "synced": 0,
      "sprints": []
    },
    "totalTime": "2.5s",
    "timestamp": "2026-01-20T14:30:00Z"
  }
}
```

**Errors**:
- `401 Unauthorized`: Token inválido
- `403 Forbidden`: Role não é DEVOPS/ADMIN
- `500 Server Error`: Erro na sincronização Jira

---

### GET /api/scenarios

**Lista todos os scenarios (testes BDD).**

**Request**:
```bash
GET http://localhost:3000/api/scenarios?sprintId=sprint-uuid&ticketId=JX-123
Authorization: Bearer {token}
```

**Query Parameters**:
- `sprintId`: Filtrar por sprint (opcional)
- `ticketId`: Filtrar por ticket (opcional)
- `type`: `HAPPY_PATH` | `EDGE_CASE` | `ERROR_HANDLING` (opcional)
- `limit`: 50 (default)
- `offset`: para pagination

**Response** (200 OK):
```json
{
  "scenarios": [
    {
      "id": "scenario-uuid-1",
      "ticketId": "JX-123",
      "title": "Login com Google",
      "type": "HAPPY_PATH",
      "gherkin": "Dado que estou na página de login\nQuando clico em 'Login com Google'\nEntão sou redireccionado para Google Auth\nE após autenticação, sou logado no app\nE meu email é armazenado no sistema",
      "steps": [
        {
          "keyword": "Dado",
          "text": "estou na página de login"
        },
        {
          "keyword": "Quando",
          "text": "clico em 'Login com Google'"
        },
        {
          "keyword": "Então",
          "text": "sou redireccionado para Google Auth"
        }
      ],
      "createdAt": "2026-01-20T10:00:00Z",
      "updatedAt": "2026-01-20T10:00:00Z",
      "savedAt": null,
      "publishedAt": null
    }
  ],
  "total": 32,
  "page": 1
}
```

**Errors**:
- `401 Unauthorized`: Token inválido

---

### POST /api/scenarios/generate

**Gera novos scenarios automaticamente para um ticket.**

**Requer Role**: `QA` ou `ADMIN`

**Request**:
```bash
POST http://localhost:3000/api/scenarios/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "ticketId": "JX-123",
  "includeEdgeCases": true,
  "includeErrorHandling": true
}
```

**Body Parameters**:
- `ticketId` (required): ID do ticket Jira
- `includeEdgeCases` (optional): Gerar cenários de edge case (default: true)
- `includeErrorHandling` (optional): Gerar cenários de erro (default: true)

**Response** (200 OK):
```json
{
  "scenarios": [
    {
      "id": "scenario-uuid-2",
      "ticketId": "JX-123",
      "title": "Login com email e password inválida",
      "type": "ERROR_HANDLING",
      "gherkin": "Dado que estou na página de login\nQuando insiro password incorreta\nEntão vejo mensagem de erro\nE não sou autenticado",
      "createdAt": "2026-01-20T14:30:00Z"
    }
  ],
  "generationTime": "3.5s",
  "totalGenerated": 8
}
```

**Errors**:
- `400 Bad Request`: ticketId não fornecido ou inválido
- `401 Unauthorized`: Token inválido
- `403 Forbidden`: Role não é QA/ADMIN
- `500 Server Error`: Erro na geração (OpenAI offline, etc)

---

### POST /api/scenarios/save

**Guarda scenarios depois de aprovação QA.**

**Requer Role**: `QA` ou `ADMIN`

**Request**:
```bash
POST http://localhost:3000/api/scenarios/save
Authorization: Bearer {token}
Content-Type: application/json

{
  "scenarios": [
    {
      "id": "scenario-uuid-1",
      "ticketId": "JX-123",
      "title": "Login com Google",
      "gherkin": "Dado que estou...",
      "type": "HAPPY_PATH"
    }
  ],
  "sprintId": "sprint-uuid-1"
}
```

**Response** (200 OK):
```json
{
  "message": "8 scenarios saved successfully",
  "saved": 8,
  "failed": 0,
  "timestamp": "2026-01-20T14:30:00Z"
}
```

**Errors**:
- `400 Bad Request`: Scenarios inválidos
- `401 Unauthorized`: Token inválido
- `403 Forbidden`: Sem permissão

---

### GET /api/documentation-drafts

**Lista documentação em rascunho/review/approved.**

**Request**:
```bash
GET http://localhost:3000/api/documentation-drafts?status=UNDER_REVIEW
Authorization: Bearer {token}
```

**Query Parameters**:
- `status`: `DRAFT` | `UNDER_REVIEW` | `APPROVED` | `PUBLISHED` (opcional)
- `sprintId`: Filtrar por sprint (opcional)
- `limit`: 50 (default)

**Response** (200 OK):
```json
{
  "drafts": [
    {
      "id": "draft-uuid-1",
      "ticketId": "JX-123",
      "sprintId": "sprint-uuid-1",
      "title": "Feature: OAuth2 Authentication",
      "content": "# OAuth2 Authentication\n\n## Overview\nImplementação de OAuth2...",
      "status": "UNDER_REVIEW",
      "generatedAt": "2026-01-20T10:00:00Z",
      "reviewedAt": "2026-01-20T11:00:00Z",
      "reviewedBy": "qa@company.com",
      "comments": "Falta documentar o fluxo de refresh token",
      "confluencePageId": null,
      "confluencePageUrl": null,
      "publishedAt": null
    }
  ],
  "total": 5
}
```

**Errors**:
- `401 Unauthorized`: Token inválido

---

### GET /api/documentation-drafts/[draftId]

**Detalhes de um rascunho específico.**

**Request**:
```bash
GET http://localhost:3000/api/documentation-drafts/draft-uuid-1
Authorization: Bearer {token}
```

**Response**: Mesmo formato que GET /api/documentation-drafts

---

### POST /api/search

**Busca semântica em tickets e documentação histórica.**

**Request**:
```bash
POST http://localhost:3000/api/search
Authorization: Bearer {token}
Content-Type: application/json

{
  "query": "Como fazer login com OAuth2",
  "type": "tickets",
  "limit": 10
}
```

**Body Parameters**:
- `query` (required): Pergunta em linguagem natural
- `type` (optional): `tickets` | `documentation` | `all` (default: `all`)
- `limit` (optional): Máximo resultados (default: 10)

**Response** (200 OK):
```json
{
  "results": [
    {
      "type": "ticket",
      "id": "JX-101",
      "title": "Implementar OAuth2",
      "description": "Integração com Google/GitHub...",
      "status": "CLOSED",
      "relevance": 0.95,
      "scenarios": 8,
      "documentationUrl": "https://confluence.../oauth2"
    },
    {
      "type": "documentation",
      "id": "doc-uuid-1",
      "title": "OAuth2 Integration Guide",
      "url": "https://confluence.../oauth2-guide",
      "relevance": 0.88,
      "ticketId": "JX-101"
    }
  ],
  "searchTime": "1.2s",
  "timestamp": "2026-01-20T14:30:00Z"
}
```

**Errors**:
- `400 Bad Request`: Query vazia
- `401 Unauthorized`: Token inválido

---

### POST /api/webhooks/jira

**Endpoint para webhooks automáticos do Jira (não requer autenticação).**

**Request** (Jira enviará automaticamente):
```json
{
  "webhookEvent": "jira:issue_created",
  "issue": {
    "key": "JX-123",
    "fields": {
      "summary": "Implementar OAuth2",
      "description": "Integração com provedores...",
      "status": {
        "name": "To Do"
      }
    }
  }
}
```

**Response** (200 OK):
```json
{
  "ok": true,
  "message": "Webhook processed"
}
```

---

### POST /api/webhooks/github

**Endpoint para webhooks automáticos do GitHub (não requer autenticação).**

**Evento: Pull Request Opened**:
```json
{
  "action": "opened",
  "pull_request": {
    "number": 234,
    "title": "Add OAuth2 Provider",
    "body": "Implementação de OAuth2...",
    "head": {
      "repo": {
        "owner": {
          "login": "myorg"
        },
        "name": "myrepo"
      },
      "sha": "abc123..."
    }
  }
}
```

**Response** (200 OK):
```json
{
  "ok": true,
  "devInsight": {
    "id": "insight-uuid",
    "prNumber": 234,
    "impactAreas": ["Auth", "API"],
    "filesChanged": 5,
    "analyzed": true
  }
}
```

---

### GET /api/system/database-status

**Health check da base de dados (público, sem autenticação).**

**Request**:
```bash
GET http://localhost:3000/api/system/database-status
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-01-20T14:30:00Z",
  "responseTime": "15ms"
}
```

**Response** (500 Server Error):
```json
{
  "status": "error",
  "database": "disconnected",
  "error": "Connection refused",
  "timestamp": "2026-01-20T14:30:00Z"
}
```

---

## 🔐 RBAC (Role-Based Access Control)

### Permissions Matrix

| Rota | ADMIN | QA | Developer | DevOps |
|------|-------|----|-----------| -------|
| GET /api/sprints | ✅ | ✅ | ✅ | ✅ |
| POST /api/admin/sprints/sync | ✅ | ❌ | ❌ | ✅ |
| POST /api/scenarios/generate | ✅ | ✅ | ❌ | ❌ |
| POST /api/scenarios/save | ✅ | ✅ | ❌ | ❌ |
| GET /api/documentation-drafts | ✅ | ✅ | ❌ | ❌ |
| POST /api/documentation-drafts/* | ✅ | ✅ | ❌ | ❌ |
| POST /api/search | ✅ | ✅ | ✅ | ✅ |

---

## 🧪 Exemplos de Uso (cURL)

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "123456"
  }'
```

### Sincronizar Sprints
```bash
curl -X POST "http://localhost:3000/api/admin/sprints/sync?type=active" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

### Gerar Scenarios
```bash
curl -X POST http://localhost:3000/api/scenarios/generate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "JX-123",
    "includeEdgeCases": true,
    "includeErrorHandling": true
  }'
```

### Buscar Tickets
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Como fazer login",
    "type": "tickets",
    "limit": 10
  }'
```

---

## 📊 Status Codes

| Code | Significado |
|------|------------|
| 200 | ✅ Sucesso |
| 201 | ✅ Criado com sucesso |
| 400 | ❌ Request inválido |
| 401 | ❌ Não autenticado |
| 403 | ❌ Sem permissão |
| 404 | ❌ Não encontrado |
| 500 | ❌ Erro servidor |

---

**Precisa de ajuda com um endpoint específico? Abre issue no GitHub!** 🚀
