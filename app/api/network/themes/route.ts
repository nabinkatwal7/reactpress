import { parseBody } from "@/lib/api-json";
import { getDefaultNetwork } from "@/lib/network/sites";
import { setEnabledThemes } from "@/lib/network/policy";
import { requireApiSuperAdmin } from "@/lib/require-super-admin";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ enabled: z.array(z.string()) });

/** Body: { enabled: string[] } — the themes sites may use. Empty means all. */
export async function PUT(request: Request) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  const body = await parseBody(request, schema);
  if ("error" in body) return body.error;
  try {
    await setEnabledThemes((await getDefaultNetwork()).id, body.data.enabled);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
