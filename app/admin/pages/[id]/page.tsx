import { PageHeader } from "@/components/admin/page-header";
import { getPage } from "@/lib/pages";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageForm } from "../page-form";

export const instant = false;

function toLocalInput(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

type Props = { params: Promise<{ id: string }> };

export default async function EditPagePage({ params }: Props) {
  const { id } = await params;
  const siteId = await requireSiteId();
  const page = await getPage(siteId, id);
  if (!page) notFound();

  const contentText = JSON.stringify(page.content ?? [], null, 2);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader back={{ href: "/admin/pages", label: "Pages" }} title="Edit page" />
      <PageForm
        mode="edit"
        pageId={page.id}
        defaults={{
          title: page.title,
          slug: page.slug,
          status: page.status,
          contentText,
          scheduledAt: page.scheduledAt ? toLocalInput(page.scheduledAt) : "",
        }}
      />
    </main>
  );
}
