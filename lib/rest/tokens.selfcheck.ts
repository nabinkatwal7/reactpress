/** ponytail: run with `npx tsx lib/rest/tokens.selfcheck.ts` (needs the dev database) */
import { PrismaClient } from "@prisma/client";
import { createLimiter } from "./ratelimit";
import { createToken, hashToken, listTokens, revokeToken, verifyPassword, verifyToken } from "./tokens";

const prisma = new PrismaClient();
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });
  const sub = await prisma.user.findUniqueOrThrow({ where: { email: "subscriber@reactpress.local" } });
  await prisma.apiToken.deleteMany({ where: { name: { startsWith: "sc-" } } });

  const { token, id, expiresAt } = await createToken(admin.id, "sc-one");
  check(token.startsWith("rp_") && token.length > 40, "token format");
  check(!!expiresAt && expiresAt.getTime() > Date.now() + 80 * 86_400_000, "default expiry is ~90 days");
  const row = await prisma.apiToken.findUniqueOrThrow({ where: { id } });
  check(row.tokenHash === hashToken(token) && !JSON.stringify(row).includes(token), "only the hash is stored");
  check(token.startsWith(row.prefix), "prefix kept for display");

  const v = await verifyToken(token);
  check(v?.userId === admin.id && v.tokenId === id, "valid token verifies");
  check((await prisma.apiToken.findUniqueOrThrow({ where: { id } })).lastUsedAt !== null, "lastUsedAt is set");
  check((await verifyToken(token + "x")) === null && (await verifyToken("rp_nope")) === null && (await verifyToken("nope")) === null, "bad tokens fail");
  check((await verifyToken("rp_" + "a".repeat(300))) === null, "oversized token rejected");

  const listed = await listTokens(admin.id);
  check(listed.some((t) => t.id === id) && !JSON.stringify(listed).includes(token) && !JSON.stringify(listed).includes(row.tokenHash), "list never reveals secrets");

  await prisma.apiToken.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  check((await verifyToken(token)) === null, "expired token fails");

  const t2 = await createToken(admin.id, "sc-two", null);
  check(t2.expiresAt === null && (await verifyToken(t2.token)) !== null, "non-expiring token");
  check((await revokeToken(sub.id, t2.id)) === false, "cannot revoke someone else's token");
  check((await revokeToken(admin.id, t2.id)) === true && (await verifyToken(t2.token)) === null, "revoked token fails");

  check((await verifyPassword("admin@reactpress.local", "admin123")) === admin.id, "right password");
  check((await verifyPassword("ADMIN@reactpress.local", "admin123")) === admin.id, "email is case-insensitive");
  check((await verifyPassword("admin@reactpress.local", "wrong")) === null, "wrong password");
  check((await verifyPassword("ghost@reactpress.local", "admin123")) === null, "unknown email");

  const lim = createLimiter(3, 1000);
  const hits = [0, 1, 2, 3, 4].map(() => lim.hit("k", 1000));
  check(hits.join() === "false,false,false,true,true", "limiter trips after max");
  check(lim.hit("k", 2500) === false, "limiter window slides");
  check(lim.hit("other", 1000) === false, "keys are independent");

  await prisma.apiToken.deleteMany({ where: { name: { startsWith: "sc-" } } });
  if (failures) throw new Error(`${failures} token check(s) failed`);
  console.log("tokens self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
