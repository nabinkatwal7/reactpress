import { parseBody } from "@/lib/api-json";
import { setNetworkPlugins } from "@/lib/network/policy";
import { getDefaultNetwork } from "@/lib/network/sites";
import { reloadPlugins } from "@/lib/plugins/loader";
import { prisma } from "@/lib/prisma";
import { requireApiSuperAdmin } from "@/lib/require-super-admin";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ plugins: z.array(z.string()) });

/** Body: { plugins: string[] } — plugins active on every site of the network. */
export async function PUT(request: Request) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  const body = await parseBody(request, schema);
  if ("error" in body) return body.error;
  try {
    const network = await getDefaultNetwork();
    await setNetworkPlugins(network.id, body.data.plugins);
    const sites = await prisma.site.findMany({ where: { networkId: network.id }, select: { id: true } });
    await Promise.all(sites.map((s) => reloadPlugins(s.id)));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
