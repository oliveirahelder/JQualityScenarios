# Dashboard Design Audit and Wireframes

Target: `app/dashboard/page.tsx`

## Design audit (current state)
- Visual hierarchy is flat: every card has the same weight, so the most important signals do not stand out.
- Cognitive load is high: 8 overview cards plus delivery cards, assignee table, and marketing block compete for attention.
- Filters are fragmented: each card has its own sprint selector, which forces repeated context switching.
- Management questions are not obvious: there is no single "release readiness" or "risk summary" module.
- QA clarity is mixed: some cards show process data but not coverage or doc status.
- Risk detail is dense: the risk signals card includes a table inside a card with small text, making scanning difficult.
- Marketing content is mixed into operational view: "Why JQuality?" dilutes day-to-day dashboard use.
- Interaction focus is scattered: quick actions are separate from the most relevant operational views.

## Design goals
- Make the most important signals visible in 3 seconds.
- Use a single global context filter (sprint, team, time range).
- Separate executive summary from operational detail.
- Provide clear scanning paths for QA, Product, and Management.
- Keep the dashboard clean, modern, and interactive without overload.

## Proposed layout (wireframes)

### Wireframe A: Executive + Operational split

Header
[Dashboard]  [Time range] [Team] [Sprint]                     [Last sync] [Sync button]

Row 1: Executive Summary (hero cards)
[Release readiness]  [Sprint progress]  [Risk level]  [Open bugs]

Row 2: Key Risks and Blockers
[Top risks list with filters]                        [Trend mini chart]

Row 3: Delivery and Quality
[Delivery commitment by sprint]                      [Coverage and QA status]

Row 4: Team and Workload
[Assignees workload table]                           [Cycle time / bounce-back]

Row 5: Actions and Insights
[Quick actions]                                      [Key insights / notes]


### Wireframe B: Role-focused tabs

Header
[Dashboard]  [Time range] [Team] [Sprint]                     [Last sync] [Sync button]

Tabs: [Management] [QA] [Product]

Management tab
[Release readiness] [Risk summary] [Schedule confidence]
[Top blockers]      [Delivery trend] [Quality trend]

QA tab
[Coverage status]   [Open bugs]     [Bounce-back]
[Risk signals]      [Scenario drafts] [Docs pending]

Product tab
[Sprint progress]   [Scope change]  [Acceptance completion]
[Release notes draft] [Top risks]   [Customer impact]

### Wireframe C: Hybrid (Executive summary + role slices)

Header
[Dashboard]  [Time range] [Team] [Sprint]                     [Last sync] [Sync button]

Row 1: Executive Summary (always visible)
[Release readiness]  [Sprint progress]  [Risk level]  [Open bugs]

Row 2: Role slices (quick tabs, small footprint)
Tabs: [Management] [QA] [Product]

Management slice
[Top blockers] [Delivery confidence] [Quality trend]

QA slice
[Coverage status] [Risk signals] [Docs pending]

Product slice
[Acceptance completion] [Scope change] [Release notes draft]

Row 3: Operational detail (shared)
[Risk list with filters]                              [Delivery commitment]
[Assignees workload table]                            [Bounce-back or cycle time]

Row 4: Actions and insights
[Quick actions]                                      [Key insights / notes]


## Interaction notes
- One global filter row controls all modules.
- Use short, scannable KPI cards in the top row.
- Move dense tables into expandable sections or dedicated drill-down links.
- Keep quick actions contextual near the sections they affect.
- Remove or relocate marketing content ("Why JQuality?") to onboarding or docs.

## Next steps
- Confirm the top 5 questions for each role to finalize the hero cards.
- Choose the layout: single view (A), role tabs (B), or hybrid (C).
- Translate the selected wireframe into component updates in `app/dashboard/page.tsx`.
