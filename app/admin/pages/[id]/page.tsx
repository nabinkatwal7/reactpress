import { getPage } from "@/lib/pages";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageForm } from "../page-form";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function EditPagePage({ params }: Props) {
  const { id } = await params;
  const siteId = await requireSiteId();
  const page = await getPage(siteId, id);
  if (!page) notFound();

  const contentText = JSON.stringify(page.content ?? [], null, 2);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/admin/pages" className="text-sm text-neutral-500 hover:underline">
          ← Pages
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit page</h1>
      </div>
      <PageForm
        mode="edit"
        pageId={page.id}
        defaults={{
          title: page.title,
          slug: page.slug,
          status: page.status,
          contentText,
        }}
      />
    </main>
  );
}
