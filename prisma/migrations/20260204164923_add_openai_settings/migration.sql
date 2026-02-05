-- AlterTable
ALTER TABLE "users" ADD COLUMN "openaiApiKey" TEXT;
ALTER TABLE "users" ADD COLUMN "openaiConnectionCheckedAt" DATETIME;
ALTER TABLE "users" ADD COLUMN "openaiConnectionStatus" TEXT;
ALTER TABLE "users" ADD COLUMN "openaiModel" TEXT;

