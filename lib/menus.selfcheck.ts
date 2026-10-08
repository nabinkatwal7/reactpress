/** ponytail: run with `npx tsx lib/menus.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { createMenu, deleteMenu, getMenuForLocation, getMenuItemsFlat, saveMenuItems, setMenuLocation } from "./menus";
import { createPost, deletePost } from "./posts";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  const post = await createPost(site.id, admin.id, { title: "Menu Post", status: "publish" });
  const draft = await createPost(site.id, admin.id, { title: "Menu Draft", status: "draft" });
  const menu = await createMenu(site.id, "Selfcheck menu");

  await saveMenuItems(site.id, menu.id, [
    { label: "Home", objectType: "custom", url: "/", depth: 0 },
    { label: "Post", objectType: "post", objectId: post.id, depth: 1 },
    { label: "Draft", objectType: "post", objectId: draft.id, depth: 0 },
  ]);
  const flat = await getMenuItemsFlat(menu.id);
  console.assert(flat.map((i) => i.depth).join() === "0,1,0", "depth round-trips");

  let bad = false;
  try {
    await saveMenuItems(site.id, menu.id, [{ label: "x", objectType: "post", objectId: "nope", depth: 0 }]);
  } catch {
    bad = true;
  }
  console.assert(bad, "foreign target rejected");
  console.assert((await getMenuItemsFlat(menu.id)).length === 3, "failed save leaves items intact");

  await setMenuLocation(site.id, "primary", menu.id);
  const resolved = await getMenuForLocation(site.id, "primary");
  console.assert(resolved.length === 1 && resolved[0].children.length === 1, "tree resolved; draft target dropped");
  console.assert(resolved[0].children[0].href === `/posts/${post.slug}`, "post href");

  await setMenuLocation(site.id, "primary", null);
  console.assert((await getMenuForLocation(site.id, "primary")).length === 0, "unassigned");

  await deleteMenu(site.id, menu.id);
  for (const p of [post, draft]) {
    await deletePost(site.id, p.id);
    await prisma.revision.deleteMany({ where: { entityId: p.id } });
  }
  console.log("menus self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
