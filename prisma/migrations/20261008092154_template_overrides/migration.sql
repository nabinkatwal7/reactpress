-- CreateTable
CREATE TABLE "TemplateOverride" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateOverride_siteId_theme_template_key" ON "TemplateOverride"("siteId", "theme", "template");

-- AddForeignKey
ALTER TABLE "TemplateOverride" ADD CONSTRAINT "TemplateOverride_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
