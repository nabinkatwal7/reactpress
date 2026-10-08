import { Cap, can } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { saveAutosave } from "@/lib/revisions";
import { requireSiteId } from "@/lib/site";
import { autosaveSchema } from "@/lib/validations/revision";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const gate = await requireApiAdmin();
  if (isApiError(gate)) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = autosaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { type, id, title, content } = parsed.data;
  const cap = type === "post" ? Cap.editPosts : Cap.editPages;
  if (!(await can(gate.userId, cap))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const revision = await saveAutosave(await requireSiteId(), type, id, gate.userId, {
    title,
    content,
  });
  if (!revision) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ revision });
}
