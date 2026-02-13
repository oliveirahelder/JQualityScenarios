-- CreateTable
CREATE TABLE "jira_ticket_sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "processedCount" INTEGER NOT NULL,
    "insertedCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "teamKeys" TEXT,
    "teamCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "error" TEXT
);

