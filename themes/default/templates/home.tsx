import { Content } from "../layout";
import { Pager, PostList } from "@/components/public/parts";
import type { HomeProps } from "@/lib/theme/types";

export default function Home({ posts, paging }: HomeProps) {
  return (
    <Content>
      <PostList posts={posts} empty="No posts yet." />
      <Pager paging={paging} basePath="/" />
    </Content>
  );
}
