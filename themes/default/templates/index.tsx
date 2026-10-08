import { Content } from "../layout";
import { PostList } from "@/components/public/parts";
import type { HomeProps } from "@/lib/theme/types";

/** Last-resort template: used whenever nothing more specific exists. Renders whatever posts it is given. */
export default function Index(props: Partial<HomeProps>) {
  return (
    <Content>
      <PostList posts={props.posts ?? []} empty="Nothing to show here." />
    </Content>
  );
}
