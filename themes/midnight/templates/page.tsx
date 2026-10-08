import { Shell } from "../layout";
import { ContentBlocks } from "@/components/content-blocks";
import type { PageProps } from "@/lib/theme/types";

export default function Page({ page }: PageProps) {
  return (
    <Shell>
      <article className="flex flex-col gap-5 text-lg leading-relaxed">
        <h1 className="text-4xl font-bold tracking-tight">{page.title}</h1>
        <ContentBlocks content={page.content} />
      </article>
    </Shell>
  );
}
