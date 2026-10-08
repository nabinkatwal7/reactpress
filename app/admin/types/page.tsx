import { PageHeader } from "@/components/admin/page-header";
import { listPostTypes, listTaxonomies } from "@/lib/registry";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { createPostTypeAction, createTaxonomyAction } from "./actions";

export const instant = false;

const input = "rounded border border-neutral-300 px-3 py-2";
const button = "w-fit rounded bg-neutral-900 px-3 py-2 font-medium text-white";

export default async function TypesPage() {
  const siteId = await requireSiteId();
  const [types, taxonomies] = await Promise.all([listPostTypes(siteId), listTaxonomies(siteId)]);

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <PageHeader title="Content types" />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Post types</h2>
        <ul className="divide-y divide-neutral-200 border border-neutral-200 text-sm">
          {types.map((t) => (
            <li key={t.key} className="flex items-center justify-between px-4 py-3">
              <Link href={`/admin/posts?type=${t.key}`} className="font-medium hover:underline">
                {t.label}
              </Link>
              <span className="text-neutral-500">
                {t.key} · {t.source}
              </span>
            </li>
          ))}
        </ul>
        <form action={createPostTypeAction} className="flex max-w-xl flex-col gap-2 text-sm">
          <input name="key" required placeholder="key (e.g. product)" className={input} />
          <input name="label" required placeholder="Label (e.g. Products)" className={input} />
          <input name="singular" placeholder="Singular (e.g. Product)" className={input} />
          <button type="submit" className={button}>
            Register post type
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Taxonomies</h2>
        <ul className="divide-y divide-neutral-200 border border-neutral-200 text-sm">
          {taxonomies.map((t) => (
            <li key={t.key} className="flex items-center justify-between px-4 py-3">
              <Link href={`/admin/terms/${t.key}`} className="font-medium hover:underline">
                {t.label}
              </Link>
              <span className="text-neutral-500">
                {t.key} · {t.hierarchical ? "hierarchical" : "flat"} · {t.source}
              </span>
            </li>
          ))}
        </ul>
        <form action={createTaxonomyAction} className="flex max-w-xl flex-col gap-2 text-sm">
          <input name="key" required placeholder="key (e.g. genre)" className={input} />
          <input name="label" required placeholder="Label (e.g. Genres)" className={input} />
          <input name="singular" placeholder="Singular (e.g. Genre)" className={input} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="hierarchical" /> Hierarchical
          </label>
          <button type="submit" className={button}>
            Register taxonomy
          </button>
        </form>
      </section>
    </main>
  );
}
