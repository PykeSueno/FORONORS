import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

const CATEGORIES = ['Achat stock', 'Matériel', 'Véhicule', 'Braquage', 'Drogue', 'Jobs', 'Autre'];

type Body = {
  member_id?: string;
  label?: string;
  amount?: number;
  category?: string;
  note?: string | null;
  proof_url?: string | null;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canCreate = await hasUserPermission(session.userId, 'expenses.create');
  if (!canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = await request.json() as Body;
  const memberId = String(body.member_id ?? '');
  const label = String(body.label ?? '').trim();
  const amount = Math.round(Number(body.amount ?? 0) * 100) / 100;
  const category = CATEGORIES.includes(String(body.category ?? '')) ? String(body.category) : 'Autre';
  const note = String(body.note ?? '').trim() || null;
  const proofUrl = String(body.proof_url ?? '').trim() || null;

  if (!memberId) return NextResponse.json({ message: 'Membre requis.' }, { status: 400 });
  if (!label) return NextResponse.json({ message: 'Libellé requis.' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ message: 'Montant invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: member } = await supabase.from('users').select('id, name, username, is_active').eq('id', memberId).maybeSingle();
  if (!member || !member.is_active) return NextResponse.json({ message: 'Membre inactif ou introuvable.' }, { status: 400 });

  const memberName = member.name || member.username || 'Membre';
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      member_id: member.id,
      member_name: memberName,
      label,
      amount,
      category,
      note,
      proof_url: proofUrl,
      status: 'pending',
      created_by: session.userId
    })
    .select('*')
    .maybeSingle();

  if (error || !expense) return NextResponse.json({ message: 'Création dépense impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'expense_created',
    entityType: 'expense',
    entityId: expense.id,
    summary: `Dépense créée pour ${memberName} — ${label} — ${amount}$`,
    oldValues: { status: null },
    newValues: { status: 'pending', memberId: member.id, memberName, label, amount, category, note, proofUrl }
  });

  return NextResponse.json({ expense });
}
