import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { networkPluginSlugs } from "@/lib/network/policy";
import { installPlugin, isKnownPlugin } from "@/lib/plugins/plugins";
import { getPluginSettings, savePluginSettings } from "@/lib/plugins/settings";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

type Ctx = { params: Promise<{ slug: string }> };

const bodySchema = z.object({ values: z.record(z.string(), z.union([z.string(), z.boolean()])) });

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const { slug } = await ctx.params;
  if (!isKnownPlugin(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ values: await getPluginSettings(await requireSiteId(), PLUGIN_REGISTRY[slug].manifest) });
}

export async function PUT(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const { slug } = await ctx.params;
  if (!isKnownPlugin(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await parseBody(request, bodySchema);
  if ("error" in body) return body.error;

  const siteId = await requireSiteId();
  if ((await networkPluginSlugs(siteId)).includes(slug)) await installPlugin(siteId, slug);
  const values = await savePluginSettings(siteId, PLUGIN_REGISTRY[slug].manifest, body.data.values);
  if (!values) return NextResponse.json({ error: "Plugin is not installed" }, { status: 404 });
  revalidatePath("/", "layout");
  return NextResponse.json({ values });
}
