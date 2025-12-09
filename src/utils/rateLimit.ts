// Simple in-memory rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, maxRequests: number = 3, windowMs: number = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false; // Rate limit exceeded
  }

  record.count++;
  return true;
}

export function getRemainingRequests(key: string, maxRequests: number = 3): number {
  const record = rateLimitStore.get(key);
  if (!record || Date.now() > record.resetTime) {
    return maxRequests;
  }
  return Math.max(0, maxRequests - record.count);
}
