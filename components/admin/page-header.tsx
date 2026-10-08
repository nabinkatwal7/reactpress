import Link from "next/link";

/** Standard admin screen header: optional back link, title, optional actions on the right. */
export function PageHeader({
  title,
  back,
  actions,
}: {
  title: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {back ? (
          <Link href={back.href} className="text-sm text-neutral-500 hover:underline">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className={`text-2xl font-semibold tracking-tight ${back ? "mt-2" : ""}`}>{title}</h1>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Link styled as the primary action button. */
export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white">
      {children}
    </Link>
  );
}
