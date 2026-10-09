/**
 * Brute-force throttle for password sign in.
 *
 * Counts consecutive failed attempts per email in Redis, which the app already
 * runs for BullMQ, so this adds no new infrastructure.
 *
 * Fails open: if Redis is unreachable the sign-in attempt is allowed and a
 * warning is logged. Redis being down already degrades the DM queue, and
 * locking the owner out of their own dashboard is a worse outcome than a
 * temporarily missing throttle. Magic-link sign in is unaffected either way.
 */

import { getRedisConnection } from "@/lib/queue/client";

const MAX_FAILED_ATTEMPTS = 8;
const WINDOW_SECONDS = 15 * 60;

function key(email: string): string {
  return `login:fail:${email.toLowerCase().trim()}`;
}

/** True when this email currently has too many recent failures. */
export async function isLoginBlocked(email: string): Promise<boolean> {
  try {
    const value = await getRedisConnection().get(key(email));
    return Number(value ?? 0) >= MAX_FAILED_ATTEMPTS;
  } catch (error) {
    console.warn(
      "[Login throttle] Redis unavailable, allowing attempt:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

export async function recordFailedLogin(email: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    const k = key(email);
    const count = await redis.incr(k);
    // Only set the TTL on first failure so the window is fixed from the first
    // bad attempt rather than sliding forward on every retry.
    if (count === 1) {
      await redis.expire(k, WINDOW_SECONDS);
    }
  } catch {
    // Non-fatal; see fail-open note above.
  }
}

export async function clearFailedLogins(email: string): Promise<void> {
  try {
    await getRedisConnection().del(key(email));
  } catch {
    // Non-fatal.
  }
}

export { MAX_FAILED_ATTEMPTS, WINDOW_SECONDS };
