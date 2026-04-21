import { NextResponse } from 'next/server';
import { restoreSessionFromToken } from '@/lib/auth';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  const body = (await request.json().catch(() => ({}))) as { token?: string; remember?: boolean };
  const token = bearer || body.token?.trim() || '';

  if (!token) return NextResponse.json({ message: 'Token de session manquant.' }, { status: 400 });

  try {
    const refreshedToken = await restoreSessionFromToken(token, Boolean(body.remember ?? true));
    return NextResponse.json({ ok: true, sessionToken: refreshedToken });
  } catch {
    return NextResponse.json({ message: 'Session invalide ou expirée.' }, { status: 401 });
  }
}
