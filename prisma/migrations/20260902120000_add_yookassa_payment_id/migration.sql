-- AlterTable
ALTER TABLE "SubscriptionPayment" ADD COLUMN "yookassaPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_yookassaPaymentId_key" ON "SubscriptionPayment"("yookassaPaymentId");
