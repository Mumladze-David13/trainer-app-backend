-- RenameTable
ALTER TABLE "Exercise" RENAME TO "TrainerExercise";

-- RenameConstraint (primary key)
ALTER TABLE "TrainerExercise" RENAME CONSTRAINT "Exercise_pkey" TO "TrainerExercise_pkey";

-- RenameIndex (unique name+trainerId)
ALTER INDEX "Exercise_name_trainerId_key" RENAME TO "TrainerExercise_name_trainerId_key";

-- RenameConstraint (trainer FK)
ALTER TABLE "TrainerExercise" RENAME CONSTRAINT "Exercise_trainerId_fkey" TO "TrainerExercise_trainerId_fkey";

-- CreateTable
CREATE TABLE "GlobalExercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "equipment" TEXT,
    "level" TEXT,
    "primaryMuscles" TEXT[],
    "secondaryMuscles" TEXT[],
    "imageUrl" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalExercise_name_key" ON "GlobalExercise"("name");

-- AlterTable
ALTER TABLE "TrainerExercise" ADD COLUMN "globalExerciseId" TEXT;

-- AddForeignKey
ALTER TABLE "TrainerExercise" ADD CONSTRAINT "TrainerExercise_globalExerciseId_fkey" FOREIGN KEY ("globalExerciseId") REFERENCES "GlobalExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
