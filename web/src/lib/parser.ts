import { Player, Team, MatchVenue } from '@/types/match';

/**
 * Parse a player line like "Bravo" or "Test User (@testuser99)" 
 */
function parsePlayerLine(line: string): Player | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('👤') || trimmed.startsWith('🎲')) return null;

  // Match name with optional telegram handle: "Name (@handle)"
  const handleMatch = trimmed.match(/^(.+?)\s*\((@\w+)\)\s*$/);
  if (handleMatch) {
    return {
      name: handleMatch[1].trim(),
      telegramHandle: handleMatch[2],
    };
  }

  return { name: trimmed };
}

/**
 * Parse team lineup message from Telegram
 * Supports /Team and /San commands
 */
export function parseTeamMessage(text: string): Team[] {
  const teams: Team[] = [];
  let currentTeamName: string | null = null;
  let currentPlayers: Player[] = [];

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect team header: "👤 HOME:", "👤 AWAY:", "👤 EXTRA:"
    const teamMatch = trimmed.match(/👤\s*(.+?):\s*$/);
    if (teamMatch) {
      // Save previous team if exists
      if (currentTeamName) {
        teams.push({ name: currentTeamName, players: currentPlayers });
      }
      currentTeamName = teamMatch[1].trim();
      currentPlayers = [];
      continue;
    }

    // Skip empty lines and header lines
    if (!trimmed || trimmed.startsWith('🎲') || trimmed.startsWith('/')) continue;

    // Parse player
    if (currentTeamName) {
      const player = parsePlayerLine(trimmed);
      if (player) {
        currentPlayers.push(player);
      }
    }
  }

  // Save last team
  if (currentTeamName) {
    teams.push({ name: currentTeamName, players: currentPlayers });
  }

  return teams;
}

/**
 * Parse venue info from /San command
 * Format: /San 12/3 - 19h15 - Sân số 8 - link googlemap(optional)
 */
export function parseVenueMessage(text: string): MatchVenue {
  const venue: MatchVenue = {};

  // Remove /San prefix
  let content = text.replace(/^\/San\s*/i, '').trim();
  
  // If this is a team lineup (contains 👤), don't parse as venue
  if (content.includes('👤')) return venue;

  // Split by " - "
  const parts = content.split(/\s*-\s*/);

  if (parts.length >= 1) {
    // First part: date (e.g. "12/3")
    const dateMatch = parts[0].match(/(\d{1,2}\/\d{1,2})/);
    if (dateMatch) {
      venue.date = dateMatch[1];
    }
  }

  if (parts.length >= 2) {
    // Second part: time (e.g. "19h15" or "19:15")
    const timeMatch = parts[1].match(/(\d{1,2}[h:]\d{0,2})/i);
    if (timeMatch) {
      venue.time = timeMatch[1];
    }
  }

  if (parts.length >= 3) {
    // Remaining parts: venue name and optional google map link
    const remainingParts = parts.slice(2);
    const remaining = remainingParts.join(' - ');

    // Check for Google Maps link
    const urlMatch = remaining.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      venue.googleMapLink = urlMatch[1];
      venue.venue = remaining.replace(urlMatch[1], '').replace(/\s*-\s*$/, '').trim();
    } else {
      venue.venue = remaining.trim();
    }
  }

  return venue;
}
