'use client';

import { useEffect, useState, useCallback } from 'react';
import { MatchData, Team } from '@/types/match';
import { PlayerConfig } from '@/types/player';

/* =============================================
   UTILITY FUNCTIONS
   ============================================= */

function getTeamColor(name: string): 'home' | 'away' | 'extra' {
  const n = name.toUpperCase();
  if (n.includes('HOME')) return 'home';
  if (n.includes('AWAY')) return 'away';
  return 'extra';
}

function getTeamBorderClass(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('HOME')) return 'team-card-home';
  if (n.includes('AWAY')) return 'team-card-away';
  return 'team-card-extra';
}

function getTeamTooltip(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('HOME')) return 'Trắng';
  if (n.includes('AWAY')) return 'Đen';
  return 'Cam';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const updated = new Date(isoString);
  const diffMs = now.getTime() - updated.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  return `${diffDay} ngày trước`;
}

function findMatchingPlayer(playerName: string, telegramHandle: string | undefined, playerConfigs: PlayerConfig[]): PlayerConfig | null {
  // Priority 1: match by telegramHandle
  if (telegramHandle) {
    const normalizedHandle = telegramHandle.trim().toLowerCase().replace(/^@/, '');
    for (const config of playerConfigs) {
      if (config.telegramHandle) {
        const configHandle = config.telegramHandle.trim().toLowerCase().replace(/^@/, '');
        if (configHandle === normalizedHandle) return config;
      }
    }
  }

  // Priority 2: match by subNames
  const normalized = playerName.trim().toLowerCase();
  for (const config of playerConfigs) {
    for (const sub of config.subNames) {
      if (sub.trim().toLowerCase() === normalized) return config;
    }
  }
  return null;
}

/* =============================================
   JERSEY ICONS
   ============================================= */

const JERSEY_COLORS = {
  home:  { fill: '#ffffff', stroke: '#43a047', text: '#2e7d32', collar: '#43a047' },
  away:  { fill: '#263238', stroke: '#455a64', text: '#ffffff', collar: '#37474f' },
  extra: { fill: '#ef6c00', stroke: '#e65100', text: '#ffffff', collar: '#bf360c' },
};

/** Small jersey icon for team headers (no text) */
function SmallJerseyIcon({ team }: { team: 'home' | 'away' | 'extra' }) {
  const c = JERSEY_COLORS[team];
  return (
    <svg viewBox="0 0 48 48" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 12L8 16V22L10 23V40C10 41.1 10.9 42 12 42H36C37.1 42 38 41.1 38 40V23L40 22V16L34 12H14Z"
        fill={c.fill} stroke={c.stroke} strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 12L8 16V22L10 23V18L14 15V12Z"
        fill={c.fill} stroke={c.stroke} strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />
      <path d="M34 12L40 16V22L38 23V18L34 15V12Z"
        fill={c.fill} stroke={c.stroke} strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />
      <path d="M18 12C18 12 20 14 24 14C28 14 30 12 30 12"
        stroke={c.collar} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Player jersey icon with label (number or initials) */
function JerseyIcon({ label, team }: { label: string; team: 'home' | 'away' | 'extra' }) {
  const c = JERSEY_COLORS[team];
  return (
    <div className="jersey-container">
      <svg viewBox="0 0 48 48" width="42" height="42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 12L8 16V22L10 23V40C10 41.1 10.9 42 12 42H36C37.1 42 38 41.1 38 40V23L40 22V16L34 12H14Z"
          fill={c.fill} stroke={c.stroke} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M14 12L8 16V22L10 23V18L14 15V12Z"
          fill={c.fill} stroke={c.stroke} strokeWidth="1" strokeLinejoin="round" opacity="0.85" />
        <path d="M34 12L40 16V22L38 23V18L34 15V12Z"
          fill={c.fill} stroke={c.stroke} strokeWidth="1" strokeLinejoin="round" opacity="0.85" />
        <path d="M18 12C18 12 20 14 24 14C28 14 30 12 30 12"
          stroke={c.collar} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M21 12L24 16L27 12"
          stroke={c.collar} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="jersey-initial" style={{ color: c.text }}>{label}</span>
    </div>
  );
}

/* =============================================
   TEAM CARD
   ============================================= */

function TeamCard({ team, index, playerConfigs }: { team: Team; index: number; playerConfigs: PlayerConfig[] }) {
  const color = getTeamColor(team.name);
  const borderClass = getTeamBorderClass(team.name);
  const tooltip = getTeamTooltip(team.name);

  return (
    <div className={`glass-card ${borderClass}`} style={{ animationDelay: `${index * 0.08}s` }}>
      <div className="team-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SmallJerseyIcon team={color} />
          <h2 className={`team-name ${color}-name`}>{team.name}</h2>
          <span style={{
            fontSize: '11px',
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: '6px',
            background: color === 'home' ? 'rgba(46,125,50,0.08)' : color === 'away' ? 'rgba(55,71,79,0.08)' : 'rgba(239,108,0,0.08)',
            color: color === 'home' ? '#2e7d32' : color === 'away' ? '#37474f' : '#ef6c00',
          }}>
            Áo {tooltip}
          </span>
        </div>
        <div className={`team-count ${color}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {team.players.length}
        </div>
      </div>

      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {team.players.map((player, i) => {
          const matched = findMatchingPlayer(player.name, player.telegramHandle, playerConfigs);
          const jerseyLabel = matched ? String(matched.jerseyNumber) : getInitials(player.name);

          return (
            <div key={i} className="player-item" style={{ animationDelay: `${(index * 0.08) + (i * 0.04)}s` }}>
              <div className="player-number">{i + 1}</div>
              <JerseyIcon label={jerseyLabel} team={color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--text-primary)',
                }}>
                  {player.name}
                </div>
                {player.telegramHandle && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {player.telegramHandle}
                  </div>
                )}
              </div>
              {/* {matched && (
                <div style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  background: 'rgba(46,125,50,0.06)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}>
                  {matched.name}
                </div>
              )} */}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =============================================
   MATCH INFO
   ============================================= */

function MatchInfoSection({ matchData }: { matchData: MatchData }) {
  const { venue } = matchData;
  if (!venue.date && !venue.time && !venue.venue) return null;

  return (
    <div className="match-info-bar" style={{ marginBottom: '24px' }}>
      <div className="match-info-label">
        ⚽ Thông tin trận đấu
      </div>
      <div className="match-info-chips">
        {venue.date && (
          <div className="info-chip">
            <span className="label">Ngày</span>
            <span className="value">{venue.date}</span>
          </div>
        )}
        {venue.time && (
          <div className="info-chip">
            <span className="label">Giờ</span>
            <span className="value">{venue.time}</span>
          </div>
        )}
        {venue.venue && (
          <div className="info-chip">
            <span className="label">Sân</span>
            <span className="value">
              {venue.googleMapLink ? (
                <a href={venue.googleMapLink} target="_blank" rel="noopener noreferrer" className="venue-link">
                  {venue.venue} ↗
                </a>
              ) : venue.venue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================
   EMPTY STATE
   ============================================= */

function EmptyState() {
  return (
    <div className="empty-state">
      <span className="empty-icon">⚽</span>
      <h2>Chưa có dữ liệu trận đấu</h2>
      <p>
        Đăng ký với Captain để được thêm vào trận đấu sắp tới nhé
      </p>
    </div>
  );
}

/* =============================================
   MAIN PAGE
   ============================================= */

export default function Home() {
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/match', { cache: 'no-store' });
      const data = await res.json();
      setMatchData(data.matchData);
      setPlayerConfigs(data.players || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch:', err);
      setError('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPlayers = matchData?.teams?.reduce((sum, t) => sum + t.players.length, 0) || 0;
  const teamCount = matchData?.teams?.length || 0;

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
      {/* Header */}
      <header className="field-header">
        <div className="field-corner-tl" />
        <div className="field-corner-tr" />
        <div className="field-corner-bl" />
        <div className="field-corner-br" />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
            <span style={{ fontSize: '36px' }} className="float-anim">⚽</span>
            <h1 style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '2px', color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              FOOTBALL LINEUP
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Đội hình thi đấu
          </p>
        </div>

        {matchData?.updatedAt && (
          <div className="update-ticker" style={{ justifyContent: 'center', marginTop: '12px', color: 'rgba(255,255,255,0.55)', position: 'relative', zIndex: 1 }}>
            <div className="live-dot" />
            <span>Cập nhật {formatRelativeTime(matchData.updatedAt)}</span>
          </div>
        )}
      </header>

      {/* Main */}
      <main style={{ padding: '0 24px 60px', maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <div className="skeleton" style={{ height: '72px', marginBottom: '24px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '280px' }} />)}
            </div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <span className="empty-icon">❌</span>
            <h2>{error}</h2>
          </div>
        ) : !matchData || !matchData.teams || matchData.teams.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <MatchInfoSection matchData={matchData} />

            {/* Stats */}
            <div className="stat-bar" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
              <div className="stat-box">
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-green)' }}>{totalPlayers}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                  Tổng cầu thủ
                </div>
              </div>
              <div className="stat-box">
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-green-dark)' }}>{teamCount}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                  Số đội
                </div>
              </div>
            </div>

            {/* Teams Grid */}
            <div className="teams-grid" style={{
              display: 'grid',
              gridTemplateColumns: teamCount === 2 ? '1fr auto 1fr' : `repeat(${teamCount}, 1fr)`,
              gap: teamCount === 2 ? '0' : '16px',
              alignItems: 'start',
            }}>
              {matchData.teams.map((team, i) =>
                teamCount === 2 ? (
                  <div key={team.name} style={{ display: 'contents' }}>
                    <TeamCard team={team} index={i} playerConfigs={playerConfigs} />
                    {i === 0 && (
                      <div className="vs-badge-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', alignSelf: 'center' }}>
                        <div className="vs-badge">VS</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <TeamCard key={team.name} team={team} index={i} playerConfigs={playerConfigs} />
                )
              )}
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        Powered by Chấm Hết FC
      </footer>
    </div>
  );
}
