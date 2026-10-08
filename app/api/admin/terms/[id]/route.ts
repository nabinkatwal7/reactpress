import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { deleteTerm, getTerm, updateTerm } from "@/lib/terms";
import { updateTermSchema } from "@/lib/validations/term";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;
  const { id } = await ctx.params;
  const term = await getTerm(await requireSiteId(), id);
  if (!term) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ term });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateTermSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;
  try {
    const term = await updateTerm(await requireSiteId(), id, parsed.data);
    if (!term) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ term });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;
  const { id } = await ctx.params;
  const ok = await deleteTerm(await requireSiteId(), id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
