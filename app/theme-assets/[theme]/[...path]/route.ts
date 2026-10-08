import { readFile } from "node:fs/promises";
import path from "node:path";
import { isKnownTheme } from "@/lib/theme/themes";
import { THEMES_DIR } from "@/lib/theme/manifest";

type Ctx = { params: Promise<{ theme: string; path: string[] }> };

const TYPES: Record<string, string> = {
  css: "text/css",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  woff2: "font/woff2",
};

/** Static files from themes/<slug>/assets/. Only known themes and a fixed set of file types. */
export async function GET(_request: Request, ctx: Ctx) {
  const { theme, path: segments } = await ctx.params;
  const file = segments.join("/");
  const type = TYPES[file.split(".").pop()?.toLowerCase() ?? ""];
  if (!isKnownTheme(theme) || !type || !/^[A-Za-z0-9._/-]+$/.test(file) || file.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const root = path.join(THEMES_DIR, theme, "assets");
  const abs = path.join(root, file);
  if (!abs.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(abs);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        // svg themes assets must not run script when opened directly
        ...(type === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } : {}),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
