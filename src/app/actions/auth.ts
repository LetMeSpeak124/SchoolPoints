'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyPassword, setSessionCookie, clearSessionCookie } from '@/lib/auth';
import {
  clearDbLoginFailures,
  getDbLoginRateLimit,
  recordDbLoginFailure,
} from '@/lib/rate-limit';
import { isDemoModeEnabled } from '@/lib/demo';
import { Role } from '@/lib/types';

// Used when the username does not exist so that invalid usernames and invalid
// passwords take a similar amount of time. The value never matches a real
// account because it is hashed from a random throwaway string.
const DUMMY_PASSWORD_HASH =
  '$2a$10$6DjEquD1tUuU37F/5tk96.rfJRzy.BEuWizghbvW5yfN40gdRrRqK';

async function getClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return headerStore.get('x-real-ip') ?? 'unknown';
}

export async function loginAction(formData: FormData) {
  const rawUsername = formData.get('username');
  const rawPassword = formData.get('password');
  const username =
    typeof rawUsername === 'string' ? rawUsername.trim().toLowerCase() : '';
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  if (!username || !password) {
    return { error: 'Please enter both username and password' };
  }

  const rateLimitKey = `login:${await getClientIp()}:${username}`;
  const rateLimit = await getDbLoginRateLimit(rateLimitKey);
  if (rateLimit.limited) {
    const minutes = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60));
    return {
      error: `Too many failed login attempts. Try again in ${minutes} minute${
        minutes === 1 ? '' : 's'
      }.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    await recordDbLoginFailure(rateLimitKey);
    return { error: 'Invalid username or password' };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    await recordDbLoginFailure(rateLimitKey);
    return { error: 'Invalid username or password' };
  }

  if (user.status !== 'ACTIVE') {
    return { error: 'This account is disabled. Contact the school administrator.' };
  }

  await clearDbLoginFailures(rateLimitKey);

  await setSessionCookie({
    userId: user.id,
    username: user.username,
    role: user.role as Role,
    name: user.name,
  });

  redirect('/dashboard');
}

export async function demoLoginAction(
  demoTarget: 'admin' | 'teacher_approved' | 'teacher_pending' | 'student'
) {
  if (!isDemoModeEnabled()) {
    return { error: 'Demo mode is disabled. Sign in with a school account.' };
  }

  const targetByRole = {
    admin: 'admin',
    teacher_approved: 'teacher_sarah',
    teacher_pending: 'teacher_john',
    student: 'student_alice',
  } as const;

  const targetUsername = targetByRole[demoTarget];

  const user = await prisma.user.findUnique({
    where: { username: targetUsername },
  });

  if (!user) {
    return {
      error: `Demo user ${targetUsername} not found. Run the seed script first.`,
    };
  }

  if (user.status !== 'ACTIVE') {
    return { error: `Demo user ${targetUsername} is disabled.` };
  }

  await setSessionCookie({
    userId: user.id,
    username: user.username,
    role: user.role as Role,
    name: user.name,
  });

  redirect('/dashboard');
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect('/login');
}
