-- AlterTable
ALTER TABLE "user_levels" ADD COLUMN     "dailyLimits" JSONB NOT NULL DEFAULT '{}';
