/**
 * Small in-memory sliding-window limiter for login failures.
 *
 * This protects a single Node process (the local/single-instance PoC). A
 * multi-instance deployment must replace the Map with a shared store such as
 * Redis or a database table. The interface is intentionally small so that
 * swap does not require changing the login action.
 */

import { prisma } from './prisma';

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;

interface AttemptState {
  failures: number;
  resetAt: number;
}

const attempts = new Map<string, AttemptState>();

export interface LoginRateLimitStatus {
  limited: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

function pruneExpired(now: number): void {
  for (const [key, state] of attempts) {
    if (state.resetAt <= now) {
      attempts.delete(key);
    }
  }
}

export function getLoginRateLimit(key: string, now = Date.now()): LoginRateLimitStatus {
  const state = attempts.get(key);

  if (!state || state.resetAt <= now) {
    if (state) attempts.delete(key);
    return {
      limited: false,
      retryAfterSeconds: 0,
      remaining: LOGIN_MAX_FAILURES,
    };
  }

  const remaining = Math.max(0, LOGIN_MAX_FAILURES - state.failures);
  return {
    limited: state.failures >= LOGIN_MAX_FAILURES,
    retryAfterSeconds:
      state.failures >= LOGIN_MAX_FAILURES
        ? Math.max(0, Math.ceil((state.resetAt - now) / 1000))
        : 0,
    remaining,
  };
}

export function recordLoginFailure(key: string, now = Date.now()): LoginRateLimitStatus {
  pruneExpired(now);

  const existing = attempts.get(key);
  const state =
    existing && existing.resetAt > now
      ? existing
      : { failures: 0, resetAt: now + LOGIN_WINDOW_MS };

  state.failures += 1;
  attempts.set(key, state);

  return getLoginRateLimit(key, now);
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}

/** Exposed for tests only. */
export function resetLoginRateLimiter(): void {
  attempts.clear();
}

export interface DbRateLimitStatus {
  limited: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export async function getDbLoginRateLimit(key: string, now = new Date()): Promise<DbRateLimitStatus> {
  const windowMs = LOGIN_WINDOW_MS;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const bucket = await prisma.rateLimitBucket.findUnique({
    where: { key_windowStart: { key, windowStart } },
  });

  const failures = bucket?.count ?? 0;
  const remaining = Math.max(0, LOGIN_MAX_FAILURES - failures);

  if (failures >= LOGIN_MAX_FAILURES) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(0, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000)),
      remaining: 0,
    };
  }

  return { limited: false, retryAfterSeconds: 0, remaining };
}

export async function recordDbLoginFailure(key: string, now = new Date()): Promise<DbRateLimitStatus> {
  const windowMs = LOGIN_WINDOW_MS;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);

  await prisma.rateLimitBucket.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1, expiresAt },
    update: { count: { increment: 1 }, expiresAt },
  });

  return getDbLoginRateLimit(key, now);
}

export async function clearDbLoginFailures(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}
