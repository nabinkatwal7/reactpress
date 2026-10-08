import { resolveSite } from "@/lib/site";

export const instant = false;

export default async function AdminDashboardPage() {
  const site = await resolveSite();

  return (
    <main className="flex flex-1 flex-col gap-2 p-8">
      <p className="text-sm text-neutral-500">Admin</p>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-neutral-600">
        Site: <strong>{site.name}</strong>{" "}
        <span className="text-neutral-400">({site.slug})</span>
      </p>
      <p className="font-mono text-xs text-neutral-400">siteId: {site.id}</p>
    </main>
  );
}
