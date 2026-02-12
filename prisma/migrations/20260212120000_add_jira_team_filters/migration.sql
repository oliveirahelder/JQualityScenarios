-- Add Jira team filter configuration fields
ALTER TABLE "admin_settings" ADD COLUMN "jiraApplicationField" TEXT;
ALTER TABLE "admin_settings" ADD COLUMN "jiraTeamFilters" TEXT;
