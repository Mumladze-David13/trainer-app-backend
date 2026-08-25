-- CreateTable
CREATE TABLE "SubscriptionTariff" (
    "role" TEXT NOT NULL,
    "priceRub" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionTariff_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "fullPriceRub" INTEGER NOT NULL,
    "chargedRub" INTEGER NOT NULL,
    "isFirstMonth" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionPayment_userId_status_idx" ON "SubscriptionPayment"("userId", "status");

-- Seed default tariffs so GET /api/subscription/price never 404s.
INSERT INTO "SubscriptionTariff" ("role", "priceRub", "updatedAt") VALUES
    ('SOLO', 250, CURRENT_TIMESTAMP),
    ('CLIENT', 200, CURRENT_TIMESTAMP),
    ('TRAINER', 2000, CURRENT_TIMESTAMP),
    ('TRAINER_CLIENT', 2000, CURRENT_TIMESTAMP)
ON CONFLICT ("role") DO NOTHING;
