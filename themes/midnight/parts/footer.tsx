import { SiteLink } from "@/components/public/site-link";
import { ContentBlocks } from "@/components/content-blocks";
import { MenuList } from "@/components/public/parts";
import type { PartProps } from "@/lib/theme/types";

export default function Footer({ ctx }: PartProps) {
  const custom = ctx.partContent.footer;
  return (
    <footer className="mt-auto flex flex-col items-center gap-3 px-4 py-8 text-center text-sm">
      <MenuList items={ctx.menus.footer} className="flex flex-wrap justify-center gap-4" />
      {custom?.length ? <ContentBlocks content={custom} /> : null}
      <p className="opacity-50">
        {ctx.site.title} ·{" "}
        <SiteLink href="/search" className="hover:underline">
          Search
        </SiteLink>{" "}
        ·{" "}
        <SiteLink href="/admin" className="hover:underline">
          Admin
        </SiteLink>
      </p>
    </footer>
  );
}
