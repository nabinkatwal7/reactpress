-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "taxonomy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTerm" (
    "postId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,

    CONSTRAINT "PostTerm_pkey" PRIMARY KEY ("postId","termId")
);

-- CreateIndex
CREATE INDEX "Term_siteId_taxonomy_idx" ON "Term"("siteId", "taxonomy");

-- CreateIndex
CREATE UNIQUE INDEX "Term_siteId_taxonomy_slug_key" ON "Term"("siteId", "taxonomy", "slug");

-- CreateIndex
CREATE INDEX "PostTerm_termId_idx" ON "PostTerm"("termId");

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTerm" ADD CONSTRAINT "PostTerm_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTerm" ADD CONSTRAINT "PostTerm_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
