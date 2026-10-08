import type { ZodType } from "zod";
import { NextResponse } from "next/server";

/** Parse a JSON body with a zod schema; returns data or a 400 response. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}
