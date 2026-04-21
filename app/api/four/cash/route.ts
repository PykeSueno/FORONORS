import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: 'FOUR direct: ajout cash manuel supprimé.' }, { status: 410 });
}
