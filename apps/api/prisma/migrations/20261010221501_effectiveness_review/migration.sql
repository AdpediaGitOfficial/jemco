-- AlterTable
ALTER TABLE "ncrs" ADD COLUMN     "effectiveness_notes" TEXT,
ADD COLUMN     "effectiveness_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "effectiveness_reviewed_by_id" UUID;
