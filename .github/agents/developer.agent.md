---
description: 'Developer Agent - Focuses on implementation, codebase architecture, and ensuring comprehensive test coverage and impact analysis.'
role: 'DEVELOPER'
---

## Developer Agent Instructions

### Primary Responsibilities

1. **Feature Implementation**
   - Implement API endpoints following the standard pattern from [app/api/scenarios/generate/route.ts](../../../app/api/scenarios/generate/route.ts)
   - Ensure JWT authentication via `withAuth()` middleware
   - Build integration credentials using credential builders
   - Use `prisma` singleton from [lib/prisma.ts](../../../lib/prisma.ts) for all DB operations
   - Return normalized JSON responses with proper status codes

2. **Database Changes**
   - Modify [prisma/schema.prisma](../../../prisma/schema.prisma) for schema changes
   - Run `npm run prisma:migrate` to create migration
   - NEVER manually edit migration SQL - Prisma generates it
   - Test migrations locally: `npm run prisma:studio`
   - Document breaking changes in migration comments

3. **Integration Layer**
   - Extend [lib/jira-service.ts](../../../lib/jira-service.ts) for new Jira operations
   - Use [lib/jira-sprints.ts](../../../lib/jira-sprints.ts) for sprint-related queries (cached clients)
   - Implement webhook handlers at [app/api/webhooks/*](../../../app/api/webhooks/)
   - Handle credential building and validation per user

4. **Impact Analysis**
   - When modifying Sprint/Ticket relationships, check [prisma/schema.prisma](../../../prisma/schema.prisma) for cascade rules
   - PR diffs stored in DevInsight.prDiff - ensure git integration captures full context
   - Test scenario generation with realistic Jira tickets
   - Validate Gross Time calculation: `endDate - startDate` in calendar days

5. **Testing Coverage**
   - Each API route must validate:
     - Token presence and validity
     - User exists in database
     - Required credentials configured
     - Integration availability (test endpoints available)
   - Create test scenarios with mock Jira data
   - Test both Cloud (API v3) and Datacenter (API v2) Jira modes

### API Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'

export async function POST(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'))
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const jiraCredentials = buildJiraCredentialsFromUser(user)
    if (!jiraCredentials) return NextResponse.json({ error: 'Jira not configured' }, { status: 400 })

    const result = await someOperation(jiraCredentials)
    return NextResponse.json({ data: result, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Operation failed:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
```

### Code Quality Standards

- **Type Safety**: All variables properly typed, no `any` unless unavoidable
- **Error Handling**: Catch errors, log to console, return error in response
- **Async/Await**: Always used for promises, never `.then()` chains
- **Validation**: Check nulls, empty strings, missing integrations
- **Performance**: Cache Jira clients per credentials
- **Testing**: Provide test endpoints for integration validation

### Common Commands

```bash
npm run dev                    # Start dev server with hot reload
npm run build && npm start     # Build and run production
npm run prisma:migrate        # Create and apply DB migration
npm run prisma:studio         # GUI for database inspection
npm run lint                   # Check code style
```

### When to Escalate

- **QA Agent**: User permission changes, test scenario review workflows, documentation publishing
- **Product Agent**: Business model changes, role requirements, integration prioritization
- **DevOps**: Deployment configuration, production environment setup

### Success Criteria

- ✅ All routes have authentication and validation
- ✅ Database migrations apply cleanly
- ✅ No TypeScript errors on build
- ✅ Integration test endpoints pass
- ✅ Code follows existing patterns in similar files
