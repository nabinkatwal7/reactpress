import { auth, signOut } from "@/auth";
import { WidgetArea } from "@/components/widget-area";
import { ContentBlocks } from "@/components/content-blocks";
import { prisma } from "@/lib/prisma";
import { getSettings, postPath } from "@/lib/settings";
import { getMenuForLocation, type ResolvedMenuItem } from "@/lib/menus";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { Suspense } from "react";

export const instant = false;

function MenuList({ items }: { items: ResolvedMenuItem[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} className="underline">
            {item.label}
          </Link>
          {item.children.length ? (
            <div className="ml-4">
              <MenuList items={item.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

async function PrimaryMenu() {
  const items = await getMenuForLocation(await requireSiteId(), "primary");
  if (items.length === 0) return null;
  return (
    <nav aria-label="Primary" className="text-sm">
      <MenuList items={items} />
    </nav>
  );
}

async function SiteContent() {
  const siteId = await requireSiteId();
  const settings = await getSettings(siteId);

  if (settings.homepage_mode === "page" && settings.homepage_page_id) {
    const page = await prisma.page.findFirst({
      where: { id: settings.homepage_page_id, siteId, status: "publish" },
    });
    if (page) {
      return (
        <article className="flex flex-col gap-3 text-sm">
          <h2 className="text-xl font-semibold">{page.title}</h2>
          <ContentBlocks content={page.content} />
        </article>
      );
    }
  }

  const posts = await prisma.post.findMany({
    where: { siteId, type: "post", status: "publish" },
    orderBy: { publishedAt: "desc" },
    take: settings.posts_per_page,
    select: { id: true, title: true, slug: true },
  });
  if (posts.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={postPath(settings, p.slug)} className="underline">
            {p.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function SiteHeading() {
  const settings = await getSettings(await requireSiteId());
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">{settings.site_title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{settings.tagline}</p>
    </>
  );
}

async function HomeContent() {
  const session = await auth();

  return (
    <>
      {session?.user ? (
        <div className="flex flex-col gap-3 rounded border border-neutral-200 p-4">
          <p className="text-sm">
            Signed in as <strong>{session.user.email}</strong>
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">You are not signed in.</p>
          <Link
            href="/login"
            className="inline-flex w-fit rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
          >
            Sign in
          </Link>
        </div>
      )}
    </>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <p className="text-sm text-neutral-500">ReactPress</p>
        <Suspense fallback={null}>
          <SiteHeading />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <PrimaryMenu />
      </Suspense>
      <Suspense fallback={null}>
        <SiteContent />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <HomeContent />
      </Suspense>
      <Suspense fallback={null}>
        <WidgetArea area="sidebar" />
      </Suspense>
      <nav className="flex gap-4 text-sm">
        <Link
          href="/admin"
          className="text-neutral-600 underline hover:text-neutral-900"
        >
          Admin
        </Link>
        <Link
          href="/search"
          className="text-neutral-600 underline hover:text-neutral-900"
        >
          Search
        </Link>
        <Link
          href="/api/health"
          className="text-neutral-600 underline hover:text-neutral-900"
        >
          API health
        </Link>
      </nav>
    </main>
  );
}
