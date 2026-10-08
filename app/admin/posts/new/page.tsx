import Link from "next/link";
import { PostForm } from "../post-form";

export default function NewPostPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/admin/posts" className="text-sm text-neutral-500 hover:underline">
          ← Posts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add post</h1>
      </div>
      <PostForm mode="create" />
    </main>
  );
}
