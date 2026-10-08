import { Cap } from "@/lib/caps";
import { createMedia, mediaUrl, queryMedia } from "@/lib/media";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const gate = await requireApiAdmin(Cap.uploadFiles);
  if (isApiError(gate)) return gate.error;

  const sp = new URL(request.url).searchParams;
  const kind = sp.get("kind");
  const { items, total, pages } = await queryMedia(await requireSiteId(), {
    q: sp.get("q") ?? undefined,
    kind: kind === "image" || kind === "other" ? kind : undefined,
    page: Number(sp.get("page")) || 1,
  });
  return NextResponse.json({
    media: items.map((m) => ({ ...m, url: mediaUrl(m.path) })),
    total,
    pages,
  });
}

export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.uploadFiles);
  if (isApiError(gate)) return gate.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  try {
    const media = await createMedia(await requireSiteId(), gate.userId, file);
    return NextResponse.json({ media: { ...media, url: mediaUrl(media.path) } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
