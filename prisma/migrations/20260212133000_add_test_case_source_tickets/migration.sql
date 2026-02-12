-- CreateTable
CREATE TABLE "test_case_source_tickets" (
    "id" TEXT NOT NULL,
    "teamKey" TEXT NOT NULL,
    "jiraId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "comments" TEXT,
    "status" TEXT,
    "components" TEXT,
    "application" TEXT,
    "scenarioCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_case_source_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_case_source_tickets_teamKey_idx" ON "test_case_source_tickets"("teamKey");

-- CreateIndex
CREATE UNIQUE INDEX "test_case_source_tickets_jiraId_key" ON "test_case_source_tickets"("jiraId");
