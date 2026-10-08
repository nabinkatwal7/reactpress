-- CreateTable
CREATE TABLE "ThemeMods" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "published" JSONB NOT NULL DEFAULT '{}',
    "draft" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeMods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThemeMods_siteId_theme_key" ON "ThemeMods"("siteId", "theme");

-- AddForeignKey
ALTER TABLE "ThemeMods" ADD CONSTRAINT "ThemeMods_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
