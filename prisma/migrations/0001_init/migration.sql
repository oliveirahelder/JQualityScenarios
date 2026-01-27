-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'QA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprints" (
    "id" TEXT NOT NULL,
    "jiraId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "jiraId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "assignee" TEXT,
    "priority" TEXT,
    "grossTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev_insights" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "prUrl" TEXT,
    "prTitle" TEXT,
    "prNotes" TEXT,
    "prDiff" TEXT,
    "aiAnalysis" TEXT,
    "detectedImpactAreas" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dev_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_scenarios" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "given" TEXT,
    "when" TEXT,
    "then" TEXT,
    "testEnvironment" TEXT,
    "executionStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentation_drafts" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "requirements" TEXT,
    "technicalNotes" TEXT,
    "testResults" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "confluencePageId" TEXT,
    "confluenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT,
    "buildNumber" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'STAGING',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "gitCommitSha" TEXT,
    "cicdJobUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_search_cache" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "jiraResults" TEXT,
    "confluenceResults" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historical_search_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sprints_jiraId_key" ON "sprints"("jiraId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_jiraId_key" ON "tickets"("jiraId");

-- CreateIndex
CREATE INDEX "tickets_sprintId_idx" ON "tickets"("sprintId");

-- CreateIndex
CREATE INDEX "dev_insights_ticketId_idx" ON "dev_insights"("ticketId");

-- CreateIndex
CREATE INDEX "test_scenarios_ticketId_idx" ON "test_scenarios"("ticketId");

-- CreateIndex
CREATE INDEX "test_scenarios_userId_idx" ON "test_scenarios"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_drafts_ticketId_key" ON "documentation_drafts"("ticketId");

-- CreateIndex
CREATE INDEX "documentation_drafts_sprintId_idx" ON "documentation_drafts"("sprintId");

-- CreateIndex
CREATE INDEX "documentation_drafts_userId_idx" ON "documentation_drafts"("userId");

-- CreateIndex
CREATE INDEX "deployments_sprintId_idx" ON "deployments"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "historical_search_cache_query_key" ON "historical_search_cache"("query");

