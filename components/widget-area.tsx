import { prisma } from "@/lib/prisma";
import { requireSiteId } from "@/lib/site";
import { getAreaWidgets } from "@/lib/widgets";
import Link from "next/link";

type Settings = { title?: string; body?: string; count?: number };

/** Renders every widget in a registered area. Text is rendered as plain text (never HTML). */
export async function WidgetArea({ area }: { area: string }) {
  const siteId = await requireSiteId();
  const widgets = await getAreaWidgets(siteId, area);
  if (widgets.length === 0) return null;

  return (
    <aside className="flex flex-col gap-4 text-sm" aria-label={area}>
      {await Promise.all(
        widgets.map(async (w) => {
          const s = w.settings as Settings;
          return (
            <section key={w.id} className="flex flex-col gap-1">
              {s.title ? <h2 className="font-medium">{s.title}</h2> : null}
              {w.type === "text" ? <p className="whitespace-pre-wrap">{s.body}</p> : null}
              {w.type === "recent_posts" ? <RecentPosts siteId={siteId} count={s.count ?? 5} /> : null}
              {w.type === "categories" ? <Categories siteId={siteId} /> : null}
            </section>
          );
        }),
      )}
    </aside>
  );
}

async function RecentPosts({ siteId, count }: { siteId: string; count: number }) {
  const posts = await prisma.post.findMany({
    where: { siteId, type: "post", status: "publish" },
    orderBy: { publishedAt: "desc" },
    take: count,
    select: { id: true, title: true, slug: true },
  });
  return (
    <ul className="flex flex-col gap-1">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={`/posts/${p.slug}`} className="underline">
            {p.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Categories({ siteId }: { siteId: string }) {
  const terms = await prisma.term.findMany({
    where: { siteId, taxonomy: "category" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <ul className="flex flex-col gap-1">
      {terms.map((t) => (
        <li key={t.id}>{t.name}</li>
      ))}
    </ul>
  );
}
