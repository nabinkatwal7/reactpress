import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 shrink-0 flex-col gap-4 border-r border-neutral-200 bg-neutral-50 p-4">
        <Link href="/admin" className="text-sm font-semibold tracking-tight">
          ReactPress Admin
        </Link>
        <nav className="flex flex-col gap-1 text-sm text-neutral-600">
          <span className="text-neutral-400">Dashboard</span>
          <span className="text-neutral-400">Posts</span>
          <span className="text-neutral-400">Pages</span>
          <span className="text-neutral-400">Media</span>
          <span className="text-neutral-400">Settings</span>
        </nav>
        <Link href="/" className="mt-auto text-sm text-neutral-500 hover:text-neutral-900">
          ← Public site
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
