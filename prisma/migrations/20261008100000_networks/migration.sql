-- CreateTable
CREATE TABLE "Network" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Network_slug_key" ON "Network"("slug");

-- Existing sites move into one default network (added nullable first so old rows can be backfilled).
INSERT INTO "Network" ("id", "name", "slug", "updatedAt")
SELECT 'network_default', 'ReactPress network', 'main', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Site");

-- AlterTable
ALTER TABLE "Site" ADD COLUMN "networkId" TEXT;
UPDATE "Site" SET "networkId" = 'network_default';
ALTER TABLE "Site" ALTER COLUMN "networkId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Site_domain_key" ON "Site"("domain");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
