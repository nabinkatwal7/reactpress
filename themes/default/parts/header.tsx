import { SiteLink } from "@/components/public/site-link";
import { ContentBlocks } from "@/components/content-blocks";
import { MenuList } from "@/components/public/parts";
import type { PartProps } from "@/lib/theme/types";

export default function Header({ ctx }: PartProps) {
  const logo = typeof ctx.mods.logo === "string" ? ctx.mods.logo : "";
  const banner = ctx.partContent.header;
  return (
    <header className="border-b border-current/15">
      {banner?.length ? (
        <div className="border-b border-current/15 px-4 py-2 text-center text-sm">
          <ContentBlocks content={banner} />
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <SiteLink href="/" className="flex items-center gap-3">
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
        </SiteLink>
        <nav aria-label="Primary" className="flex items-center gap-6 text-sm">
          <MenuList items={ctx.menus.primary} />
          <SiteLink href="/search" className="hover:underline">
            Search
          </SiteLink>
        </nav>
      </div>
    </header>
  );
}
