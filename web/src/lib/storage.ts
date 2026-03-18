import { MatchData } from '@/types/match';
import { supabase } from '@/lib/supabase';

export async function getMatchData(): Promise<MatchData | null> {
  const { data, error } = await supabase
    .from('match_data')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    teams: data.teams || [],
    venue: data.venue || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    rawMessage: data.raw_message,
  };
}

export async function saveMatchData(matchData: MatchData): Promise<void> {
  const { error } = await supabase
    .from('match_data')
    .upsert({
      id: matchData.id,
      teams: matchData.teams,
      venue: matchData.venue,
      created_at: matchData.createdAt,
      updated_at: matchData.updatedAt,
      raw_message: matchData.rawMessage || null,
    }, { onConflict: 'id' });

  if (error) {
    console.error('Failed to save match data:', error);
  }
}

export async function deleteMatchData(): Promise<void> {
  const { error } = await supabase
    .from('match_data')
    .delete()
    .neq('id', ''); // Delete all rows

  if (error) {
    console.error('Failed to delete match data:', error);
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
