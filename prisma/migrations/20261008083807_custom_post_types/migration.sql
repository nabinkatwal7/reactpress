-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'post';

-- CreateTable
CREATE TABLE "PostType" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "singular" TEXT NOT NULL,
    "taxonomies" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Taxonomy" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "singular" TEXT NOT NULL,
    "hierarchical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Taxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostType_siteId_key_key" ON "PostType"("siteId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Taxonomy_siteId_key_key" ON "Taxonomy"("siteId", "key");

-- CreateIndex
CREATE INDEX "Post_siteId_type_idx" ON "Post"("siteId", "type");

-- AddForeignKey
ALTER TABLE "PostType" ADD CONSTRAINT "PostType_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Taxonomy" ADD CONSTRAINT "Taxonomy_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
