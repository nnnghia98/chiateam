export interface Player {
  id: number;
  user_id: number;
  number: number;
  name: string;
  username: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePlayerData {
  name: string;
  number: number;
  username?: string;
}

export interface UpdatePlayerData {
  name?: string;
  number?: number;
  username?: string;
}
