"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = { id: string; name: string | null; email: string; isSuperAdmin: boolean };

export function UsersTable({ users }: { users: Row[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function toggle(u: Row) {
    setError(null);
    const res = await fetch(`/api/network/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSuperAdmin: !u.isSuperAdmin }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(json?.error ?? "Request failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <table className="w-full max-w-3xl border border-neutral-200 text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-500">
          <tr>
            <th className="p-3 font-medium">User</th>
            <th className="p-3 font-medium">Super admin</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-neutral-200">
              <td className="p-3">
                {u.name ?? u.email}
                <span className="block text-xs text-neutral-500">{u.email}</span>
              </td>
              <td className="p-3">
                <button type="button" onClick={() => toggle(u)} className="rounded border border-neutral-300 px-3 py-1.5">
                  {u.isSuperAdmin ? "Yes: revoke" : "No: grant"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
