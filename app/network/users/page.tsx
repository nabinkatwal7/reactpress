import { PageHeader } from "@/components/admin/page-header";
import { listNetworkUsers } from "@/lib/network/users";
import { UsersTable } from "./users-table";

export const instant = false;

export default async function NetworkUsersPage() {
  const users = await listNetworkUsers();
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Network users" />
      <UsersTable users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, isSuperAdmin: u.isSuperAdmin }))} />
    </main>
  );
}
