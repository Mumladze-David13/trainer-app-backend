-- CreateEnum
CREATE TYPE "PoseView" AS ENUM ('side', 'front');

-- CreateTable
CREATE TABLE "PoseCalibrationFrame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exercise" TEXT NOT NULL,
    "view" "PoseView" NOT NULL,
    "phase" TEXT,
    "formScore" DOUBLE PRECISION,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "angles" JSONB NOT NULL,
    "calibrationMetrics" JSONB NOT NULL,

    CONSTRAINT "PoseCalibrationFrame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoseDatasetCase" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exercise" TEXT NOT NULL,
    "viewMode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "comment" TEXT,
    "frames" JSONB NOT NULL,

    CONSTRAINT "PoseDatasetCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PoseCalibrationFrame_exercise_view_idx" ON "PoseCalibrationFrame"("exercise", "view");

-- CreateIndex
CREATE UNIQUE INDEX "PoseDatasetCase_caseId_key" ON "PoseDatasetCase"("caseId");
