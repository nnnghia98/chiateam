export interface Match {
  id: number;
  match_date: string;
  san: string | null;
  tiensan: number | null;
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchPlayer {
  id: number;
  match_id: number;
  player_id: number | null;
  side: 'home' | 'away' | 'extra';
  display_name: string | null;
  player?: {
    name: string;
    number: number;
  };
}

export interface MatchPlayerStats {
  id: number;
  match_id: number;
  player_id: number;
  goals: number;
  assists: number;
  is_mvp: number;
}

export interface CreateMatchData {
  match_date: string;
  san?: string;
  tiensan?: number;
  home_score?: number;
  away_score?: number;
  notes?: string;
}

export interface UpdateMatchData {
  san?: string;
  tiensan?: number;
  home_score?: number;
  away_score?: number;
  notes?: string;
}
