import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/require-admin";

export const instant = false;

async function AdminShell({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 shrink-0 flex-col gap-4 border-r border-neutral-200 bg-neutral-50 p-4">
        <Link href="/admin" className="text-sm font-semibold tracking-tight">
          ReactPress Admin
        </Link>
        <nav className="flex flex-col gap-1 text-sm text-neutral-600">
          <Link href="/admin" className="hover:text-neutral-900">
            Dashboard
          </Link>
          <Link href="/admin/posts" className="hover:text-neutral-900">
            Posts
          </Link>
          <Link href="/admin/terms/category" className="hover:text-neutral-900">
            Categories
          </Link>
          <Link href="/admin/terms/tag" className="hover:text-neutral-900">
            Tags
          </Link>
          <Link href="/admin/pages" className="hover:text-neutral-900">
            Pages
          </Link>
          <span className="text-neutral-400">Media</span>
          <span className="text-neutral-400">Settings</span>
        </nav>
        <Link
          href="/"
          className="mt-auto text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Public site
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
