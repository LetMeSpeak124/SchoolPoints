import { describe, it, expect, beforeEach } from 'vitest';
import {
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  clearLoginFailures,
  getLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimiter,
} from '../src/lib/rate-limit';

describe('login rate limiter', () => {
  const key = 'login:127.0.0.1:test_user';
  const start = Date.UTC(2026, 10, 3, 9, 0, 0);

  beforeEach(() => {
    resetLoginRateLimiter();
  });

  it('allows attempts before the failure limit is reached', () => {
    for (let index = 0; index < LOGIN_MAX_FAILURES - 1; index += 1) {
      const status = recordLoginFailure(key, start);
      expect(status.limited).toBe(false);
      expect(status.remaining).toBe(LOGIN_MAX_FAILURES - index - 1);
    }

    expect(getLoginRateLimit(key, start).limited).toBe(false);
  });

  it('blocks once the failure limit is reached', () => {
    for (let index = 0; index < LOGIN_MAX_FAILURES; index += 1) {
      recordLoginFailure(key, start);
    }

    const status = getLoginRateLimit(key, start);
    expect(status.limited).toBe(true);
    expect(status.remaining).toBe(0);
    expect(status.retryAfterSeconds).toBe(LOGIN_WINDOW_MS / 1000);
  });

  it('unblocks after the window expires', () => {
    for (let index = 0; index < LOGIN_MAX_FAILURES; index += 1) {
      recordLoginFailure(key, start);
    }

    expect(getLoginRateLimit(key, start + LOGIN_WINDOW_MS).limited).toBe(false);
    expect(getLoginRateLimit(key, start + LOGIN_WINDOW_MS).remaining).toBe(
      LOGIN_MAX_FAILURES
    );
  });

  it('keeps separate keys independent', () => {
    for (let index = 0; index < LOGIN_MAX_FAILURES; index += 1) {
      recordLoginFailure(key, start);
    }

    expect(getLoginRateLimit(key, start).limited).toBe(true);
    expect(getLoginRateLimit('login:127.0.0.1:other_user', start).limited).toBe(false);
  });

  it('clears failures after a successful login', () => {
    recordLoginFailure(key, start);
    recordLoginFailure(key, start);
    clearLoginFailures(key);

    expect(getLoginRateLimit(key, start).remaining).toBe(LOGIN_MAX_FAILURES);
  });
});
