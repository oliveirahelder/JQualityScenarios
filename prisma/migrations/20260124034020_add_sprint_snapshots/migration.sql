-- CreateTable
CREATE TABLE "sprint_snapshots" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "jiraId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "totals" TEXT NOT NULL,
    "tickets" TEXT NOT NULL,
    "assignees" TEXT NOT NULL,
    "deliveryTimes" TEXT,
    "ticketTimes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprint_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sprint_snapshots_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "sprint_snapshots_sprintId_key" ON "sprint_snapshots"("sprintId");
