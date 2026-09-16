const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(ip: string, max = 20, windowMs = 60_000): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }
  if (entry.count >= max) return { ok: false, remaining: 0 };
  entry.count++;
  return { ok: true, remaining: max - entry.count };
}
