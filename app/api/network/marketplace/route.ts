import { loadCatalog } from "@/lib/marketplace/catalog";
import { getDefaultNetwork } from "@/lib/network/sites";
import { requireApiSuperAdmin } from "@/lib/require-super-admin";
import { NextResponse } from "next/server";

/** The catalog: items from every registry of the network, with their status on this server. `?fresh=1` skips the cache. */
export async function GET(request: Request) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  return NextResponse.json(await loadCatalog((await getDefaultNetwork()).id, { fresh }));
}
