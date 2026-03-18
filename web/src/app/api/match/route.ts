import { NextResponse } from 'next/server';
import { getMatchData } from '@/lib/storage';
import { getPlayers } from '@/lib/players';

export const dynamic = 'force-dynamic';

export async function GET() {
  const matchData = await getMatchData();
  const players = await getPlayers();
  return NextResponse.json({ matchData, players });
}
