-- Add MACHINE to WeightType enum
ALTER TYPE "WeightType" ADD VALUE 'MACHINE';

-- Create ClientActivity table
CREATE TABLE "ClientActivity" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metValue" DOUBLE PRECISION,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientActivity_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint
CREATE UNIQUE INDEX "ClientActivity_name_clientId_key" ON "ClientActivity"("name", "clientId");

-- Add FK to User
ALTER TABLE "ClientActivity" ADD CONSTRAINT "ClientActivity_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add clientActivityId to ClientSessionExercise
ALTER TABLE "ClientSessionExercise" ADD COLUMN "clientActivityId" TEXT;

-- Add FK
ALTER TABLE "ClientSessionExercise" ADD CONSTRAINT "ClientSessionExercise_clientActivityId_fkey"
    FOREIGN KEY ("clientActivityId") REFERENCES "ClientActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
