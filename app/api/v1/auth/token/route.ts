import { parseBody } from "@/lib/api-json";
import { createLimiter } from "@/lib/rest/ratelimit";
import { createToken, verifyPassword } from "@/lib/rest/tokens";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  email: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
  name: z.string().max(100).optional(),
});

// 10 attempts per 15 minutes per client address, 5 per email
const byIp = createLimiter(10, 15 * 60_000);
const byEmail = createLimiter(5, 15 * 60_000);

/**
 * Exchange email + password for an API token (shown once). Used by `reactpress login`.
 * The token works on every site the user has a role on; the site is chosen by the URL.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const body = await parseBody(request, schema);
  if ("error" in body) return body.error;
  const email = body.data.email.trim().toLowerCase();

  if (byIp.hit(ip) || byEmail.hit(email)) {
    return NextResponse.json({ error: "Too many attempts, try again later" }, { status: 429 });
  }
  const userId = await verifyPassword(email, body.data.password);
  if (!userId) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  byEmail.reset(email);
  const { token, expiresAt } = await createToken(userId, body.data.name || "cli");
  return NextResponse.json({ token, expires_at: expiresAt }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
