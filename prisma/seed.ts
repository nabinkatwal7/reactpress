import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Cap } from "../lib/caps";

const prisma = new PrismaClient();

const CAPABILITIES: { key: string; name: string }[] = [
  { key: Cap.accessAdmin, name: "Access admin" },
  { key: Cap.editPosts, name: "Edit posts" },
  { key: Cap.publishPosts, name: "Publish posts" },
  { key: Cap.editPages, name: "Edit pages" },
  { key: Cap.uploadFiles, name: "Upload files" },
  { key: Cap.manageOptions, name: "Manage options" },
  { key: Cap.manageUsers, name: "Manage users" },
];

const ROLE_CAPS: Record<string, string[]> = {
  administrator: CAPABILITIES.map((c) => c.key),
  editor: [
    Cap.accessAdmin,
    Cap.editPosts,
    Cap.publishPosts,
    Cap.editPages,
    Cap.uploadFiles,
  ],
  author: [Cap.accessAdmin, Cap.editPosts, Cap.publishPosts, Cap.uploadFiles],
  contributor: [Cap.accessAdmin, Cap.editPosts],
  subscriber: [],
};

async function seedRolesAndCaps() {
  for (const cap of CAPABILITIES) {
    await prisma.capability.upsert({
      where: { key: cap.key },
      update: { name: cap.name },
      create: cap,
    });
  }

  const caps = await prisma.capability.findMany();
  const byKey = Object.fromEntries(caps.map((c) => [c.key, c.id]));

  for (const [key, capKeys] of Object.entries(ROLE_CAPS)) {
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    const role = await prisma.role.upsert({
      where: { key },
      update: { name },
      create: { key, name },
    });

    await prisma.roleCapability.deleteMany({ where: { roleId: role.id } });
    if (capKeys.length) {
      await prisma.roleCapability.createMany({
        data: capKeys.map((capKey) => ({
          roleId: role.id,
          capabilityId: byKey[capKey]!,
        })),
      });
    }
  }
}

async function seedDefaultSite() {
  const existingDefault = await prisma.site.findFirst({
    where: { isDefault: true },
  });
  if (existingDefault) return existingDefault;

  return prisma.site.upsert({
    where: { slug: "main" },
    update: { name: "ReactPress", isDefault: true },
    create: {
      name: "ReactPress",
      slug: "main",
      isDefault: true,
    },
  });
}

async function main() {
  await seedRolesAndCaps();
  const site = await seedDefaultSite();

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { key: "administrator" },
  });
  const subscriberRole = await prisma.role.findUniqueOrThrow({
    where: { key: "subscriber" },
  });

  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@reactpress.local" },
    update: { passwordHash: adminHash, name: "Admin", roleId: adminRole.id },
    create: {
      email: "admin@reactpress.local",
      name: "Admin",
      passwordHash: adminHash,
      roleId: adminRole.id,
    },
  });

  const subHash = await bcrypt.hash("subscriber123", 10);
  await prisma.user.upsert({
    where: { email: "subscriber@reactpress.local" },
    update: {
      passwordHash: subHash,
      name: "Subscriber",
      roleId: subscriberRole.id,
    },
    create: {
      email: "subscriber@reactpress.local",
      name: "Subscriber",
      passwordHash: subHash,
      roleId: subscriberRole.id,
    },
  });

  console.log(`Seeded default site ${site.slug} (${site.id})`);
  console.log("Seeded roles, capabilities, admin@reactpress.local / admin123");
  console.log("Seeded subscriber@reactpress.local / subscriber123 (no admin access)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
