const BASE_URL =
  process.env.NEXT_PUBLIC_UI_API_BASE_URL || "http://localhost:8787";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export type StatusResponse = {
  startedAt: string;
  online: boolean;
  botInitialized?: boolean;
  settings?: {
    maintenanceMode: boolean;
    debugLogging: boolean;
    environment: string;
  };
};

export type Settings = {
  maintenanceMode: boolean;
  debugLogging: boolean;
  environment: string;
  botCommandPrefix: string;
  allowedChatIds: string[];
};

export type Player = {
  id: number;
  user_id: number;
  number: number;
  name: string;
  username: string | null;
  created_at: string;
  updated_at: string;
};

export type PlayerStats = {
  total_match: number;
  total_win: number;
  total_lose: number;
  total_draw: number;
  goal: number;
  assist: number;
  winrate: number;
};

export type PlayerSummary = {
  player: Player;
  stats: PlayerStats;
};

export type MatchPlayer = {
  playerId: number | null;
  displayName: string | null;
  name: string | null;
  number: number | null;
  label: string;
  goals?: number;
  assists?: number;
  isMvp?: boolean;
};

export type Match = {
  id: number;
  match_date: string;
  san: string | null;
  tiensan: number | null;
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  homePlayers: MatchPlayer[];
  awayPlayers: MatchPlayer[];
};

export async function fetchStatus(): Promise<StatusResponse> {
  return getJson<StatusResponse>("/api/status");
}

export async function fetchPlayers(): Promise<Player[]> {
  return getJson<Player[]>("/api/players");
}

export async function fetchPlayerSummaries(): Promise<PlayerSummary[]> {
  return getJson<PlayerSummary[]>("/api/player-summaries");
}

export async function fetchSettings(): Promise<Settings> {
  return getJson<Settings>("/api/settings");
}

export async function updateSettings(
  payload: Partial<Pick<Settings, "maintenanceMode" | "debugLogging" | "botCommandPrefix" | "allowedChatIds">>,
): Promise<Settings> {
  const res = await fetch(`${BASE_URL}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Settings;
}

export async function fetchMatches(limit = 20, offset = 0): Promise<Match[]> {
  return getJson<Match[]>(`/api/matches?limit=${limit}&offset=${offset}`);
}

export async function fetchMatchByDate(date: string): Promise<Match | null> {
  try {
    return await getJson<Match>(`/api/matches/${date}`);
  } catch (error) {
    return null;
  }
}

