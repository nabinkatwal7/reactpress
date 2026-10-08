import { Content } from "../layout";
import { Pager, PostList } from "@/components/public/parts";
import type { ArchiveProps } from "@/lib/theme/types";

export default function Archive({ taxonomy, term, posts, paging }: ArchiveProps) {
  return (
    <Content>
      <header className="flex flex-col gap-1">
        <p className="text-sm opacity-60">{taxonomy.singular}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{term.name}</h1>
        {term.description ? <p>{term.description}</p> : null}
      </header>
      <PostList posts={posts} empty="No posts in this archive yet." />
      <Pager paging={paging} basePath={`/${taxonomy.key}/${term.slug}`} />
    </Content>
  );
}
