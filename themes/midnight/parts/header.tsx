import Link from "next/link";
import { ContentBlocks } from "@/components/content-blocks";
import { MenuList } from "@/components/public/parts";
import type { PartProps } from "@/lib/theme/types";

export default function Header({ ctx }: PartProps) {
  const logo = typeof ctx.mods.logo === "string" ? ctx.mods.logo : "";
  const banner = ctx.partContent.header;
  return (
    <header className="flex flex-col items-center gap-3 px-4 pt-10 text-center">
      {banner?.length ? (
        <div className="border-b border-current/15 px-4 py-2 text-center text-sm">
          <ContentBlocks content={banner} />
        </div>
      ) : null}
      <Link href="/" className="flex flex-col items-center gap-2">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={ctx.site.title} className="h-14 w-auto" />
        ) : (
          <span className="text-3xl font-bold tracking-tight" style={{ color: "var(--rp-primary_color)" }}>
            {ctx.site.title}
          </span>
        )}
      </Link>
      {ctx.mods.show_tagline && ctx.site.tagline ? <p className="text-sm opacity-60">{ctx.site.tagline}</p> : null}
      <nav aria-label="Primary" className="text-sm">
        <MenuList items={ctx.menus.primary} className="flex flex-wrap justify-center gap-5" />
      </nav>
    </header>
  );
}
