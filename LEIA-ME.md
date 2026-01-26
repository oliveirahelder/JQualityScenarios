# 🎯 JQuality - Plataforma de Qualidade Inteligente

**Bem-vindo ao JQuality!** Uma plataforma moderna que conecta Jira, GitHub e Confluence para automatizar testes e documentação de qualidade.

---

## ❓ O Que É JQuality?

JQuality é uma plataforma que **automatiza e centraliza** todo o processo de testes e documentação:

### O Problema que Resolve
- ❌ QA equipes criam testes **manualmente** após sprints fecharem
- ❌ **Contexto perdido** - código já foi desenvolvido, equipa saiu
- ❌ Documentação fica **desatualizada** e desconectada do código real
- ❌ **Rastreabilidade zero** - impossível saber qual teste cobre qual código

### A Solução JQuality
- ✅ **Antecipa testes** no momento da criação da sprint em Jira
- ✅ **Analisa código** automaticamente quando PRs são abertos em GitHub  
- ✅ **Gera cenários BDD** com contexto completo (Gherkin/Given-When-Then)
- ✅ **100% Rastreabilidade** - cada teste ligado ao código e ticket

### Como Funciona (Pipeline)
```
1. Sprint Criada em Jira
    ↓
2. JQuality Detecta Sprint (Webhook)
    ↓
3. Dev Abre PR em GitHub
    ↓
4. Código Analisado (Impact Analysis)
    ↓
5. Testes Gerados Automaticamente (BDD)
    ↓
6. QA Revê e Aprova
    ↓
7. Publicado em Confluence (Documentação "As-Built")
```

---

## 🎯 Fases de Desenvolvimento

### ✅ Fase 1: Fundação (Concluído)
- Base de dados PostgreSQL
- Autenticação JWT
- API REST completa
- UI Dashboard

### ✅ Fase 2: Sprint & Histórico (Concluído)
- Listener de Sprints Jira (webhooks)
- Análise de código GitHub
- Busca semântica com IA
- Lookup histórico de tickets

### 🚀 Fase 3: Deploy & QA (Em Progresso)
- CI/CD webhook integration
- Trigger de deploy em Staging
- Dashboard QA para evidências
- Publishing automático em Confluence

### 📋 Depois (Futuro)
- Geração automática de scripts (Cypress/Playwright)
- Dashboards de Lead Time
- Suporte multi-org

---

## 👥 Papéis & Permissões

| Papel | Pode Fazer | Acesso |
|-------|-----------|--------|
| **QA** | Criar/revisar/publicar testes | Cenários, Documentação |
| **Developer** | Ver insights de código | Apenas leitura |
| **DevOps** | Gerir deploys | Webhooks, Sync |
| **Admin** | Tudo | Sistema inteiro |

---

## 🏗️ Tecnologia

| Componente | Tecnologia |
|-----------|-----------|
| **Frontend** | Next.js 14 + Tailwind CSS |
| **Backend** | Node.js API Routes |
| **BD** | PostgreSQL + Prisma ORM |
| **IA** | Gemini Pro (análise) + OpenAI (geração) |
| **Integrações** | Jira, GitHub, Confluence APIs |

---

## 📚 Documentação Disponível

| Documento | Para Quem | O Quê |
|-----------|----------|-------|
| [SETUP_PT.md](SETUP_PT.md) | Devs / DevOps | Como instalar & configurar |
| [FEATURES.md](FEATURES.md) | Todos | O que cada funcionalidade faz |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Todos | Referência rápida |
| [API_ROUTES.md](API_ROUTES.md) | Devs | Endpoints disponíveis |

---

## 🚀 Quick Start (5 minutos)

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+ (ou Docker)
- Chaves de API (Jira, GitHub, etc)

### Passos
```bash
# 1. Clonar e instalar
cd c:\Users\helder.oliveira\Desktop\QABOT\JQualityScenarios
npm install

# 2. Configurar base de dados e variáveis
cp .env.example .env.local
# → Editar .env.local com teus valores

# 3. Inicializar BD
npx prisma migrate dev

# 4. Iniciar servidor
npm run dev

# 5. Abrir no browser
# → http://localhost:3000
```

**Precisa de ajuda?** Lê [SETUP_PT.md](SETUP_PT.md) para instruções detalhadas.

---

## 🎮 Primeiros Passos

### 1️⃣ Criar uma Conta
- Vai a `http://localhost:3000/login`
- Clica em "Register"
- Define username/password

### 2️⃣ Explorar Sprints
- Vai a Dashboard → Sprints
- Clica em "Sync from Jira"
- Vê tuas sprints e tickets

### 3️⃣ Gerar Testes
- Seleciona uma sprint
- Clica em ticket
- Clica "Generate Scenarios"
- Vê BDD scenarios gerados

### 4️⃣ Publicar Documentação
- Vai a Documentação
- Revê drafts gerados
- Aprova e clica "Publish to Confluence"

---

## 📊 Exemplo de Uso Real

**Sprint**: "Login API Refactor"  
**Ticket**: JX-123 - "Migrar auth para OAuth2"

### O que JQuality faz:
1. **Dev abre PR** - Mudanças em auth.ts, jwt.ts
2. **JQuality analisa** - Detecta: DB Schema, Auth, API impactados
3. **IA gera testes**:
   ```gherkin
   Cenário: Fazer login com OAuth2
     Dado que estou na página de login
     Quando faço login com Google
     Então sou redireccionado para dashboard
     E meu token JWT é criado
   ```
4. **QA revê** - Aprova ou pede mudanças
5. **Publica** - Scenario + código linkado em Confluence

**Resultado**: Documentação "as-built" com 100% rastreabilidade ✅

---

## ❓ Perguntas Frequentes

### P: Preciso de internet para usar?
**R**: Não, a plataforma roda local. Mas integrações (Jira, GitHub, Confluence) precisam de API.

### P: Posso usar com JIRA em cloud?
**R**: Sim! Suporta tanto JIRA Cloud como Server.

### P: Qual é a performance?
**R**: Análise de código é quase instantânea. Publicar em Confluence demora ~5s.

### P: Como faço backup dos dados?
**R**: Use `pg_dump` ou o backup da tua plataforma de BD.

### P: Posso ter múltiplas organizações?
**R**: Fase 3 vai adicionar suporte para isto.

---

## 🆘 Precisa de Ajuda?

1. **Setup?** → [SETUP_PT.md](SETUP_PT.md)
2. **Features?** → [FEATURES.md](FEATURES.md)  
3. **APIs?** → [API_ROUTES.md](API_ROUTES.md)
4. **Problemas?** → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 📄 Licença

Proprietary - JQuality Platform 2026

---

**Boa sorte! 🚀**
