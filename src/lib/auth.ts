import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';
import { Role } from './types';

const COOKIE_NAME = 'schoolpoints_session';
const TOKEN_ISSUER = 'schoolpoints';
const TOKEN_AUDIENCE = 'schoolpoints-web';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET is missing or shorter than 32 characters. Set it in .env before starting the app.');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  username: string;
  role: Role;
  name: string;
}

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const { payload } = await jwtVerify(token, getSessionSecret(), {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });

  if (
    typeof payload.userId !== 'string' ||
    typeof payload.username !== 'string' ||
    typeof payload.name !== 'string' ||
    (payload.role !== 'ADMIN' && payload.role !== 'TEACHER' && payload.role !== 'STUDENT')
  ) {
    return null;
  }

  return {
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
    name: payload.name,
  };
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Verifies the signed cookie and re-checks the account in the database on every
 * request. A disabled or role-changed account cannot keep using an old token.
 */
export async function getSessionUser(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, name: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE' || user.role !== payload.role) {
      return null;
    }

    return {
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role as Role,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('SESSION_SECRET')) {
      throw err;
    }
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionPayload> {
  const session = await getSessionUser();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

export async function requireRole(allowedRoles: Role[]): Promise<SessionPayload> {
  const session = await requireSessionUser();
  if (!allowedRoles.includes(session.role)) {
    throw new Error('FORBIDDEN');
  }
  return session;
}
