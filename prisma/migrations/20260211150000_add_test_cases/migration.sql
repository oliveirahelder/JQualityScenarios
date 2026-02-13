-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "teamKey" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "tags" TEXT,
    "prerequisites" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "test_cases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_case_scenarios" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "expectedResult" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_case_scenarios_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "test_case_scenarios_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_case_tickets" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "ticketId" TEXT,
    "jiraId" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_case_tickets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "test_case_tickets_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "test_case_tickets_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "test_cases_teamKey_idx" ON "test_cases"("teamKey");

-- CreateIndex
CREATE INDEX "test_cases_userId_idx" ON "test_cases"("userId");

-- CreateIndex
CREATE INDEX "test_case_scenarios_testCaseId_idx" ON "test_case_scenarios"("testCaseId");

-- CreateIndex
CREATE INDEX "test_case_tickets_testCaseId_idx" ON "test_case_tickets"("testCaseId");

-- CreateIndex
CREATE INDEX "test_case_tickets_ticketId_idx" ON "test_case_tickets"("ticketId");

-- CreateIndex
CREATE INDEX "test_case_tickets_jiraId_idx" ON "test_case_tickets"("jiraId");

-- Foreign keys added inline for SQLite compatibility
