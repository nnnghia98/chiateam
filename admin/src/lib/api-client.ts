const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const userRole =
      typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (userRole) {
      headers['X-User-Role'] = userRole;
    }

    return headers;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Players
  async getPlayers() {
    return this.fetch<any[]>('/api/players');
  }

  async getPlayer(number: number) {
    return this.fetch<any>(`/api/players/${number}`);
  }

  async createPlayer(data: any) {
    return this.fetch<any>('/api/players', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePlayer(number: number, data: any) {
    return this.fetch<any>(`/api/players/${number}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePlayer(number: number) {
    return this.fetch<void>(`/api/players/${number}`, {
      method: 'DELETE',
    });
  }

  // Matches
  async getMatches() {
    return this.fetch<any[]>('/api/matches');
  }

  async getMatch(date: string) {
    return this.fetch<any>(`/api/matches/${date}`);
  }

  async createMatch(data: any) {
    return this.fetch<any>('/api/matches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMatch(date: string, data: any) {
    return this.fetch<any>(`/api/matches/${date}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMatch(date: string) {
    return this.fetch<void>(`/api/matches/${date}`, {
      method: 'DELETE',
    });
  }

  // Leaderboard
  async getLeaderboard() {
    return this.fetch<any[]>('/api/player-summaries');
  }

  async updateLeaderboardEntry(playerNumber: number, data: any) {
    return this.fetch<any>(`/api/leaderboard/${playerNumber}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient(API_URL);
