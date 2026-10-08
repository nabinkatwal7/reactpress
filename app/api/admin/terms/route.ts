import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { getTaxonomy } from "@/lib/registry";
import { requireSiteId } from "@/lib/site";
import { createTerm, listTerms } from "@/lib/terms";
import { createTermSchema } from "@/lib/validations/term";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;

  const taxonomy = new URL(request.url).searchParams.get("taxonomy");
  if (!taxonomy) return NextResponse.json({ error: "taxonomy required" }, { status: 400 });
  return NextResponse.json({ terms: await listTerms(await requireSiteId(), taxonomy) });
}

export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createTermSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const siteId = await requireSiteId();
  if (!(await getTaxonomy(siteId, parsed.data.taxonomy))) {
    return NextResponse.json({ error: "Unknown taxonomy" }, { status: 400 });
  }

  try {
    const term = await createTerm(siteId, parsed.data);
    return NextResponse.json({ term }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
