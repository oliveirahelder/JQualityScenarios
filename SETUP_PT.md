# 🔧 Guia de Setup - JQuality

**Versão**: 1.0  
**Última atualização**: Janeiro 2026

---

## 📋 Pré-requisitos

Antes de começar, certifica-te que tens:

- ✅ **Node.js 18+** - [Download](https://nodejs.org/)
- ✅ **PostgreSQL 14+** - [Download](https://www.postgresql.org/) ou [Docker](https://www.docker.com/)
- ✅ **Git** - [Download](https://git-scm.com/)
- ✅ **VS Code** (recomendado) - [Download](https://code.visualstudio.com/)

### Verificar versões instaladas
```bash
node --version      # deve mostrar v18.x ou superior
npm --version       # deve mostrar 9.x ou superior
psql --version      # deve mostrar 14+ ou superior (se instalado)
```

---

## 🚀 Step 1: Preparar o Projeto

### 1.1 Navegar para a pasta
```bash
cd c:\Users\helder.oliveira\Desktop\QABOT\JQualityScenarios
```

### 1.2 Instalar dependências
```bash
npm install
```

**⏱️ Tempo**: ~3 minutos (primeira vez)  
**✅ Sucesso**: Vê `added XXX packages`

---

## 🗄️ Step 2: Configurar Base de Dados

### Opção A: PostgreSQL Local (Windows)

#### Passo 1: Instalar PostgreSQL
1. Download: https://www.postgresql.org/download/windows/
2. Executa o installer
3. Durante setup:
   - Password do `postgres`: `123456` (ou teu gosto)
   - Port: `5432` (default)
4. Termina setup

#### Passo 2: Criar Database
```bash
# Abre prompt de comando (cmd)
psql -U postgres

# Escreve (no prompt psql):
CREATE DATABASE qabot_dev;

# Sai:
\q
```

**✅ Sucesso**: Database criada sem erros

---

### Opção B: PostgreSQL com Docker (Recomendado)

#### Passo 1: Instalar Docker
- Download: https://www.docker.com/products/docker-desktop
- Instala e reinicia

#### Passo 2: Iniciar PostgreSQL em container
```bash
docker run --name qabot-db ^
  -e POSTGRES_PASSWORD=123456 ^
  -e POSTGRES_USER=postgres ^
  -e POSTGRES_DB=qabot_dev ^
  -p 5432:5432 ^
  -d postgres:14
```

**✅ Sucesso**: Container criado

#### Passo 3: Verificar conexão
```bash
docker logs qabot-db
```

Deve mostrar: `database system is ready to accept connections`

---

### Opção C: Managed Database (Produção)

Se preferes não gerir BD localmente:

**Neon** (Recomendado)
1. Vai a https://neon.tech/
2. Clica "Sign Up"
3. Cria projeto
4. Copia Connection String
5. Vai ao Step 3 (abaixo)

**Alternativas**:
- Supabase: https://supabase.com/
- AWS RDS: https://aws.amazon.com/rds/
- Railway: https://railway.app/

---

## ⚙️ Step 3: Configurar Variáveis de Ambiente

### 3.1 Copiar template
```bash
cp .env.example .env.local
```

### 3.2 Editar `.env.local`
Abre o ficheiro `.env.local` no VS Code e preenche:

```bash
# 📊 BASE DE DADOS
DATABASE_URL="postgresql://postgres:123456@localhost:5432/qabot_dev"

# 🔑 JIRA (Obtém em https://id.atlassian.com/manage-profile/security/api-tokens)
JIRA_BASE_URL="https://tua-domain.atlassian.net"
JIRA_USER="teu-email@company.com"
JIRA_API_TOKEN="ATxxxxxxxxxxxxxxx"

# 🐙 GITHUB (Obtém em https://github.com/settings/tokens)
GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
GITHUB_BASE_URL="https://api.github.com"

# 📄 CONFLUENCE (Mesmo token que Jira)
CONFLUENCE_BASE_URL="https://tua-domain.atlassian.net/wiki"
CONFLUENCE_USER="teu-email@company.com"
CONFLUENCE_API_TOKEN="ATxxxxxxxxxxxxxxx"

# 🤖 IA SERVICES
OPENAI_API_KEY="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
GEMINI_API_KEY="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 🔐 AUTENTICAÇÃO
JWT_SECRET="meu-secret-muito-seguro-123456789"
JWT_EXPIRES_IN="7d"

# 🌐 APLICAÇÃO
NEXT_PUBLIC_API_URL="http://localhost:3000"
NODE_ENV="development"
```

### ⚠️ Importante
- **Nunca** commits `.env.local` para Git!
- Cada dev deve ter sua própria cópia
- Em produção, usar variáveis de sistema/CI-CD

---

## 🔑 Step 4: Obter Chaves de API

### 4.1 JIRA API Token

1. Vai a: https://id.atlassian.com/manage-profile/security/api-tokens
2. Clica: "Create API token"
3. Nomeia: "JQuality Local Dev"
4. Clica: "Create"
5. **Copia** o token (vai desaparecer!)
6. Cola em `.env.local` → `JIRA_API_TOKEN`

**Permissões necessárias**:
- Leitura de sprints
- Leitura de issues
- Leitura de comentários

---

### 4.2 GITHUB Personal Access Token

1. Vai a: https://github.com/settings/tokens
2. Clica: "Generate new token" → "Generate new token (classic)"
3. Nomeia: "jquality-local"
4. Seleciona scopes:
   - ✅ `repo` (full control)
   - ✅ `read:org`
5. Clica: "Generate token"
6. **Copia** o token
7. Cola em `.env.local` → `GITHUB_TOKEN`

**Permissões necessárias**:
- Leitura de PRs
- Leitura de commits
- Leitura de repositórios

---

### 4.3 CONFLUENCE Token

Usa o **mesmo token do Jira** para Confluence (mesma plataforma Atlassian).

---

### 4.4 OpenAI API Key

1. Vai a: https://platform.openai.com/api-keys
2. Clica: "Create new secret key"
3. **Copia** a chave
4. Cola em `.env.local` → `OPENAI_API_KEY`

**Nota**: Pode ter custos (~$0.01 por 1000 requests)

---

### 4.5 Google Gemini API Key

1. Vai a: https://makersuite.google.com/app/apikey
2. Clica: "Create API Key"
3. **Copia** a chave
4. Cola em `.env.local` → `GEMINI_API_KEY`

**Nota**: Free tier limitado (60 requests/minuto)

---

## 🗄️ Step 5: Inicializar Base de Dados

### 5.1 Criar tabelas

```bash
npx prisma migrate dev --name init
```

Este comando:
- ✅ Cria todas as tabelas
- ✅ Aplica índices
- ✅ Cria relacionamentos

**⏱️ Tempo**: ~10 segundos  
**✅ Sucesso**: Mensagem `Database has been successfully created with a new migration`

### 5.2 (Opcional) Verificar schema

```bash
npx prisma studio
```

Abre UI visual da base de dados em `http://localhost:5555`

---

## ✅ Step 6: Verificar Setup

### 6.1 Testar conectividade

```bash
# Testar conexão Jira
node -e "console.log('✅ Node.js OK')"

# Testar Node modules
node -e "require('next'); console.log('✅ Next.js OK')"

# Testar BD
npx prisma db execute --stdin < nul
```

---

## 🚀 Step 7: Iniciar Servidor

### 7.1 Modo desenvolvimento
```bash
npm run dev
```

**Output esperado**:
```
▲ Next.js 14.0.0
- Local:        http://localhost:3000
- Environments: .env.local
```

**✅ Sucesso**: Sem erros em vermelho

### 7.2 Abrir aplicação
Abre no browser: **http://localhost:3000**

Deves ver a página de Login ✅

---

## 👤 Step 8: Criar Primeira Conta

### 8.1 Register
1. Clica em "Register"
2. Preenche:
   - Username: `admin`
   - Password: `123456` (ou escolhe)
3. Clica "Sign Up"

### 8.2 Login
1. Username: `admin`
2. Password: `123456`
3. Clica "Login"

### 8.3 Ver Dashboard
Deves ver:
- Sprints (vazio por enquanto)
- Scenarios
- Documentation
- Settings

---

## 🔄 Step 9: Testar Jira Integration

### 9.1 Sincronizar sprints

1. Vai a **Sprints** → clica botão "Sync from Jira"
2. Aguarda ~5 segundos
3. Deves ver tuas sprints e tickets carregados

**❌ Não vê dados?**
- Verifica `JIRA_BASE_URL` (sem barra final)
- Verifica `JIRA_API_TOKEN` está correto
- Verifica terminal de erros

---

## 🧪 Step 10: Testar Funcionalidades

### Teste 1: Gerar Scenarios
1. Clica numa sprint
2. Clica num ticket
3. Clica "Generate Scenarios"
4. Vê BDD scenarios gerados em ~3-5 segundos

### Teste 2: Buscar Tickets
1. Vai a **Search**
2. Escreve: "login"
3. Clica "Search"
4. Deves ver tickets relacionados

### Teste 3: Ver Insights
1. Volta a **Sprints**
2. Clica num ticket com PR
3. Vê "Code Impact" e "Scenarios Count"

---

## 📝 Environment Variables Completa

```bash
# ============= DATABASE =============
DATABASE_URL="postgresql://user:password@host:port/database"

# ============= JIRA =============
JIRA_BASE_URL="https://yourcompany.atlassian.net"
JIRA_USER="email@company.com"
JIRA_API_TOKEN="ATxxxxxxxxxxxxxxxxxxxxxxx"

# ============= GITHUB =============
GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
GITHUB_BASE_URL="https://api.github.com"
GITHUB_OWNER="your-org"
GITHUB_REPO="your-repo"

# ============= CONFLUENCE =============
CONFLUENCE_BASE_URL="https://yourcompany.atlassian.net/wiki"
CONFLUENCE_USER="email@company.com"
CONFLUENCE_API_TOKEN="ATxxxxxxxxxxxxxxxxxxxxxxx"
CONFLUENCE_SPACE="~email.company.com"

# ============= AI SERVICES =============
OPENAI_API_KEY="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
OPENAI_MODEL="gpt-4o-mini"
GEMINI_API_KEY="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# ============= AUTHENTICATION =============
JWT_SECRET="your-super-secret-key-min-32-chars"
JWT_EXPIRES_IN="7d"

# ============= APPLICATION =============
NEXT_PUBLIC_API_URL="http://localhost:3000"
NODE_ENV="development"
LOG_LEVEL="info"
```

---

## 🆘 Troubleshooting

### Problema: "Cannot find module 'next'"
**Solução**:
```bash
npm install
```

### Problema: "database does not exist"
**Solução**:
```bash
npx prisma migrate dev --name init
```

### Problema: "Connection refused (localhost:5432)"
**Solução**: PostgreSQL não está a correr
```bash
# Se instalou localmente:
net start postgresql-x64-14

# Se usa Docker:
docker start qabot-db
```

### Problema: "JIRA_API_TOKEN is invalid"
**Solução**: Regenera novo token em https://id.atlassian.com/manage-profile/security/api-tokens

### Problema: "Next.js port 3000 already in use"
**Solução**:
```bash
npm run dev -- -p 3001
```

---

## 📚 Próximos Passos

Depois de setup:

1. **Ler** [LEIA-ME.md](LEIA-ME.md) para entender funcionalidades
2. **Explorar** [FEATURES.md](FEATURES.md) para ver tudo que podes fazer
3. **Consultar** [QUICK_REFERENCE.md](QUICK_REFERENCE.md) para referência rápida
4. **Estudar** [API_ROUTES.md](API_ROUTES.md) se vais fazer development

---

## 🎉 Pronto!

Parabéns, JQuality está a correr! 🚀

**Próximo passo**: Vai a http://localhost:3000 e cria uma conta.
