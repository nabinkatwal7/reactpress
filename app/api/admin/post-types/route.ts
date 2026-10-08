import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { createPostType, listPostTypes } from "@/lib/registry";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { createPostTypeSchema } from "@/lib/validations/registry";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;
  return NextResponse.json({ postTypes: await listPostTypes(await requireSiteId()) });
}

export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, createPostTypeSchema);
  if ("error" in body) return body.error;

  try {
    const postType = await createPostType(await requireSiteId(), body.data);
    return NextResponse.json({ postType }, { status: 201 });
  } catch (e) {
    const dup = (e as { code?: string }).code === "P2002";
    return NextResponse.json(
      { error: dup ? "Key already exists" : (e as Error).message },
      { status: dup ? 409 : 400 },
    );
  }
}
