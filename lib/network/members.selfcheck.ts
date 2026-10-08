/** ponytail: run with `npx tsx lib/network/members.selfcheck.ts` (needs the dev database) */
import { PrismaClient } from "@prisma/client";
import { Cap, can } from "@/lib/caps";
import { addMemberByEmail, createNetworkUser, listMembers, removeMember, setMemberRole } from "./members";
import { createSite, deleteSite, getDefaultNetwork } from "./sites";

const prisma = new PrismaClient();
const fails = (fn: () => Promise<unknown>) => fn().then(() => false, () => true);
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};

async function main() {
  const net = await getDefaultNetwork();
  const main = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });
  const sub = await prisma.user.findUniqueOrThrow({ where: { email: "subscriber@reactpress.local" } });
  await prisma.site.deleteMany({ where: { slug: { startsWith: "sc-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "sc-" } } });

  const second = await createSite(net.id, { name: "Second", slug: "sc-second" }, admin.id);
  const alice = await createNetworkUser({ email: "SC-alice@example.com", name: "Alice", password: "password123" });
  check(alice.email === "sc-alice@example.com", "email is normalised");
  check(await fails(() => createNetworkUser({ email: "sc-alice@example.com", password: "password123" })), "duplicate email rejected");
  check(await fails(() => createNetworkUser({ email: "sc-bob@example.com", password: "short" })), "short password rejected");
  check(await fails(() => createNetworkUser({ email: "nope", password: "password123" })), "bad email rejected");

  // roles differ by site
  check(!(await can(alice.id, Cap.accessAdmin, main.id)) && !(await can(alice.id, Cap.accessAdmin, second.id)), "new user has no access anywhere");
  await addMemberByEmail(main.id, "sc-alice@example.com", "editor");
  await addMemberByEmail(second.id, "sc-alice@example.com", "subscriber");
  check(await can(alice.id, Cap.editPosts, main.id), "editor on main can edit posts");
  check(!(await can(alice.id, Cap.editPosts, second.id)), "subscriber on second cannot");
  check(!(await can(alice.id, Cap.accessAdmin, second.id)), "no admin access on second");
  check(!(await can(alice.id, Cap.manageUsers, main.id)), "editor cannot manage users");
  await setMemberRole(second.id, alice.id, "administrator");
  check(await can(alice.id, Cap.manageUsers, second.id) && !(await can(alice.id, Cap.manageUsers, main.id)), "administrator on second only");
  check(await fails(() => setMemberRole(second.id, alice.id, "wizard")), "unknown role rejected");
  check(await fails(() => addMemberByEmail(second.id, "ghost@example.com", "editor")), "unknown email rejected");

  // existing users
  check(await can(sub.id, Cap.accessAdmin, main.id) === false, "subscriber still has no access");
  check(await can(admin.id, Cap.manageOptions, main.id), "main admin keeps access");

  // super admin: everything everywhere, even without membership
  const outsider = await prisma.user.create({ data: { email: "sc-super@example.com", isSuperAdmin: true } });
  check(await can(outsider.id, Cap.manageOptions, main.id) && await can(outsider.id, Cap.manageOptions, second.id), "super admin can do anything on any site");
  check(!(await can("no-such-user", Cap.accessAdmin, main.id)), "unknown user denied");

  // the creator of a site is its administrator; a site keeps one
  check((await listMembers(second.id)).some((m) => m.id === admin.id && m.role === "administrator"), "creator is administrator");
  check(await fails(() => removeMember(second.id, admin.id)) === false, "can remove an admin while another exists");
  check(await fails(() => removeMember(second.id, alice.id)), "cannot remove the last administrator");
  check(await fails(() => setMemberRole(second.id, alice.id, "editor")), "cannot demote the last administrator");
  check((await removeMember(main.id, alice.id)) === true && (await removeMember(main.id, alice.id)) === false, "remove, then no-op");
  check(!(await can(alice.id, Cap.editPosts, main.id)), "removed member loses access");

  await prisma.user.deleteMany({ where: { email: { startsWith: "sc-" } } });
  await deleteSite(second.id);
  if (failures) throw new Error(`${failures} membership check(s) failed`);
  console.log("members self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
