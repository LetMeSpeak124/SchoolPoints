'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { verifyPassword, setSessionCookie, clearSessionCookie } from '@/lib/auth';
import { Role } from '@/lib/types';

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Please enter both username and password' };
  }

  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
  });

  if (!user) {
    return { error: 'Invalid username or password' };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { error: 'Invalid username or password' };
  }

  await setSessionCookie({
    userId: user.id,
    username: user.username,
    role: user.role as Role,
    name: user.name,
  });

  redirect('/dashboard');
}

export async function demoLoginAction(demoTarget: 'admin' | 'teacher_approved' | 'teacher_pending' | 'student') {
  let targetUsername = 'admin';

  if (demoTarget === 'admin') {
    targetUsername = 'admin';
  } else if (demoTarget === 'teacher_approved') {
    targetUsername = 'teacher_sarah';
  } else if (demoTarget === 'teacher_pending') {
    targetUsername = 'teacher_john';
  } else if (demoTarget === 'student') {
    targetUsername = 'student_alice';
  }

  const user = await prisma.user.findUnique({
    where: { username: targetUsername },
  });

  if (!user) {
    return { error: `Demo user ${targetUsername} not found. Run seed script first.` };
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
