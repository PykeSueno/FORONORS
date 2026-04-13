import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
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

function toSession(payload: SessionPayload) {
  return {
    userId: payload.sub,
    username: payload.username,
    role: payload.role ?? ''
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: Pick<AppUser, 'id' | 'username' | 'role'>, remember = false) {
  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    role: user.role ?? ''
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(remember ? '30d' : '7d')
    .sign(getSecret());
}

export async function createSessionCookie(user: Pick<AppUser, 'id' | 'username' | 'role'>, remember = false) {
  const token = await new SignJWT({
    sub: user.id,
    username: user.username,
    role: user.role ?? ''
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(remember ? '30d' : '7d')
    .sign(getSecret());

  const cookieStore = await cookies();
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge
  });

  return token;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession() {
  const headerStore = await headers();
  const authorization = headerStore.get('authorization');
  const fivemToken = headerStore.get('x-fivem-session');

  let token = '';
  if (authorization?.startsWith('Bearer ')) {
    token = authorization.slice('Bearer '.length).trim();
  } else if (fivemToken) {
    token = fivemToken.trim();
  }

  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get(COOKIE_NAME)?.value ?? '';
  }

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return toSession(payload as SessionPayload);
  } catch {
    return null;
  }
}
