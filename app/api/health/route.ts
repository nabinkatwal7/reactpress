import { resolveSite } from "@/lib/site";
import { NextResponse } from "next/server";

export async function GET() {
  const site = await resolveSite();

  return NextResponse.json({
    ok: true,
    service: "reactpress",
    siteId: site.id,
    site: { name: site.name, slug: site.slug },
    time: new Date().toISOString(),
  });
}
