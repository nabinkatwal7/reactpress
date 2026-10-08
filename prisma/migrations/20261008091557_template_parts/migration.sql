-- CreateTable
CREATE TABLE "TemplatePart" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplatePart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplatePart_siteId_theme_slug_key" ON "TemplatePart"("siteId", "theme", "slug");

-- AddForeignKey
ALTER TABLE "TemplatePart" ADD CONSTRAINT "TemplatePart_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
