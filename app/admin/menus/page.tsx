import { listMenus, MENU_LOCATIONS } from "@/lib/menus";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { createMenuAction, deleteMenuAction } from "./actions";

export const instant = false;

export default async function MenusPage() {
  const menus = await listMenus(await requireSiteId());
  const label = (key: string) => MENU_LOCATIONS.find((l) => l.key === key)?.label ?? key;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <p className="text-sm text-neutral-500">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight">Menus</h1>
      </div>

      <form action={createMenuAction} className="flex max-w-xl gap-2 text-sm">
        <input
          name="name"
          required
          placeholder="New menu name"
          className="flex-1 rounded border border-neutral-300 px-3 py-2"
        />
        <button type="submit" className="rounded bg-neutral-900 px-3 py-2 font-medium text-white">
          Create menu
        </button>
      </form>

      {menus.length === 0 ? (
        <p className="text-sm text-neutral-600">No menus yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border border-neutral-200">
          {menus.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <Link href={`/admin/menus/${m.id}`} className="font-medium hover:underline">
                  {m.name}
                </Link>
                <p className="text-neutral-500">
                  {m._count.items} items
                  {m.locations.length ? ` · ${m.locations.map((l) => label(l.location)).join(", ")}` : ""}
                </p>
              </div>
              <form action={deleteMenuAction.bind(null, m.id)}>
                <button type="submit" className="text-red-600 hover:underline">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
