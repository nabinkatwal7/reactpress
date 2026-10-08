-- AlterTable
ALTER TABLE "Network" ADD COLUMN     "registries" TEXT[] DEFAULT ARRAY[]::TEXT[];

