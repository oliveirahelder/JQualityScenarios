# 🎬 Quick Start - New Sprints View Features

## What's New? ✨

You now have **5 powerful new features** on the Sprints View page to improve visibility and collaboration.

---

## 1️⃣ Last Sync Timestamp ⏱️

**Where**: Sprint header (under sprint name)  
**Shows**: When sprint data was last updated from Jira

```
⚫ Last synced: 5m ago
```

**Why**: Know if your data is fresh or stale

---

## 2️⃣ Manual Sync Button 🔄

**Where**: Sprint header (next to last sync time)  
**Who Can Use**: DevOps & Admin only
**Action**: Click to refresh sprint from Jira

```
[🔄 Sync]  ← Only DevOps/Admin see this
```

**Why**: Update data on-demand without waiting for automatic sync

---

## 3️⃣ Code Impact Areas 🔴🟡🔵

**Where**: Ticket table → "Impact" column  
**Shows**: Which areas of code were changed

```
PROJ-1  →  🔴 Auth 🔴 API +2
PROJ-2  →  🟡 Config  
PROJ-3  →  🔵 Testing
```

**Colors**:
- 🔴 Red = High Risk (Auth, DB, API)
- 🟡 Yellow = Medium Risk (Config, Performance)
- 🔵 Blue = Standard (UI, Testing, Docs)

**Why**: QA knows immediately what code changed and risk level

---

## 4️⃣ Test Scenario Count 🧪

**Where**: Ticket table → "Scenarios" column  
**Shows**: Number of BDD test scenarios created

```
PROJ-1  →  ☑️ 3  (complete)
PROJ-2  →  ☑️ 0  (NEEDS QA ACTION)
PROJ-3  →  ☑️ 2  (good)
```

**Why**: QA sees at a glance which tickets need test coverage

---

## 5️⃣ Documentation Pipeline 📄

**Where**: Sprint header (under sync status)  
**Shows**: Publishing status of all documentation

```
📄 Docs: 📝 2 | 🔍 1 | ✅ 3 | 📄 5

📝 Draft      = AI-generated, waiting for review
🔍 Review     = QA reviewing
✅ Approved   = Ready to publish  
📄 Published  = Live on Confluence
```

**Why**: Product/QA see bottlenecks in documentation publishing

---

## How to Use by Role

### 👨‍🔬 QA Engineer
1. Look at "Scenarios" column
2. Find tickets with "☑️ 0" (needs scenarios)
3. These are your highest priority
4. Check "Impact" to understand what was changed
5. Monitor "Docs: 🔍 1" to know review queue size

### 👩‍💼 Product Manager
1. Check "📄 Docs:" status at sprint header
2. If high draft count = publishing bottleneck
3. Monitor overall sprint success %
4. Watch days remaining

### 🛠️ DevOps / Admin
1. See "Last synced: 5m ago"
2. If data looks stale, click [🔄 Sync]
3. Wait for refresh (shows "Just now")
4. Data updates automatically on page reload

### 👨‍💻 Developer
1. Find your tickets in the table
2. Check "Impact" column - see what you changed
3. Check "Scenarios" - are tests being written for your code?
4. Monitor "Bounce" column - any QA issues?

---

## Example Sprint Card

```
╔════════════════════════════════════════════════════════╗
║ 🎯 Q1 Sprint 1                           [ACTIVE] ↕   ║
║ ⚫ Last synced: 5m ago      [🔄 Sync]               ║
║ 📄 Docs: 📝 2 | 🔍 1 | ✅ 3 | 📄 5                ║
║                                                     ║
║ Ticket | Summary | Status | SP | Impact | Scn | Bnc ║
║--------|---------|--------|----|-----------|----|---- ║
║ PROJ-1 | Login   | Done   | 5  | Auth +1 | 3  | 0  ║
║ PROJ-2 | Forgot  | Dev    | 3  | Auth    | 0  | 0  ║  ← NEEDS QA WORK
║ PROJ-3 | Reset   | Done   | 5  | Auth    | 2  | 1  ║
╚════════════════════════════════════════════════════════╝
```

---

## Troubleshooting

### I don't see the sync button
- **Reason**: You're not DevOps/Admin
- **Solution**: Ask a DevOps person to sync

### Impact column shows "--"
- **Reason**: No code changes detected for this ticket
- **Solution**: Ticket may not have a linked PR

### Scenarios show "0"
- **Reason**: No test scenarios generated yet
- **Solution**: QA needs to generate them via `/scenarios/generate`

### Documentation section doesn't show
- **Reason**: No draft documentation for this sprint
- **Solution**: Generate docs first via AI, then review

---

## FAQ

**Q: Why is last sync 2 hours old?**  
A: Automatic syncs happen every 5 minutes. If stale, DevOps can click [🔄 Sync].

**Q: What does "Auth" impact mean?**  
A: Someone changed authentication code (login, permissions, etc.)

**Q: Why is my ticket's scenario count 0?**  
A: Tests haven't been generated yet. Ask QA to run scenario generation.

**Q: Can I click on impact areas to see code?**  
A: Not yet - future feature. They link to the PR in the database.

**Q: What's the difference between 🔍 and ✅ docs?**  
A: 🔍 = QA reviewing | ✅ = QA approved, ready to publish

---

## Next Steps

1. ✅ Use impact areas to understand code changes
2. ✅ Identify "0 scenario" tickets for QA focus
3. ✅ Monitor documentation pipeline
4. ✅ DevOps: Use sync button to refresh data
5. ✅ Report issues if anything looks wrong

---

**Questions?** Check FEATURES_OVERVIEW.md for detailed explanation or TESTING_GUIDE.md for technical details.

**Last Updated**: 2026-01-24
