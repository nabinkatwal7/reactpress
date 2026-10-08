-- CreateTable
CREATE TABLE "PluginData" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "plugin" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PluginData_siteId_plugin_key_key" ON "PluginData"("siteId", "plugin", "key");

-- AddForeignKey
ALTER TABLE "PluginData" ADD CONSTRAINT "PluginData_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
