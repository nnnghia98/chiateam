export interface LeaderboardEntry {
  player: {
    id: number;
    name: string;
    number: number;
    username: string | null;
  };
  stats: {
    total_match: number;
    total_win: number;
    total_lose: number;
    total_draw: number;
    goal: number;
    assist: number;
    winrate: number;
  };
}

export interface UpdateLeaderboardData {
  goal?: number;
  assist?: number;
  total_match?: number;
  total_win?: number;
  total_lose?: number;
  total_draw?: number;
}
