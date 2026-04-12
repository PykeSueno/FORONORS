import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { AppUser } from './supabase';
import { getEnv } from './env';

const COOKIE_NAME = 'foronors_session';

type SessionPayload = {
  sub: string;
  username: string;
  role: string;
};

function getSecret() {
  return new TextEncoder().encode(getEnv('SESSION_SECRET'));
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionCookie(user: Pick<AppUser, 'id' | 'username' | 'role'>) {
  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    role: user.role ?? ''
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());

    return {
      userId: payload.sub as string,
      username: payload.username as string,
      role: (payload.role as string) ?? ''
    };
  } catch {
    return null;
  }
}
