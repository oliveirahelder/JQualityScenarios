CREATE TABLE "documentation_attachments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jiraId" TEXT NOT NULL,
  "ticketId" TEXT,
  "draftId" TEXT,
  "userId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "content" BLOB NOT NULL,
  "textContent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documentation_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "documentation_attachments_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "documentation_drafts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "documentation_attachments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "documentation_attachments_jiraId_idx" ON "documentation_attachments"("jiraId");
CREATE INDEX "documentation_attachments_ticketId_idx" ON "documentation_attachments"("ticketId");
CREATE INDEX "documentation_attachments_draftId_idx" ON "documentation_attachments"("draftId");
CREATE INDEX "documentation_attachments_userId_idx" ON "documentation_attachments"("userId");
