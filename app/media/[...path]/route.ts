import { readFile } from "node:fs/promises";
import { absolutePath, isImage } from "@/lib/media";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ path: string[] }> };

/** Public file server for uploads. Only paths that exist in the Media table are served. */
export async function GET(_request: Request, ctx: Ctx) {
  const { path: segments } = await ctx.params;
  const rel = segments.join("/");
  if (!/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/.test(rel)) {
    return new Response("Not found", { status: 404 });
  }

  const media = await prisma.media.findUnique({ where: { path: rel } });
  if (!media) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(absolutePath(rel));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        ...(isImage(media.mimeType)
          ? {}
          : { "Content-Disposition": `inline; filename="${encodeURIComponent(media.filename)}"` }),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
