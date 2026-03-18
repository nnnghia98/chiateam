import { NextResponse } from 'next/server';
import { getMatchData, saveMatchData, generateId } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// GET venue info
export async function GET() {
  const matchData = await getMatchData();
  return NextResponse.json(matchData?.venue || {});
}

// PUT - update venue info
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { date, time, venue, googleMapLink } = body;

    let matchData = await getMatchData();
    const now = new Date().toISOString();

    if (!matchData) {
      matchData = {
        id: generateId(),
        teams: [],
        venue: {},
        createdAt: now,
        updatedAt: now,
      };
    }

    matchData.venue = {
      date: date || '',
      time: time || '',
      venue: venue || '',
      googleMapLink: googleMapLink || '',
    };
    matchData.updatedAt = now;
    await saveMatchData(matchData);

    return NextResponse.json({ ok: true, venue: matchData.venue });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
