import { requireSuperAdmin } from "@/lib/require-super-admin";
import Link from "next/link";
import { Suspense } from "react";
import { NetworkNav } from "./network-nav";

export const instant = false;

async function NetworkShell({ children }: { children: React.ReactNode }) {
  const session = await requireSuperAdmin();
  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-neutral-200 bg-neutral-50 p-4">
        <Link href="/network" className="px-2 text-sm font-semibold tracking-tight">
          Network admin
        </Link>
        <NetworkNav />
        <Link href="/admin" className="px-2 text-sm text-neutral-600 hover:underline">
          ← Site admin
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-neutral-200 px-8 py-3 text-sm text-neutral-500">
          {session.user?.email}
        </header>
        {children}
      </div>
    </div>
  );
}

export default function NetworkLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<main className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">Checking access…</main>}
    >
      <NetworkShell>{children}</NetworkShell>
    </Suspense>
  );
}
