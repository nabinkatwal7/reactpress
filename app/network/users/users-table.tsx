"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = { id: string; name: string | null; email: string; isSuperAdmin: boolean; sites: string[] };

const input = "rounded border border-neutral-300 px-3 py-2 text-sm";

export function UsersTable({ users }: { users: Row[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", name: "", password: "" });

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/network/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(json?.error ?? "Request failed");
      return;
    }
    setForm({ email: "", name: "", password: "" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={create} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input className={input} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input className={input} type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">
          Create user
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <table className="w-full max-w-3xl border border-neutral-200 text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-500">
          <tr>
            <th className="p-3 font-medium">User</th>
            <th className="p-3 font-medium">Roles by site</th>
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
              <td className="p-3 text-neutral-600">{u.sites.length ? u.sites.join(", ") : "None"}</td>
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
