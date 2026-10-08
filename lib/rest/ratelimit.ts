/**
 * Tiny in-memory sliding-window limiter (per server process). Good enough to blunt password
 * guessing on the token endpoint; put a shared limiter in front for multi-instance deployments.
 */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** Record an attempt; returns true when the key is over the limit (the attempt should be refused). */
    hit(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
      return recent.length > max;
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}
