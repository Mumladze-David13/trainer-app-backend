-- CreateEnum
CREATE TYPE "ActivityUnit" AS ENUM ('TIMES', 'KM');

-- AlterTable
ALTER TABLE "ClientActivity" ADD COLUMN "unit" "ActivityUnit" NOT NULL DEFAULT 'TIMES';

-- CreateTable
CREATE TABLE "ClientActivityLog" (
    "id" TEXT NOT NULL,
    "clientActivityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientActivityLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClientActivityLog" ADD CONSTRAINT "ClientActivityLog_clientActivityId_fkey"
    FOREIGN KEY ("clientActivityId") REFERENCES "ClientActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
