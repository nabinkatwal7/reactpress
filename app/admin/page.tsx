import { PageHeader } from "@/components/admin/page-header";
import { getDashboardData } from "@/lib/dashboard";
import { resolveSite } from "@/lib/site";
import Link from "next/link";
import { QuickDraft } from "./quick-draft";

export const instant = false;

const card = "flex flex-col gap-3 border border-neutral-200 p-4";
const date = (d: Date | null) => (d ? d.toLocaleDateString("en", { month: "short", day: "numeric" }) : "");

export default async function AdminDashboardPage() {
  const site = await resolveSite();
  const { counts, recentPublished, recentComments, recentDrafts } = await getDashboardData(site.id);

  const glance = [
    { label: "Posts", n: counts.posts, href: "/admin/posts?status=publish" },
    { label: "Drafts", n: counts.drafts, href: "/admin/posts?status=draft" },
    { label: "Scheduled", n: counts.scheduled, href: "/admin/posts?status=scheduled" },
    { label: "Pages", n: counts.pages, href: "/admin/pages" },
    { label: "Media files", n: counts.media, href: "/admin/media" },
    { label: "Comments", n: counts.comments, href: "/admin/comments?status=approved" },
    { label: "Awaiting moderation", n: counts.pendingComments, href: "/admin/comments?status=pending" },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Dashboard" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-medium">At a glance</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {glance.map((g) => (
              <li key={g.label}>
                <Link href={g.href} className="hover:underline">
                  <strong className="text-lg">{g.n}</strong> {g.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">
            {site.name} · {site.slug}
          </p>
        </section>

        <section className={card}>
          <h2 className="font-medium">Quick draft</h2>
          <QuickDraft />
        </section>

        <section className={card}>
          <h2 className="font-medium">Recently published</h2>
          {recentPublished.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing published yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {recentPublished.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <Link href={`/admin/posts/${p.id}`} className="truncate hover:underline">
                    {p.title}
                  </Link>
                  <span className="shrink-0 text-neutral-500">{date(p.publishedAt)}</span>
                </li>
              ))}
            </ul>
          )}
          {recentDrafts.length ? (
            <>
              <h3 className="mt-2 text-sm font-medium">Your drafts</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {recentDrafts.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <Link href={`/admin/posts/${p.id}`} className="truncate hover:underline">
                      {p.title}
                    </Link>
                    <span className="shrink-0 text-neutral-500">{date(p.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className={card}>
          <h2 className="font-medium">Recent comments</h2>
          {recentComments.length === 0 ? (
            <p className="text-sm text-neutral-500">No comments yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {recentComments.map((c) => (
                <li key={c.id}>
                  <p className="text-neutral-500">
                    {c.authorName} on{" "}
                    <Link href={`/admin/posts/${c.post.id}`} className="underline">
                      {c.post.title}
                    </Link>
                    {c.status === "pending" ? " · pending" : ""}
                  </p>
                  <p className="truncate">{c.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
