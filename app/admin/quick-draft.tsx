"use client";

import { useActionState } from "react";
import { quickDraftAction, type QuickDraftState } from "./actions";

const initial: QuickDraftState = {};
const field = "rounded border border-neutral-300 px-3 py-2 text-sm";

export function QuickDraft() {
  const [state, action, pending] = useActionState(quickDraftAction, initial);

  return (
    <form action={action} key={state.savedId ?? "new"} className="flex flex-col gap-2">
      <input name="title" required placeholder="Title" className={field} />
      <textarea name="content" rows={4} placeholder="What's on your mind?" className={field} />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.savedId ? <p className="text-sm text-green-700">Draft saved.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save draft"}
      </button>
    </form>
  );
}
