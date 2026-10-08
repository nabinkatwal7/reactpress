import { Content } from "../layout";
import { ContentBlocks } from "@/components/content-blocks";
import type { PageProps } from "@/lib/theme/types";

export default function Page({ page }: PageProps) {
  return (
    <Content>
      <article className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
        <ContentBlocks content={page.content} />
      </article>
    </Content>
  );
}
