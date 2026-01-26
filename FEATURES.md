# 🎯 Funcionalidades - Guia Completo

---

## 1️⃣ Sprints Management (Gestão de Sprints)

### O que é?
Centralizar todas as tuas sprints do Jira num único lugar, com análise de impacto em tempo real.

### Como usar?

#### Sincronizar Sprints do Jira
1. Vai a **Dashboard** → **Sprints**
2. Clica botão **"Sync from Jira"** (canto superior direito)
3. Aguarda ~5 segundos
4. Verás todas as tuas sprints carregadas

#### Ver Detalhes de uma Sprint
1. Clica numa sprint na lista
2. Vês:
   - 📊 **Status da Sincronização** - Última vez que sincronizou
   - 📋 **Tickets** - Lista completa da sprint
   - 🔴 **Code Impact** - Áreas afetadas por mudanças
   - 🧪 **Test Scenarios** - Testes gerados
   - 📄 **Documentation** - Status de documentação

#### Interpretar Code Impact Colors
- 🔴 **Vermelho** (Alto risco) - BD Schema, Autenticação, APIs
- 🟡 **Amarelo** (Médio risco) - Error Handling, Performance, Config
- 🔵 **Azul** (Padrão) - UI, Tests, Dependencies

### Métricas por Sprint
```
📊 Exemplo de Sprint: "Login Refactor"
├─ Tickets: 4
├─ Completed: 3
├─ PRs Analisados: 7
├─ Impactos Detectados: 3 (Auth, API, DB)
├─ Testes Gerados: 12
├─ Documentação: 2 em Review, 1 Published
└─ QA Bounce-back Rate: 5%
```

---

## 2️⃣ Scenario Generation (Geração de Testes)

### O que é?
Gera automaticamente cenários de teste em formato **BDD/Gherkin** (Dado/Quando/Então) a partir de tickets Jira.

### Como usar?

#### Gerar Scenarios para um Ticket
1. Vai a **Sprints** → seleciona uma sprint
2. Clica num **ticket**
3. Clica botão **"Generate Scenarios"**
4. Vê scenarios gerados em ~3-5 segundos em formato:
   ```gherkin
   Cenário: Login com OAuth2
     Dado que estou na página de login
     Quando clico em "Login com Google"
     Então sou redireccionado para dashboard
     E recebo um token JWT válido
   ```

#### Interpretar Scenarios
Cada scenario tem:
- ✅ **Given** (Dado) - Situação inicial
- ✅ **When** (Quando) - Ação do utilizador
- ✅ **Then** (Então) - Resultado esperado
- ✅ **And** (E) - Passos adicionais

#### Editar/Refinar Scenarios
1. Clica em scenario gerado
2. Clica "Edit" (caneta)
3. Modifica texto
4. Clica "Save"

#### Guardar Scenarios
1. Seleciona scenarios
2. Clica **"Save Scenarios"**
3. Confirma
4. Scenarios ficam guardados para QA revisar

### Exemplo Prático
**Ticket Jira**: JX-123 - "Implementar Two-Factor Authentication"

**Scenarios Gerados**:
```gherkin
Cenário 1: ativar 2FA com TOTP
  Dado que estou logado
  Quando acesso "Security Settings"
  E clico "Enable 2FA"
  Então recebo código QR
  E consigo adicionar app de autenticação

Cenário 2: falhar login sem 2FA code
  Dado que 2FA está ativado
  Quando tento fazer login
  Então peço por código de verificação
  E rejeito login inválido
```

---

## 3️⃣ Documentation Pipeline (Publicação de Documentação)

### O que é?
Gera automaticamente documentação "As-Built" (conforme construído) e publica em Confluence com controle de QA.

### Estados de Documentação
1. 📝 **Draft** - Gerado por IA, precisa revisão
2. 🔍 **Under Review** - QA está a analisar
3. ✅ **Approved** - Pronto para publicar
4. 📄 **Published** - Ao vivo em Confluence

### Como usar?

#### Ver Drafts em Review
1. Vai a **Documentation** → **Drafts**
2. Vês lista de documentação aguardando revisão
3. Clica num draft para ver preview

#### Revisar Documentação
1. Clica draft
2. Lê conteúdo gerado
3. Se correto: clica **"Approve"**
4. Se precisa mudanças: clica **"Request Changes"** e comenta

#### Publicar em Confluence
1. Clica draft **Approved**
2. Clica **"Publish to Confluence"**
3. Escolhe página de destino (ou cria nova)
4. Confirma
5. Documentação publicada com ligação automática ao ticket Jira

#### Exemplo de Documentação Gerada
```markdown
# Feature: OAuth2 Authentication

**Ticket**: JX-123  
**Sprint**: "Login Refactor"  
**Status**: Published

## Overview
Implementação de OAuth2 para login simplificado...

## Scenarios
- ✅ Login com Google
- ✅ Login com GitHub
- ✅ Fallback para email/password

## Code Impact
- Modified: auth.ts, jwt.ts, user.service.ts
- PR: #456
- Reviewer: @john.dev

## Test Coverage
- Unit Tests: 12
- Integration Tests: 8
- E2E Tests: 5
```

---

## 4️⃣ Code Impact Analysis (Análise de Código)

### O que é?
Análise automática de PRs no GitHub para detectar quais áreas do código foram mudadas.

### Impactos Detectados
- 🔴 **High Risk**: BD Schema, Autenticação, APIs críticas
- 🟡 **Medium Risk**: Error Handling, Performance, Config
- 🔵 **Standard**: UI, Testes, Dependencies

### Como ver?

#### Em Sprints View
1. Vai a **Sprints**
2. Vê coluna **"Impact"** nos tickets
3. Clica para ver detalhes

#### Em Ticket Detail
1. Clica num ticket
2. Vê seção **"Code Changes"**
3. Mostra:
   - Ficheiros alterados por diretório
   - Linhas added/removed
   - Commits associados

#### Exemplos de Impactos Detectados
```
✅ "Refactor login page" PR
   📝 Modified: src/pages/login.tsx
   📝 Modified: src/components/LoginForm.tsx
   └─ Impacto: UI (blue - standard)

✅ "Add OAuth2 provider" PR
   📝 Modified: src/services/auth.ts
   📝 Modified: src/models/user.ts
   📝 Modified: src/middleware.ts
   └─ Impacto: Auth + API (red - high risk)
```

---

## 5️⃣ Search & Historical Lookup (Busca Histórica)

### O que é?
Busca inteligente em histórico de tickets e documentação usando IA semântica.

### Como usar?

#### Buscar Tickets
1. Vai a **Search** → aba **"Tickets"**
2. Escreve query em linguagem natural:
   - "Como faço login com Google?"
   - "Quais tickets mexeram em autenticação?"
   - "Bugs em pagamentos"
3. Clica **"Search"**
4. Vês resultados ordenados por relevância

#### Buscar Documentação
1. Vai a **Search** → aba **"Documentation"**
2. Busca similar
3. Vês páginas Confluence relacionadas
4. Clica para ler documentação

#### Usar Histórico
1. Quando crias scenarios, JQuality sugere:
   - Tickets relacionados já feitos
   - Documentação publicada anterior
   - Padrões de teste anteriores

### Exemplo de Busca
```
Query: "API de login"

Resultados:
1. JX-101 - "Implementar login com email/password" ✅ Closed
   └─ Relevância: 95%
   └─ Cenários: 8
   └─ Documentação: Published

2. JX-56 - "Adicionar OAuth2 providers" ✅ Closed
   └─ Relevância: 87%
   └─ Cenários: 12
   └─ Documentação: Published

3. JX-312 - "Fix login session timeout bug" ✅ Closed
   └─ Relevância: 72%
   └─ Cenários: 3
   └─ Documentação: Published
```

---

## 6️⃣ Dashboard & Reports (Dashboards e Relatórios)

### Tipos de Dashboards

#### Sprints Dashboard
Visão geral de todas as sprints:
- Sprints ativas vs fechadas
- Tickets por status
- Taxa de conclusão
- QA bounce-back rate

#### QA Dashboard (Fase 3)
Focado em qualidade:
- Scenarios gerados
- Documentação em review
- Tickets com cobertura baixa
- Tempo médio de review

#### Metrics Dashboard
Análise histórica:
- Lead time por ticket
- Scenarios por tipo (happy path, edge cases, etc)
- Taxa de rejeição
- Documentação time-to-publish

### Exemplo de Report
```
📊 SPRINT REPORT: "Payment Integration"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Métricas:
├─ Tickets: 6
├─ Completed: 5 (83%)
├─ PRs: 12
├─ Code Changes: 450 lines
├─ Tests Generated: 34
├─ Docs Published: 4
└─ QA Bounce Rate: 8%

🎯 Impactos Detectados:
├─ API: 3 changes
├─ BD: 2 changes
├─ Auth: 1 change
└─ Error Handling: 2 changes

⏱️ Timeline:
├─ Sprint Created: 15 Jan 2026
├─ First Scenario: 16 Jan (4h)
├─ Last Scenario: 22 Jan
├─ First Published Doc: 18 Jan
└─ Last Published Doc: 23 Jan
```

---

## 7️⃣ Settings & Administration (Configuração)

### User Management
1. Vai a **Settings** → **Users** (Admin only)
2. Cria/remove utilizadores
3. Atribui roles: QA, Developer, DevOps, Admin

### Integration Settings
1. Vai a **Settings** → **Integrations**
2. Valida conexões:
   - Jira ✅/❌
   - GitHub ✅/❌
   - Confluence ✅/❌
3. Testa webhooks

### API Configuration
1. Vai a **Settings** → **API Keys** (Admin)
2. Regenera chaves (se comprometidas)
3. Ver histórico de últimas sincronizações

---

## 📊 Fluxo Completo: Exemplo Prático

**Cenário**: Equipa desenvolve "Feature de Pagamentos"

### Dia 1: Criar Sprint
```
1. PM cria Sprint em Jira: "Payment Integration"
2. Adiciona 4 tickets:
   - JX-501: Payment API
   - JX-502: Payment UI
   - JX-503: Refund Logic
   - JX-504: Payment Webhooks
```

### Dia 2: Primeira Sincronização
```
1. DevOps clica "Sync from Jira"
2. JQuality carrega todos os tickets
3. Estão no estado "To Do"
```

### Dia 3-5: Desenvolvimento
```
1. Dev abre PR #234: "Add Payment API"
2. JQuality detecta:
   - 450 linhas alteradas
   - 3 ficheiros: payment.ts, api/payment.ts, models/transaction.ts
   - Impacto: API, DB Schema (🔴 High Risk)
3. Dev abre PR #235: "Payment UI"
4. JQuality detecta:
   - 180 linhas alteradas
   - UI components
   - Impacto: UI (🔵 Standard)
```

### Dia 6: QA - Gerar Testes
```
1. QA vai a Sprints
2. Clica em JX-501 "Payment API"
3. Clica "Generate Scenarios"
4. JQuality gera 8 cenários BDD:
   ✅ Create payment intent
   ✅ Process payment with card
   ✅ Handle payment failure
   ✅ Process refund
   ✅ Invalid amount validation
   ✅ Duplicate payment protection
   ✅ Webhook retry logic
   ✅ Payment confirmation email
5. QA revê e aprova (ou pede mudanças)
6. Clica "Save Scenarios"
```

### Dia 7: Documentação
```
1. JQuality gera Documentation Draft
2. Contém:
   - Ticket ref (JX-501)
   - PRs linkados (#234)
   - Code impact areas
   - Test scenarios
   - Author, dates
3. QA revê draft em "Documentation"
4. Clica "Approve"
5. Clica "Publish to Confluence"
6. Documentação "As-Built" live com 100% rastreabilidade
```

### Resultado Final
```
📊 Sprint Completo com:
├─ Todas as sprints sincronizadas
├─ Code impact analisado automaticamente
├─ 32 test scenarios gerados
├─ 4 documentos publicados
├─ 100% rastreabilidade (ticket → código → teste → docs)
└─ QA bounce rate: 0% (tudo foi certo!)
```

---

## 🎯 Resumo de Funcionalidades por Papel

### Para QA
- ✅ Gerar scenarios BDD automaticamente
- ✅ Revisar e aprovar documentação
- ✅ Publicar em Confluence
- ✅ Buscar tickets/docs históricos
- ✅ Ver test coverage gaps

### Para Developers
- ✅ Ver impacto do seu código
- ✅ Acesso a read-only de tickets
- ✅ Consultar scenarios para suas features

### Para DevOps
- ✅ Sincronizar sprints manualmente
- ✅ Gerir webhooks
- ✅ Monitorar integrações
- ✅ Ver relatórios de deployment

### Para Admin
- ✅ Tudo!
- ✅ Gerir utilizadores
- ✅ Configurar integrações
- ✅ Ver sistema completo

---

**Próximo**: Lê [QUICK_REFERENCE.md](QUICK_REFERENCE.md) para referência rápida! 🚀
