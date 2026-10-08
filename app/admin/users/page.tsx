import { PageHeader } from "@/components/admin/page-header";
import { listMembers, listRoles } from "@/lib/network/members";
import { Cap, can } from "@/lib/caps";
import { requireAdmin } from "@/lib/require-admin";
import { requireSiteId } from "@/lib/site";
import { redirect } from "next/navigation";
import { MembersManager } from "./members-manager";

export const instant = false;

export default async function SiteUsersPage() {
  const session = await requireAdmin();
  if (!(await can(session.user!.id, Cap.manageUsers))) redirect("/admin");
  const siteId = await requireSiteId();
  const [members, roles] = await Promise.all([listMembers(siteId), listRoles()]);
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Users" />
      <MembersManager
        members={members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, isSuperAdmin: m.isSuperAdmin }))}
        roles={roles}
        selfId={session.user!.id}
      />
    </main>
  );
}
