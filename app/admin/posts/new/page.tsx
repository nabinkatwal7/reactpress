import { PageHeader } from "@/components/admin/page-header";
import Link from "next/link";
import { PostForm } from "../post-form";

type Props = { searchParams: Promise<{ type?: string }> };

export default async function NewPostPage({ searchParams }: Props) {
  const { type } = await searchParams;
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader back={{ href: "/admin/posts", label: "Posts" }} title="Add post" />
      <PostForm
        mode="create"
        postType={type}
      />
    </main>
  );
}
