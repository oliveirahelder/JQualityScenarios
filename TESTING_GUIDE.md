# 🧪 Testing Guide - Sprints View Enhancements

## Pre-Testing Checklist

- [ ] Database contains sprints with tickets
- [ ] At least one user has DevOps or Admin role
- [ ] DevInsights with detectedImpactAreas exist for some tickets
- [ ] TestScenarios exist for some tickets
- [ ] DocumentationDrafts exist in various statuses

---

## Test 1: Real-Time Sync Status Display

### Setup
1. Navigate to Sprints page
2. Find any sprint card

### Test Steps
1. **Verify last sync time displays**
   - Look for: "⚫ Last synced: [time] ago"
   - Expected: Format like "5m ago", "2h ago", or "Just now"
   - ✅ **PASS**: Time displays and updates on page load

2. **Test sync button visibility (Role-based)**
   - As QA User: Sync button should NOT appear
   - As DevOps/Admin: Sync button SHOULD appear
   - ✅ **PASS**: Only DevOps/Admin see [🔄 Sync] button

3. **Test manual sync (DevOps/Admin only)**
   - Click [🔄 Sync] button
   - Expected: Button shows loading spinner
   - Wait: Sync completes (30-60 seconds)
   - Check: Last synced time updates to "Just now"
   - ✅ **PASS**: Sync refreshes data and updates timestamp

### Expected Result
```
⚫ Last synced: 2m ago      [🔄 Sync]
⚫ Last synced: Just now    [🔄 Sync]  (after clicking)
```

---

## Test 2: DevInsight Code Impact Badges

### Setup
1. Expand a sprint that has tickets with DevInsights
2. Look at ticket table

### Test Steps
1. **Verify Impact column appears**
   - Column header: "Impact" (between SP and Scenarios)
   - ✅ **PASS**: Column visible with proper header

2. **Check impact area display**
   - Expected: Badge(s) showing impact areas (e.g., "Auth", "API")
   - Format: Up to 2 areas shown, "+N" if more
   - ✅ **PASS**: Areas display with proper formatting

3. **Verify color coding**
   - High Risk (Auth, API, DB): 🔴 Red background
   - Medium Risk (Config, Performance): 🟡 Yellow background
   - Standard (UI, Testing): 🔵 Blue background
   - ✅ **PASS**: Colors match risk level

4. **Test empty impact**
   - Ticket with no DevInsight: Shows "--"
   - ✅ **PASS**: No impact shows dash

### Expected Results
```
PROJ-1 | Auth API +2     | (red badges + count)
PROJ-2 | Config          | (yellow badge)
PROJ-3 | UI Testing      | (blue badges)
PROJ-4 | --              | (no impact data)
```

---

## Test 3: Test Scenario Coverage Indicator

### Setup
1. Expand a sprint
2. Look at "Scenarios" column in ticket table

### Test Steps
1. **Verify Scenarios column exists**
   - Column header: "Scenarios" (between Impact and Bounce)
   - Shows: ☑️ [number]
   - ✅ **PASS**: Column visible with icon

2. **Test scenario counts**
   - Ticket with 3 scenarios: Shows "☑️ 3"
   - Ticket with 0 scenarios: Shows "☑️ 0"
   - Ticket with 1 scenario: Shows "☑️ 1"
   - ✅ **PASS**: Counts display correctly

3. **Identify high-priority items**
   - Tickets with "☑️ 0" need scenario generation
   - These are QA priorities
   - ✅ **PASS**: Can identify gaps at a glance

### Expected Results
```
PROJ-1 | ☑️ 3  (covered)
PROJ-2 | ☑️ 0  (needs QA action)
PROJ-3 | ☑️ 2  (good)
```

---

## Test 4: Documentation Publishing Pipeline

### Setup
1. Look at sprint card header (not expanded)
2. Find sprints with DocumentationDrafts

### Test Steps
1. **Verify pipeline status appears**
   - If no docs: Section doesn't show
   - If docs exist: Shows "📄 Documentation Status:"
   - ✅ **PASS**: Only shows when relevant

2. **Check status counts**
   - Draft documents: 📝 count
   - Under review: 🔍 count
   - Approved: ✅ count
   - Published: 📄 count
   - ✅ **PASS**: All counts display correctly

3. **Identify bottlenecks**
   - High drafts, low reviews = QA bottleneck
   - High reviews, low approved = decision needed
   - Low published = not going live
   - ✅ **PASS**: Pipeline visible for planning

4. **Test zero docs**
   - Sprint with no docs: No pipeline section shown
   - ✅ **PASS**: Clean UI when no docs

### Expected Results
```
📄 Docs: 📝 5 | 🔍 2 | ✅ 1 | 📄 0   (lots in draft, none published)
📄 Docs: 📝 0 | 🔍 0 | ✅ 3 | 📄 5   (all published)
(no section)                          (no docs at all)
```

---

## Test 5: Ticket Table Integration

### Setup
1. Expand a sprint
2. View full ticket table

### Test Steps
1. **Verify all columns present**
   - Ticket | Summary | Status | SP | Impact | Scenarios | Bounce
   - ✅ **PASS**: All 7 columns visible

2. **Test row hover effect**
   - Hover over any ticket row
   - Expected: Subtle background highlight
   - ✅ **PASS**: Hover state shows

3. **Test filtering still works**
   - Filter by "In Dev only" / "Closed only"
   - Expected: Table updates correctly
   - ✅ **PASS**: Filters work with new columns

4. **Test sorting still works**
   - Sort by "Story Points" / "Bounce Back"
   - Expected: Table reorders correctly
   - ✅ **PASS**: Sorting works with new data

5. **Test ticket links still work**
   - Click ticket ID (e.g., PROJ-1)
   - Expected: Opens in Jira
   - ✅ **PASS**: Link navigates correctly

### Expected Results
```
All columns visible ✓
Row hover highlights ✓
Filters work ✓
Sorting works ✓
Links open Jira ✓
```

---

## Test 6: Role-Based Access

### Setup
1. Have 2+ users with different roles

### Test Steps
1. **QA User Login**
   - Go to Sprints page
   - Check: Sync button NOT visible
   - Check: Can see all data (Impact, Scenarios, Docs)
   - ✅ **PASS**: QA has read access, no sync button

2. **DevOps User Login**
   - Go to Sprints page
   - Check: Sync button IS visible
   - Click: Sync button works
   - ✅ **PASS**: DevOps can sync

3. **Admin User Login**
   - Go to Sprints page
   - Check: Sync button IS visible
   - Click: Sync button works
   - ✅ **PASS**: Admin can sync

4. **Developer User Login**
   - Go to Sprints page
   - Check: Can see all data
   - Check: No sync button
   - ✅ **PASS**: Developers see read-only view

---

## Performance Testing

### Setup
1. Have a sprint with 50+ tickets
2. Open DevTools (F12 → Network tab)

### Test Steps
1. **Load time**
   - Load Sprints page
   - Check: Page loads in <3 seconds
   - Network: Single /api/sprints call
   - ✅ **PASS**: No N+1 queries or slowness

2. **Memory usage**
   - Expand multiple sprints
   - Check: No memory spikes
   - Check: Scrolling remains smooth
   - ✅ **PASS**: Efficient rendering

3. **Sync performance**
   - Click sync button
   - Check: Takes <60 seconds
   - Check: Page responds during sync
   - ✅ **PASS**: Background process doesn't block UI

---

## Error Handling Tests

### Test 1: No Jira Credentials
- **Setup**: User without Jira configured
- **Action**: Click sync button
- **Expected**: Error message shown
- **Result**: ✅ User sees helpful error

### Test 2: Jira API Down
- **Setup**: Jira temporarily unavailable
- **Action**: Click sync button
- **Expected**: Error handled gracefully
- **Result**: ✅ Doesn't crash, shows error

### Test 3: Missing DevInsight Data
- **Setup**: Ticket with no DevInsight
- **Expected**: Impact column shows "--"
- **Result**: ✅ Graceful fallback

### Test 4: Missing TestScenarios
- **Setup**: Ticket with no scenarios
- **Expected**: Scenarios column shows "☑️ 0"
- **Result**: ✅ Shows zero, not error

---

## Regression Testing

Ensure these still work:
- [ ] Ticket status filtering
- [ ] Ticket sorting
- [ ] Assignee filtering
- [ ] Sprint status filtering (all/active/completed)
- [ ] Sprint name selection
- [ ] Links to Jira
- [ ] Collapse/expand functionality
- [ ] Story points calculations
- [ ] Success % calculations
- [ ] QA done counts

---

## Acceptance Criteria

| Feature | Requirement | Status |
|---------|-------------|--------|
| Sync Status | Shows last sync time | [ ] ✅ |
| Sync Button | DevOps/Admin only can sync | [ ] ✅ |
| Impact Badges | Color-coded by risk | [ ] ✅ |
| Scenario Count | Shows per ticket | [ ] ✅ |
| Doc Pipeline | Shows all statuses | [ ] ✅ |
| No Errors | Build passes, no console errors | [ ] ✅ |
| Performance | Loads in <3s, responsive | [ ] ✅ |
| Role-Based | Access matches roles | [ ] ✅ |
| Regression | All old features still work | [ ] ✅ |

---

## Sign-Off

When all tests pass:

- [ ] QA Approval
- [ ] Product Approval
- [ ] DevOps Approval

**Ready to Deploy**: _______________
