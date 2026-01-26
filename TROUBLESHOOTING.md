# 🆘 Troubleshooting - Guia de Problemas

**Procura rápida para problemas comuns e soluções.**

---

## 🔴 Problemas Gerais

### "Cannot find module 'next'"
**Causa**: Dependências não instaladas  
**Solução**:
```bash
npm install
npm run prisma:generate
```

### "Port 3000 already in use"
**Causa**: Outra aplicação a usar a porta  
**Solução** (escolhe uma):
```bash
# Opção 1: Usar porta diferente
npm run dev -- -p 3001

# Opção 2: Matar processo na porta 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID {PID} /F
```

### "Module not found" (TypeScript)
**Causa**: Cache do TypeScript desatualizado  
**Solução**:
```bash
rm -r node_modules .next
npm install
npm run prisma:generate
npm run dev
```

---

## 🗄️ Problemas de Base de Dados

### "ECONNREFUSED - Connection refused (localhost:5432)"
**Causa**: PostgreSQL não está a correr  
**Solução**:

#### Se instalou PostgreSQL localmente:
```bash
# Windows - Abrir Services
net start postgresql-x64-14

# ou procurar "Services" no Windows e iniciar PostgreSQL
```

#### Se usa Docker:
```bash
# Ver containers
docker ps -a

# Iniciar container PostgreSQL
docker start qabot-db

# Ver logs
docker logs qabot-db
```

---

### "Database does not exist"
**Causa**: Tabelas não foram criadas  
**Solução**:
```bash
npx prisma migrate dev --name init
```

---

### "Prisma error: P1017"
**Causa**: String de conexão à BD incorreta  
**Solução**:
1. Verifica `.env.local`:
   ```bash
   DATABASE_URL="postgresql://postgres:password@localhost:5432/qabot_dev"
   ```
2. Confirma:
   - `user` (postgres)
   - `password` (a que definiste)
   - `host` (localhost)
   - `port` (5432)
   - `database` (qabot_dev)

---

### "Duplicate key value violates unique constraint"
**Causa**: Dados duplicados na BD  
**Solução**:
```bash
# Ver dados problema
SELECT * FROM "{TableName}" WHERE id = 'problema-id';

# Apagar
DELETE FROM "{TableName}" WHERE id = 'problema-id';

# Ou fazer reset completo (CUIDADO!)
npx prisma migrate reset
npx prisma migrate dev --name init
```

---

### "Migration failed"
**Causa**: Migração com conflito  
**Solução**:
```bash
# Ver status
npx prisma migrate status

# Resolver manualmente
npx prisma migrate resolve --rolled-back 20260124034020_add_sprint_snapshots

# Reexecutar
npx prisma migrate dev
```

---

## 🔑 Problemas de Autenticação & API Keys

### "JIRA_API_TOKEN is invalid" ou "401 Unauthorized"
**Causa**: Token Jira expirado ou incorreto  
**Solução**:
1. Vai a https://id.atlassian.com/manage-profile/security/api-tokens
2. Apaga token antigo
3. Cria novo
4. Copia para `.env.local` → `JIRA_API_TOKEN`

---

### "GitHub API rate limit exceeded"
**Causa**: Limite de 60 requests/hora atingido  
**Solução**:
1. Espera 1 hora
2. Ou cria token com permissões maiores
3. Verifica token em https://github.com/settings/tokens

---

### "OPENAI_API_KEY is missing or invalid"
**Causa**: Chave OpenAI não configurada ou expirada  
**Solução**:
1. Vai a https://platform.openai.com/api-keys
2. Cria nova chave
3. Atualiza `.env.local` → `OPENAI_API_KEY`
4. Verifica se tens créditos disponíveis

---

### "GEMINI_API_KEY is not valid"
**Causa**: Chave Google Gemini inválida  
**Solução**:
1. Vai a https://makersuite.google.com/app/apikey
2. Cria nova API key
3. Atualiza `.env.local` → `GEMINI_API_KEY`

---

## 🚀 Problemas de Desenvolvimento

### Estilos (Tailwind) não aparecem
**Causa**: Tailwind CSS não foi compilado  
**Solução**:
```bash
# Reinstalar Tailwind
npm install -D tailwindcss postcss autoprefixer
npm run dev
```

---

### Componentes UI não aparecem corretamente
**Causa**: ShadcnUI não configurado  
**Solução**:
```bash
# Regenerar componentes
npx shadcn-ui init

# Se ainda não funcionar, instalar componente específico
npx shadcn-ui add button
```

---

### Hot reload não funciona
**Causa**: Ficheiro `.next` corrompido  
**Solução**:
```bash
rm -r .next
npm run dev
```

---

## 🌐 Problemas de Integração

### "Jira board/sprint not found"
**Causa**: JIRA_BASE_URL incorreto ou sem acesso  
**Solução**:
1. Confirma URL:
   - ✅ Correto: `https://seudominio.atlassian.net`
   - ❌ Errado: `https://seudominio.atlassian.net/` (barra final)
2. Verifica acesso: Consegues aceder via browser?
3. Testa manualmente:
   ```bash
   curl -u "email@company.com:TOKEN" \
     "https://seudominio.atlassian.net/rest/api/3/board"
   ```

---

### "GitHub webhook not triggered"
**Causa**: Webhook não configurado ou URL incorreta  
**Solução**:
1. Vai a GitHub Settings → Webhooks
2. Verifica se URL é: `https://teu-domain/api/webhooks/github`
3. Testa webhook: clica "Redeliver"
4. Ver logs: `GET /api/webhooks/github`

---

### "Confluence page not found"
**Causa**: Page ID ou Space inválido  
**Solução**:
1. Verifica `CONFLUENCE_SPACE` em `.env.local`
2. Formato: `~email.company.com` (sem domínio)
3. Testa manualmente:
   ```bash
   curl -u "email@company.com:TOKEN" \
     "https://dominio.atlassian.net/wiki/api/v2/spaces"
   ```

---

## 📊 Problemas de Dados

### "Sprints não aparecem depois de sync"
**Causa**: Sprints vazias ou nenhuma board configurada  
**Solução**:
1. Verifica se tens sprints em Jira
2. Confirma `JIRA_BASE_URL` está correto
3. Mira logs: `npm run dev` (vê erros em output)
4. Testa manualmente:
   ```bash
   curl -u "email:TOKEN" \
     "https://dominio.atlassian.net/rest/api/3/board"
   ```

---

### "Scenarios não geram (timeout)"
**Causa**: OpenAI API lenta ou sem resposta  
**Solução**:
1. Verifica status OpenAI: https://status.openai.com/
2. Tenta novamente (timeout pode ser temporário)
3. Se problema persistir, aumenta timeout em código

---

### "Search returns zero results"
**Causa**: Nenhum histórico ou índice vazio  
**Solução**:
1. Executa sincronização completa: `POST /api/admin/sprints/sync`
2. Aguarda alguns segundos
3. Tenta novamente

---

## 💾 Problemas de Deploy

### "Build fails with 'next build'"
**Causa**: Erros TypeScript ou imports quebrados  
**Solução**:
```bash
# Ver erros específicos
npm run build

# Corrigir imports
npm run lint -- --fix

# Tentar novamente
npm run build
```

---

### "Production site não carrega"
**Causa**: Environment variables não definidas em produção  
**Solução**:
1. Verifica que `NODE_ENV="production"`
2. Todos os `.env` vars estão definidos no servidor
3. Testa: `npm run build && npm start`

---

## 🔍 Debug & Logging

### Ver logs detalhados
```bash
# Com debug mode
DEBUG=prisma:* npm run dev

# Com custom logging
NODE_DEBUG=* npm run dev
```

---

### Testar endpoint específico
```bash
# Ver token
curl http://localhost:3000/api/auth/login

# GET request
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/sprints

# POST request
curl -X POST http://localhost:3000/api/scenarios/generate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"ticketId":"JX-123"}'
```

---

### Verificar BD direto
```bash
# Abrir Prisma Studio
npx prisma studio

# Depois vai a http://localhost:5555
```

---

## 📋 Checklist de Troubleshooting

Quando algo quebra:

- [ ] Verifica erros em vermelho no terminal
- [ ] Recarrega página no browser (Ctrl+Shift+R)
- [ ] Reinicia servidor (`Ctrl+C` e `npm run dev`)
- [ ] Verifica `.env.local` tem todas as variáveis
- [ ] Verifica BD está a correr (`docker ps` ou Services)
- [ ] Verifica APIs externas (Jira, GitHub, OpenAI) estão online
- [ ] Limpa cache (`rm -r node_modules .next` e `npm install`)
- [ ] Consulta logs: `npm run dev` output
- [ ] Abre issue no GitHub com erro específico

---

## 🆘 Último Recurso

Se nada funcionar:

1. **Reset completo**:
   ```bash
   # BD
   npx prisma migrate reset
   
   # Node modules
   rm -r node_modules && npm install
   
   # Cache
   rm -r .next
   
   # Reiniciar
   npm run dev
   ```

2. **Procura no GitHub**:
   - Abre uma issue com:
     - Node version: `node --version`
     - Erro específico (copia tudo em vermelho)
     - Passos para reproduzir
     - Sistema operativo

3. **Contacta o suporte**:
   - Slack: #jquality-support
   - Email: dev-support@company.com

---

**Bom debugging! 🔧**
