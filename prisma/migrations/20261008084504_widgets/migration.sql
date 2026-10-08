-- CreateTable
CREATE TABLE "WidgetArea" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "WidgetArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Widget" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Widget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WidgetArea_siteId_key_key" ON "WidgetArea"("siteId", "key");

-- CreateIndex
CREATE INDEX "Widget_areaId_position_idx" ON "Widget"("areaId", "position");

-- AddForeignKey
ALTER TABLE "WidgetArea" ADD CONSTRAINT "WidgetArea_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Widget" ADD CONSTRAINT "Widget_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "WidgetArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
