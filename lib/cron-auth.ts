import { NextResponse } from 'next/server';

export function getCronAuthError(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ message: 'CRON_SECRET non configure.' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization') ?? '';
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Acces refuse.' }, { status: 403 });
  }

  return null;
}
