import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * API tokens. Format `rp_<43 url-safe chars>`; only the SHA-256 hash is stored (the token is a
 * high-entropy random value, so a fast hash is enough and lookups stay one indexed query).
 */

export const TOKEN_PREFIX = "rp_";
export const DEFAULT_TTL_DAYS = 90;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newToken() {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export async function createToken(userId: string, name: string, ttlDays: number | null = DEFAULT_TTL_DAYS) {
  const token = newToken();
  const row = await prisma.apiToken.create({
    data: {
      userId,
      name: name.trim().slice(0, 100) || "token",
      prefix: token.slice(0, 11),
      tokenHash: hashToken(token),
      expiresAt: ttlDays ? new Date(Date.now() + ttlDays * 86_400_000) : null,
    },
  });
  return { token, id: row.id, expiresAt: row.expiresAt };
}

/** The user a bearer token belongs to, or null when unknown or expired. Touches lastUsedAt (at most hourly). */
export async function verifyToken(token: string): Promise<{ userId: string; tokenId: string } | null> {
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 200) return null;
  const row = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 3_600_000) {
    await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { userId: row.userId, tokenId: row.id };
}

export function listTokens(userId: string) {
  return prisma.apiToken.findMany({
    where: { userId },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeToken(userId: string, id: string) {
  return (await prisma.apiToken.deleteMany({ where: { id, userId } })).count > 0;
}

/** Check email + password like the login form does. Returns the user id or null. */
export async function verifyPassword(email: string, password: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // always run a hash comparison so unknown emails take as long as wrong passwords
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const ok = await bcrypt.compare(password, hash);
  return user && ok ? user.id : null;
}
