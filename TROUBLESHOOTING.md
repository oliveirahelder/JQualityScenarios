# Troubleshooting Guide

Quick solutions for common problems.

---

## Database Connection

### "ECONNREFUSED - Connection refused (localhost:5432)"

**Problem**: PostgreSQL not running.

**Solution**:
```bash
# Windows
net start postgresql-x64-14

# OR Docker
docker start qabot-db
docker logs qabot-db
```

### "Database does not exist"

**Problem**: Database tables not created.

**Solution**:
```bash
npx prisma migrate dev --name init
```

### "P1017: Server has closed the connection"

**Problem**: Connection string is incorrect or PostgreSQL crashed.

**Solution**: Check `.env.local`
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/qabot_dev"
```
Verify: user, password, host, port, database name.

---

## API Keys & Authentication

### "JIRA_API_TOKEN is invalid" (401 Unauthorized)

**Problem**: Jira token expired or incorrect.

**Solution**:
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Delete old token
3. Create new token
4. Update `.env.local` → `JIRA_API_TOKEN`

### "OPENAI_API_KEY is missing or invalid"

**Problem**: OpenAI key not set or expired.

**Solution**:
1. Go to https://platform.openai.com/api-keys
2. Create new key
3. Update `.env.local` → `OPENAI_API_KEY`
4. Verify you have credit balance

### "GEMINI_API_KEY is not valid"

**Problem**: Google Gemini key invalid.

**Solution**:
1. Go to https://makersuite.google.com/app/apikey
2. Create new API key
3. Update `.env.local` → `GEMINI_API_KEY`

---

## Port Issues

### "Port 3000 already in use"

**Solution - Option 1**: Use different port
```bash
npm run dev -- -p 3001
```

**Solution - Option 2**: Kill process using port 3000
```bash
# Find process ID
netstat -ano | findstr :3000

# Kill it
taskkill /PID {PID} /F
```

---

## Build & Dependency Issues

### "Cannot find module 'next'" or other module errors

**Solution**:
```bash
rm -r node_modules .next
npm install
npm run prisma:generate
npm run dev
```

### "TypeScript compilation errors"

**Solution**:
```bash
npm run build  # See detailed errors
npm run lint -- --fix
npm run dev
```

### "Tailwind CSS styles not appearing"

**Solution**:
```bash
npm install -D tailwindcss postcss autoprefixer
npm run dev
```

---

## Integration Issues

### "Jira board/sprint not found"

**Check**:
- URL format: `https://yourdomain.atlassian.net` (no trailing slash)
- Can you access it in browser?
- Token is valid?

**Test manually**:
```bash
curl -u "email@company.com:TOKEN" \
  "https://yourdomain.atlassian.net/rest/api/3/board"
```

### "GitHub webhook not triggered"

**Check**:
1. GitHub Settings → Webhooks
2. Webhook URL is: `https://your-domain/api/webhooks/github`
3. Click "Redeliver" to test
4. Check logs in `GET /api/webhooks/github`

### "Confluence page not found"

**Check**:
- `CONFLUENCE_SPACE` in `.env.local`
- Space format: `~email.company.com` (no domain suffix)

---

## Data & Sync Issues

### "Sprints not appearing after sync"

**Cause**: No sprints in Jira or incorrect config.

**Debug**:
1. Confirm you have sprints in Jira
2. Check `JIRA_BASE_URL` is correct
3. Check logs: `npm run dev` output
4. Test manually:
```bash
curl -u "email:TOKEN" \
  "https://domain.atlassian.net/rest/api/3/board"
```

### "Test scenarios fail to generate (timeout)"

**Cause**: OpenAI API slow or down.

**Solution**:
1. Check status: https://status.openai.com/
2. Try again (timeout may be temporary)
3. If persistent, increase timeout in code

### "Search returns zero results"

**Solution**: Run full sync
```bash
POST /api/admin/sprints/sync
```
Wait a few seconds, try again.

---

## Debugging

### View detailed logs
```bash
DEBUG=prisma:* npm run dev
NODE_DEBUG=* npm run dev
```

### Test specific API endpoint
```bash
# POST request with authentication
curl -X POST http://localhost:3000/api/scenarios/generate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"ticketId":"JX-123"}'
```

### Open database viewer
```bash
npx prisma studio
# Then go to http://localhost:5555
```

---

## Quick Checklist

When something breaks:

- [ ] Check red errors in terminal
- [ ] Reload browser (Ctrl+Shift+R)
- [ ] Restart server (Ctrl+C, then `npm run dev`)
- [ ] Verify `.env.local` has all variables
- [ ] Verify database is running
- [ ] Verify external APIs are online
- [ ] Clear cache: `rm -r node_modules .next && npm install`
- [ ] Check logs in terminal output

---

## Full Reset (Last Resort)

```bash
# Reset database
npx prisma migrate reset

# Clear node modules
rm -r node_modules && npm install

# Clear Next.js cache
rm -r .next

# Restart
npm run dev
```

---

**Still stuck?** Open an issue with:
- Node version: `node --version`
- Error message (copy all red text)
- Steps to reproduce
- Your OS
