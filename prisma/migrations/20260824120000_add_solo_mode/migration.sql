-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SOLO';

-- CreateTable
CREATE TABLE "SoloProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "daysPerWeek" INTEGER NOT NULL,
    "equipment" TEXT NOT NULL,
    "notes" TEXT,
    "agreedToTermsAt" TIMESTAMP(3),
    "currentSeasonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoloProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SoloProfile_userId_key" ON "SoloProfile"("userId");

-- AddForeignKey
ALTER TABLE "SoloProfile" ADD CONSTRAINT "SoloProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
