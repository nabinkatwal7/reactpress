import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MAX_STORE_KEYS, MAX_STORE_VALUE_BYTES } from "./sandbox";

export type PluginStore = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
};

const KEY = /^[A-Za-z0-9._:-]{1,100}$/;

function checkKey(key: string) {
  if (typeof key !== "string" || !KEY.test(key)) throw new Error("Invalid store key");
}

/** JSON key/value storage for one plugin on one site. Every query is pinned to (siteId, plugin). */
export function createPluginStore(siteId: string, plugin: string): PluginStore {
  const scope = { siteId, plugin };
  return {
    async get<T>(key: string) {
      checkKey(key);
      const row = await prisma.pluginData.findUnique({ where: { siteId_plugin_key: { ...scope, key } } });
      return (row?.value as T | undefined) ?? null;
    },
    async set(key, value) {
      checkKey(key);
      const json = JSON.stringify(value);
      if (json === undefined) throw new Error("Store values must be JSON");
      if (Buffer.byteLength(json) > MAX_STORE_VALUE_BYTES) throw new Error("Store value too large");
      const where = { siteId_plugin_key: { ...scope, key } };
      if (!(await prisma.pluginData.findUnique({ where, select: { id: true } }))) {
        if ((await prisma.pluginData.count({ where: scope })) >= MAX_STORE_KEYS) throw new Error("Plugin store is full");
      }
      const data = JSON.parse(json) as Prisma.InputJsonValue;
      await prisma.pluginData.upsert({ where, update: { value: data }, create: { ...scope, key, value: data } });
    },
    async delete(key) {
      checkKey(key);
      return (await prisma.pluginData.deleteMany({ where: { ...scope, key } })).count > 0;
    },
    async list(prefix = "") {
      const rows = await prisma.pluginData.findMany({
        where: { ...scope, key: { startsWith: prefix } },
        select: { key: true },
        orderBy: { key: "asc" },
        take: MAX_STORE_KEYS,
      });
      return rows.map((r) => r.key);
    },
  };
}

export async function removePluginData(siteId: string, plugin: string) {
  await prisma.pluginData.deleteMany({ where: { siteId, plugin } });
}
