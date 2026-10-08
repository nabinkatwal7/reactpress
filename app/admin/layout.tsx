import { requireAdmin } from "@/lib/require-admin";
import { getSettings } from "@/lib/settings";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "./actions";
import { AdminNav } from "./admin-nav";

export const instant = false;

async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const settings = await getSettings(await requireSiteId());

  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-neutral-200 bg-neutral-50 p-4">
        <Link href="/admin" className="px-2 text-sm font-semibold tracking-tight">
          ReactPress
        </Link>
        <AdminNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-8 py-3 text-sm">
          <Link href="/" target="_blank" className="font-medium hover:underline">
            {settings.site_title} ↗
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-neutral-500">{session.user?.email}</span>
            <form action={signOutAction}>
              <button type="submit" className="text-neutral-600 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">
          Checking access…
        </main>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
