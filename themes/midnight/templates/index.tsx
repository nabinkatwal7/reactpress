import { Shell } from "../layout";
import { PostList } from "@/components/public/parts";
import type { HomeProps } from "@/lib/theme/types";

export default function Index(props: Partial<HomeProps>) {
  return (
    <Shell>
      <PostList posts={props.posts ?? []} empty="Nothing to show here." />
    </Shell>
  );
}
