import { z } from "zod";
import { prisma } from "@/lib/prisma";

/** Theme-facing widget areas. Themes/plugins will register more later. */
export const WIDGET_AREAS = [
  { key: "sidebar", name: "Sidebar" },
  { key: "footer", name: "Footer" },
] as const;

const title = z.string().trim().max(100).default("");

/** Widget type registry: each type validates its own settings. */
export const WIDGET_TYPES = {
  text: {
    label: "Text",
    schema: z.object({ title, body: z.string().trim().max(2000).default("") }),
  },
  recent_posts: {
    label: "Recent posts",
    schema: z.object({ title: title.default("Recent posts"), count: z.number().int().min(1).max(20).default(5) }),
  },
  categories: {
    label: "Categories",
    schema: z.object({ title: title.default("Categories") }),
  },
} as const;

export type WidgetType = keyof typeof WIDGET_TYPES;

export function isWidgetType(type: string): type is WidgetType {
  return type in WIDGET_TYPES;
}

export function isWidgetArea(key: string) {
  return WIDGET_AREAS.some((a) => a.key === key);
}

export const createWidgetSchema = z.object({
  area: z.string().min(1),
  type: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const updateWidgetSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
});

export const reorderSchema = z.object({ ids: z.array(z.string().min(1)).max(100) });

/** Validate + normalise settings for a widget type (fills defaults, strips unknown keys). */
export function parseSettings(type: string, settings: unknown) {
  if (!isWidgetType(type)) throw new Error("Unknown widget type");
  const parsed = WIDGET_TYPES[type].schema.safeParse(settings ?? {});
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid settings");
  return parsed.data as Record<string, unknown>;
}

/** Create DB rows for any registered area the site does not have yet. */
export async function ensureAreas(siteId: string) {
  await prisma.widgetArea.createMany({
    data: WIDGET_AREAS.map((a) => ({ siteId, key: a.key, name: a.name })),
    skipDuplicates: true,
  });
}

export async function listAreasWithWidgets(siteId: string) {
  await ensureAreas(siteId);
  return prisma.widgetArea.findMany({
    where: { siteId },
    orderBy: { key: "asc" },
    include: { widgets: { orderBy: { position: "asc" } } },
  });
}

async function findArea(siteId: string, key: string) {
  if (!isWidgetArea(key)) throw new Error("Unknown widget area");
  await ensureAreas(siteId);
  return prisma.widgetArea.findUniqueOrThrow({ where: { siteId_key: { siteId, key } } });
}

export async function addWidget(siteId: string, areaKey: string, type: string, settings?: unknown) {
  const area = await findArea(siteId, areaKey);
  const clean = parseSettings(type, settings);
  const last = await prisma.widget.findFirst({
    where: { areaId: area.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return prisma.widget.create({
    data: {
      areaId: area.id,
      type,
      settings: clean as object,
      position: (last?.position ?? -1) + 1,
    },
  });
}

async function ownedWidget(siteId: string, id: string) {
  return prisma.widget.findFirst({ where: { id, area: { siteId } } });
}

export async function updateWidget(siteId: string, id: string, settings: unknown) {
  const widget = await ownedWidget(siteId, id);
  if (!widget) return null;
  return prisma.widget.update({
    where: { id },
    data: { settings: parseSettings(widget.type, settings) as object },
  });
}

export async function removeWidget(siteId: string, id: string) {
  const widget = await ownedWidget(siteId, id);
  if (!widget) return false;
  await prisma.widget.delete({ where: { id } });
  return true;
}

/** Persist a new order for an area; ids must be exactly the area's widgets. */
export async function reorderWidgets(siteId: string, areaKey: string, ids: string[]) {
  const area = await findArea(siteId, areaKey);
  const existing = await prisma.widget.findMany({ where: { areaId: area.id }, select: { id: true } });
  const same =
    existing.length === ids.length &&
    new Set(ids).size === ids.length &&
    existing.every((w) => ids.includes(w.id));
  if (!same) throw new Error("Order must list every widget in the area exactly once");
  await prisma.$transaction(
    ids.map((id, position) => prisma.widget.update({ where: { id }, data: { position } })),
  );
}

/** Widgets for a public area, in order. Unknown types (e.g. from a removed plugin) are skipped. */
export async function getAreaWidgets(siteId: string, areaKey: string) {
  const area = await prisma.widgetArea.findUnique({
    where: { siteId_key: { siteId, key: areaKey } },
    include: { widgets: { orderBy: { position: "asc" } } },
  });
  return (area?.widgets ?? []).filter((w) => isWidgetType(w.type));
}
