-- AlterTable
ALTER TABLE "Network" ADD COLUMN     "enabledThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "networkPlugins" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Today's administrators keep full control: they become super admins.
UPDATE "User" SET "isSuperAdmin" = true
WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "key" = 'administrator');
