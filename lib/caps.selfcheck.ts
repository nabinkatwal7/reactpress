/**
 * ponytail: smallest runnable check for can() — run with:
 *   npx tsx lib/caps.selfcheck.ts
 */
import { PrismaClient } from "@prisma/client";
import { Cap, can } from "./caps";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@reactpress.local" },
  });
  const sub = await prisma.user.findUniqueOrThrow({
    where: { email: "subscriber@reactpress.local" },
  });

  const adminOk = await can(admin.id, Cap.accessAdmin);
  const subOk = await can(sub.id, Cap.accessAdmin);
  const nobody = await can(null, Cap.accessAdmin);

  console.assert(adminOk === true, "admin should have access_admin");
  console.assert(subOk === false, "subscriber should not have access_admin");
  console.assert(nobody === false, "null user should not have access_admin");

  if (!adminOk || subOk || nobody) {
    throw new Error("can() self-check failed");
  }
  console.log("can() self-check passed");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
