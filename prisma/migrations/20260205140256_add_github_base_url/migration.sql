-- Add githubBaseUrl to admin_settings
ALTER TABLE "admin_settings" ADD COLUMN "githubBaseUrl" TEXT;
