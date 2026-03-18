import { NextResponse } from 'next/server';
import { getMatchData, saveMatchData, generateId, deleteMatchData } from '@/lib/storage';
import { parseTeamMessage, parseVenueMessage } from '@/lib/parser';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text: string = body.text || body.message;

    if (!text) {
      return NextResponse.json({ error: 'Missing "text" field' }, { status: 400 });
    }

    // Get or create match data
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

    let result = '';

    // Handle /Team or /San with team lineup
    if (text.startsWith('/team') || (text.startsWith('/san') && text.includes('👤'))) {
      const teams = parseTeamMessage(text);
      if (teams.length > 0) {
        matchData.teams = teams;
        matchData.updatedAt = now;
        matchData.rawMessage = text;
        await saveMatchData(matchData);
        result = `Updated ${teams.length} teams with ${teams.reduce((s, t) => s + t.players.length, 0)} players`;
      } else {
        result = 'No teams parsed';
      }
    }
    // Handle /San with venue info
    else if (text.startsWith('/san')) {
      const venue = parseVenueMessage(text);
      matchData.venue = { ...matchData.venue, ...venue };
      matchData.updatedAt = now;
      await saveMatchData(matchData);
      result = `Updated venue: ${JSON.stringify(venue)}`;
    }
    // Handle /reset
    else if (text.toLowerCase().startsWith('/reset')) {
      await deleteMatchData();
      return NextResponse.json({ ok: true, result: 'All data deleted', matchData: null });
    }

    return NextResponse.json({ ok: true, result, matchData });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
