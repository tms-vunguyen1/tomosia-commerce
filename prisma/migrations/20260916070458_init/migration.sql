-- CreateTable
CREATE TABLE "MerchantUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantUser_email_key" ON "MerchantUser"("email");

-- CreateIndex
CREATE INDEX "MerchantSession_userId_idx" ON "MerchantSession"("userId");

-- AddForeignKey
ALTER TABLE "MerchantSession" ADD CONSTRAINT "MerchantSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MerchantUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
