-- CreateEnum
CREATE TYPE "RevisionKind" AS ENUM ('revision', 'autosave');

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "RevisionKind" NOT NULL DEFAULT 'revision',
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Revision_siteId_entityType_entityId_createdAt_idx" ON "Revision"("siteId", "entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
