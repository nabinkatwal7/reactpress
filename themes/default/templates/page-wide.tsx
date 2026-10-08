import { Content } from "../layout";
import { ContentBlocks } from "@/components/content-blocks";
import type { PageProps } from "@/lib/theme/types";

/** Full-width page without the sidebar. Not part of the automatic hierarchy: sites opt in with a template override. */
export default function PageWide({ page }: PageProps) {
  return (
    <Content sidebar={false}>
      <article className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
        <ContentBlocks content={page.content} />
      </article>
    </Content>
  );
}
