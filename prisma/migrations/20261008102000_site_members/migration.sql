-- CreateTable
CREATE TABLE "SiteMember" (
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteMember_pkey" PRIMARY KEY ("siteId","userId")
);

-- CreateIndex
CREATE INDEX "SiteMember_userId_idx" ON "SiteMember"("userId");

-- AddForeignKey
ALTER TABLE "SiteMember" ADD CONSTRAINT "SiteMember_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMember" ADD CONSTRAINT "SiteMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMember" ADD CONSTRAINT "SiteMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A user's old global role becomes their role on the default site (the only site that existed).
INSERT INTO "SiteMember" ("siteId", "userId", "roleId")
SELECT s."id", u."id", u."roleId"
FROM "User" u CROSS JOIN "Site" s
WHERE s."isDefault" = true AND u."roleId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "roleId";
