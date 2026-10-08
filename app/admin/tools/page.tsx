import { PageHeader } from "@/components/admin/page-header";
import { Cap, can } from "@/lib/caps";
import { requireAdmin } from "@/lib/require-admin";
import { redirect } from "next/navigation";
import { ToolsPanel } from "./tools-panel";

export const instant = false;

export default async function ToolsPage() {
  const session = await requireAdmin();
  if (!(await can(session.user!.id, Cap.manageOptions))) redirect("/admin");
  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <PageHeader title="Tools" />
      <ToolsPanel />
    </main>
  );
}
