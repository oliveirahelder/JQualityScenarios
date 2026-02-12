-- Add missing expectedResult column to test_case_scenarios
ALTER TABLE "test_case_scenarios" ADD COLUMN "expectedResult" TEXT;
