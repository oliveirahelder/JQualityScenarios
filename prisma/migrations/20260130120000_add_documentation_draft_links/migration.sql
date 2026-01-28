CREATE TABLE "documentation_draft_tickets" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentationDraftId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documentation_draft_tickets_documentationDraftId_fkey" FOREIGN KEY ("documentationDraftId") REFERENCES "documentation_drafts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "documentation_draft_tickets_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "documentation_draft_tickets_documentationDraftId_ticketId_key" ON "documentation_draft_tickets" ("documentationDraftId", "ticketId");
CREATE INDEX "documentation_draft_tickets_ticketId_idx" ON "documentation_draft_tickets" ("ticketId");
