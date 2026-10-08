import { searchContent } from "@/lib/search";
import { requireSiteId } from "@/lib/site";
import { NextResponse } from "next/server";

/** Public: ranked search over published posts and pages. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = sp.get("q") ?? "";
  const limit = Number(sp.get("limit") ?? 10);
  const offset = Number(sp.get("offset") ?? 0);
  if (!Number.isFinite(limit) || !Number.isFinite(offset)) {
    return NextResponse.json({ error: "Invalid paging" }, { status: 400 });
  }
  const results = await searchContent(await requireSiteId(), q, { limit, offset });
  return NextResponse.json({ query: q, results });
}
