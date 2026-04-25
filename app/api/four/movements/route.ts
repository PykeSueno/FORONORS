import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'FOUR direct: endpoint movements supprimé.' }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ message: 'FOUR direct: endpoint movements supprimé.' }, { status: 410 });
}

export async function PATCH() {
  return NextResponse.json({ message: 'FOUR direct: endpoint movements supprimé.' }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ message: 'FOUR direct: endpoint movements supprimé.' }, { status: 410 });
}
