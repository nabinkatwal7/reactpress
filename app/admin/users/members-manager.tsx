"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Member = { id: string; name: string | null; email: string; role: string; isSuperAdmin: boolean };
type Role = { key: string; name: string };

const input = "rounded border border-neutral-300 px-3 py-2 text-sm";

async function call(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return null;
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return json?.error ?? "Request failed";
}

export function MembersManager({ members, roles, selfId }: { members: Member[]; roles: Role[]; selfId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles.find((r) => r.key === "editor")?.key ?? roles[0]?.key ?? "");
  const [error, setError] = useState<string | null>(null);

  async function run(p: Promise<string | null>) {
    setError(null);
    const err = await p;
    if (err) setError(err);
    else router.refresh();
    return err;
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!(await run(call("/api/admin/users", "POST", { email, role })))) setEmail("");
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Add an existing user by email
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Role
          <select className={input} value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">
          Add to site
        </button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <table className="w-full max-w-3xl border border-neutral-200 text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-500">
          <tr>
            <th className="p-3 font-medium">User</th>
            <th className="p-3 font-medium">Role on this site</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-t border-neutral-200">
              <td className="p-3">
                {m.name ?? m.email}
                {m.isSuperAdmin ? <span className="ml-2 rounded bg-neutral-200 px-2 py-0.5 text-xs">Super admin</span> : null}
                <span className="block text-xs text-neutral-500">{m.email}</span>
              </td>
              <td className="p-3">
                <select
                  className={input}
                  value={m.role}
                  onChange={(e) => run(call(`/api/admin/users/${m.id}`, "PATCH", { role: e.target.value }))}
                >
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-3 text-right">
                {m.id !== selfId ? (
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => run(call(`/api/admin/users/${m.id}`, "DELETE"))}
                  >
                    Remove
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {members.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-3 text-neutral-500">
                No members yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="text-sm text-neutral-500">
        Super admins can always manage every site and are not limited by their role here.
      </p>
    </div>
  );
}
