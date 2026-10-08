import { InstallError, removeInstalledPackage } from "@/lib/marketplace/install";
import { requireApiSuperAdmin } from "@/lib/require-super-admin";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/** Remove a package that was installed from a registry. `?force=1` also deactivates it everywhere first. */
export async function DELETE(request: Request, ctx: { params: Promise<{ type: string; slug: string }> }) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  const { type, slug } = await ctx.params;
  if (type !== "theme" && type !== "plugin") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await removeInstalledPackage(type, slug, { force: new URL(request.url).searchParams.get("force") === "1" });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, needsRebuild: process.env.NODE_ENV === "production" });
  } catch (e) {
    const status = e instanceof InstallError ? 400 : 500;
    if (status === 500) console.error("[marketplace] remove failed:", e);
    return NextResponse.json({ error: status === 500 ? "Remove failed" : (e as Error).message }, { status });
  }
}
