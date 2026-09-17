-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ALTER COLUMN "data" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Notification_nextRetryAt_idx" ON "Notification"("nextRetryAt");
