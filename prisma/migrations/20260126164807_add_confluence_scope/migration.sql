-- Ensure admin_settings exists before altering (for shadow DB)
CREATE TABLE IF NOT EXISTS "admin_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jiraBaseUrl" TEXT,
    "confluenceBaseUrl" TEXT,
    "sprintsToSync" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- AlterTable
ALTER TABLE "admin_settings" ADD COLUMN "confluenceSpaceKey" TEXT;
ALTER TABLE "admin_settings" ADD COLUMN "confluenceParentPageId" TEXT;
