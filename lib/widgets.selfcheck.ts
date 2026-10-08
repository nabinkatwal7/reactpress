/** ponytail: run with `npx tsx lib/widgets.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { addWidget, getAreaWidgets, removeWidget, reorderWidgets, updateWidget } from "./widgets";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });

  const a = await addWidget(site.id, "sidebar", "text", { title: "Hi", body: "there" });
  const b = await addWidget(site.id, "sidebar", "recent_posts", { count: 3 });
  console.assert(b.position === a.position + 1, "appended in order");

  let bad = 0;
  for (const fn of [
    () => addWidget(site.id, "nope", "text"),
    () => addWidget(site.id, "sidebar", "nope"),
    () => addWidget(site.id, "sidebar", "recent_posts", { count: 999 }),
  ]) {
    try { await fn(); } catch { bad++; }
  }
  console.assert(bad === 3, "bad area/type/settings rejected");

  await reorderWidgets(site.id, "sidebar", [b.id, a.id]);
  const ids = (await getAreaWidgets(site.id, "sidebar")).map((w) => w.id);
  console.assert(ids.join() === [b.id, a.id].join(), "reordered");

  const upd = await updateWidget(site.id, a.id, { title: "New", body: "x" });
  console.assert((upd?.settings as { title: string }).title === "New", "settings updated");

  await removeWidget(site.id, a.id);
  await removeWidget(site.id, b.id);
  console.assert((await getAreaWidgets(site.id, "sidebar")).length === 0, "removed");
  console.log("widgets self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
