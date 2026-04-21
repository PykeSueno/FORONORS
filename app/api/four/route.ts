import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canAccess = await hasUserPermission(session.userId, 'four.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  return NextResponse.json({ mode: 'direct', message: 'FOUR direct actif: transactions immédiates, pas de session.' });
}
