export interface Player {
  name: string;
  telegramHandle?: string; // e.g. @testuser99
}

export interface Team {
  name: string; // HOME, AWAY, EXTRA
  players: Player[];
}

export interface MatchVenue {
  date?: string;       // e.g. "12/3"
  time?: string;       // e.g. "19h15"
  venue?: string;      // e.g. "Sân số 8"
  googleMapLink?: string;
}

export interface MatchData {
  id: string;
  teams: Team[];
  venue: MatchVenue;
  createdAt: string;
  updatedAt: string;
  rawMessage?: string;
}
