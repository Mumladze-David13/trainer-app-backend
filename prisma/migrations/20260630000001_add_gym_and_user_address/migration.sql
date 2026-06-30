-- CreateTable
CREATE TABLE "Gym" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gym_name_key" ON "Gym"("name");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "gymId" TEXT,
ADD COLUMN "address" JSONB;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SeedData: create default gym and assign all users
INSERT INTO "Gym" ("id", "name", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'Техника тела', NOW(), NOW());

UPDATE "User" SET "gymId" = (SELECT "id" FROM "Gym" WHERE "name" = 'Техника тела' LIMIT 1);