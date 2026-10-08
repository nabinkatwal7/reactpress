import { SiteLink } from "@/components/public/site-link";
import { ContentBlocks } from "@/components/content-blocks";
import { MenuList } from "@/components/public/parts";
import type { PartProps } from "@/lib/theme/types";

export default function Footer({ ctx }: PartProps) {
  const custom = ctx.partContent.footer;
  return (
    <footer className="mt-auto border-t border-current/15 text-sm">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6">
        <MenuList items={ctx.menus.footer} />
        {custom?.length ? <ContentBlocks content={custom} /> : null}
        <p className="opacity-60">
          © {new Date().getFullYear()} {ctx.site.title} ·{" "}
          <SiteLink href="/admin" className="hover:underline">
            Admin
          </SiteLink>
        </p>
      </div>
    </footer>
  );
}
