import Link from "next/link";
import { MenuList } from "@/components/public/parts";
import type { PartProps } from "@/lib/theme/types";

export default function Header({ ctx }: PartProps) {
  const logo = typeof ctx.mods.logo === "string" ? ctx.mods.logo : "";
  return (
    <header className="border-b border-current/15">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={ctx.site.title} className="h-10 w-auto" />
          ) : (
            <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--rp-primary_color)" }}>
              {ctx.site.title}
            </span>
          )}
          {ctx.mods.show_tagline && ctx.site.tagline ? (
            <span className="hidden text-sm opacity-60 sm:inline">{ctx.site.tagline}</span>
          ) : null}
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6 text-sm">
          <MenuList items={ctx.menus.primary} />
          <Link href="/search" className="hover:underline">
            Search
          </Link>
        </nav>
      </div>
    </header>
  );
}
