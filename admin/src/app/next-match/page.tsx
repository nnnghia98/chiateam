'use client';

import { useState, useEffect, useCallback } from 'react';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  RefreshCw,
  Save,
  Trash2,
  Plus,
  X,
  Users,
  Vote,
  AlertTriangle,
  RotateCcw,
  Pencil,
  Check,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BotPlayer {
  key: string;
  name: string;
  userId?: number;
}

interface ActiveVote {
  id: string;
  question: string;
  options: string[];
  createdBy: string;
  createdAt: string;
  totalVoters: number;
  votes: Record<string, { id: number; name: string; options: number[] }>;
}

type TeamKey = 'bench' | 'teamA' | 'teamB' | 'team3A' | 'team3B' | 'team3C';

interface BotStorage {
  bench: BotPlayer[];
  teamA: BotPlayer[];
  teamB: BotPlayer[];
  team3A: BotPlayer[];
  team3B: BotPlayer[];
  team3C: BotPlayer[];
  tiensan: number;
  tiennuoc: number;
  teamThua: string | null;
  activeVote: ActiveVote | null;
  lastUpdated: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rawToPlayers(entries: [any, any][]): BotPlayer[] {
  if (!Array.isArray(entries)) return [];
  return entries.map(([key, value]) => ({
    key: String(key),
    name: typeof value === 'string' ? value : (value?.name ?? String(key)),
    userId: typeof value === 'object' ? value?.userId : undefined,
  }));
}

function playersToRaw(players: BotPlayer[]): [any, any][] {
  return players.map(p => {
    const numKey = Number(p.key);
    const rawKey = !isNaN(numKey) && String(numKey) === p.key ? numKey : p.key;
    const rawValue =
      p.userId != null ? { name: p.name, userId: p.userId } : { name: p.name };
    return [rawKey, rawValue];
  });
}

function rawToStorage(raw: any): BotStorage {
  return {
    bench: rawToPlayers(raw.bench ?? []),
    teamA: rawToPlayers(raw.teamA ?? []),
    teamB: rawToPlayers(raw.teamB ?? []),
    team3A: rawToPlayers(raw.team3A ?? []),
    team3B: rawToPlayers(raw.team3B ?? []),
    team3C: rawToPlayers(raw.team3C ?? []),
    tiensan: raw.tiensan ?? 0,
    tiennuoc: raw.tiennuoc ?? 0,
    teamThua: raw.teamThua ?? null,
    activeVote: raw.activeVote ?? null,
    lastUpdated: raw.lastUpdated ?? null,
  };
}

function storageToRaw(storage: BotStorage): any {
  return {
    bench: playersToRaw(storage.bench),
    teamA: playersToRaw(storage.teamA),
    teamB: playersToRaw(storage.teamB),
    team3A: playersToRaw(storage.team3A),
    team3B: playersToRaw(storage.team3B),
    team3C: playersToRaw(storage.team3C),
    tiensan: storage.tiensan,
    tiennuoc: storage.tiennuoc,
    teamThua: storage.teamThua,
    activeVote: storage.activeVote,
  };
}

const TEAM_LABELS: Record<TeamKey, string> = {
  bench: 'Bench',
  teamA: 'Team A',
  teamB: 'Team B',
  team3A: 'Team 3A',
  team3B: 'Team 3B',
  team3C: 'Team 3C',
};

// Accent color per team — used only as a thin top-border stripe
const TEAM_ACCENT: Record<TeamKey, string> = {
  bench: '#c1c1c1',
  teamA: '#ff385c',
  teamB: '#222222',
  team3A: '#ff385c',
  team3B: '#222222',
  team3C: '#f97316',
};

// ─── Player chip ─────────────────────────────────────────────────────────────

function PlayerChip({
  player,
  teamKey,
  canEdit,
  onRemove,
  onRename,
}: {
  player: BotPlayer;
  teamKey: TeamKey;
  canEdit: boolean;
  onRemove: () => void;
  onRename: (_name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(player.name);

  const { ref, isDragging } = useDraggable({
    id: `${teamKey}:${player.key}`,
    data: { player, fromTeam: teamKey },
    disabled: !canEdit || editing,
  });

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== player.name) onRename(trimmed);
    setEditing(false);
  };

  return (
    <div
      ref={ref}
      style={{
        opacity: isDragging ? 0.35 : 1,
        boxShadow: isDragging
          ? 'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 6px, rgba(0,0,0,0.1) 0px 4px 8px'
          : 'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 6px, rgba(0,0,0,0.06) 0px 3px 6px',
        transition: 'opacity 0.15s, box-shadow 0.15s',
      }}
      className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-[20px] bg-white select-none text-sm font-medium text-[#222222] ${
        canEdit && !editing ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {editing ? (
        <>
          <input
            autoFocus
            className="outline-none text-sm font-medium w-24 bg-transparent text-[#222222] placeholder:text-[#6a6a6a]"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <button
            onClick={commit}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[#ff385c] hover:bg-[#fff0f2] transition-colors"
          >
            <Check className="w-3 h-3" />
          </button>
        </>
      ) : (
        <>
          <span className="max-w-[110px] truncate">{player.name}</span>
          {canEdit && (
            <span className="inline-flex items-center gap-0.5 ml-0.5">
              <button
                onClick={() => {
                  setDraft(player.name);
                  setEditing(true);
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[#c1c1c1] hover:text-[#6a6a6a] hover:bg-[#f2f2f2] transition-colors"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={onRemove}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[#c1c1c1] hover:text-[#ff385c] hover:bg-[#fff0f2] transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ─── Team Column ─────────────────────────────────────────────────────────────

function TeamColumn({
  teamKey,
  players,
  canEdit,
  onRemove,
  onRename,
  onClear,
}: {
  teamKey: TeamKey;
  players: BotPlayer[];
  canEdit: boolean;
  onRemove: (_key: string) => void;
  onRename: (_key: string, _name: string) => void;
  onClear: () => void;
}) {
  const { ref, isDropTarget } = useDroppable({ id: teamKey });
  const accent = TEAM_ACCENT[teamKey];

  return (
    <div
      ref={ref}
      style={{
        boxShadow: isDropTarget
          ? `rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 6px, rgba(0,0,0,0.1) 0px 4px 8px, 0 0 0 2px ${accent}`
          : 'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 6px, rgba(0,0,0,0.1) 0px 4px 8px',
        transition: 'box-shadow 0.15s',
      }}
      className="flex flex-col rounded-[20px] bg-white overflow-hidden min-h-[160px]"
    >
      {/* Accent stripe */}
      <div style={{ backgroundColor: accent, height: 3 }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.32px] text-[#222222]">
            {TEAM_LABELS[teamKey]}
          </span>
          <span
            style={{
              backgroundColor: isDropTarget ? accent : '#f2f2f2',
              color: isDropTarget ? '#fff' : '#6a6a6a',
              transition: 'background-color 0.15s, color 0.15s',
            }}
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-[10px] text-[11px] font-semibold"
          >
            {players.length}
          </span>
        </div>
        {canEdit && players.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs font-medium text-[#6a6a6a] hover:text-[#ff385c] flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Players area */}
      <div className="flex flex-wrap gap-2 px-4 pb-4 min-h-[80px] content-start">
        {players.map(player => (
          <PlayerChip
            key={player.key}
            player={player}
            teamKey={teamKey}
            canEdit={canEdit}
            onRemove={() => onRemove(player.key)}
            onRename={name => onRename(player.key, name)}
          />
        ))}
        {players.length === 0 && (
          <p className="text-[13px] text-[#c1c1c1] self-center w-full text-center py-4">
            Drop players here
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NextMatchPage() {
  const { canEdit } = useAuth();
  const [storage, setStorage] = useState<BotStorage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [teamMode, setTeamMode] = useState<'2' | '3'>('2');

  // Drag state
  // (handled by @dnd-kit/react DragDropProvider)

  // Add to bench form
  const [addName, setAddName] = useState('');

  // Financial editing
  const [editingTiensan, setEditingTiensan] = useState(false);
  const [editingTiennuoc, setEditingTiennuoc] = useState(false);
  const [tiensanDraft, setTiensanDraft] = useState('');
  const [tiennuocDraft, setTiennuocDraft] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await apiClient.getBotStorage();
      const parsed = rawToStorage(raw);
      setStorage(parsed);
      setDirty(false);
      // Auto-detect 3-team mode from loaded data
      if (
        parsed.team3A.length > 0 ||
        parsed.team3B.length > 0 ||
        parsed.team3C.length > 0
      ) {
        setTeamMode('3');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to load bot storage');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Mutators ──────────────────────────────────────────────────────────────

  const mutate = useCallback((fn: (_s: BotStorage) => BotStorage) => {
    setStorage(prev => (prev ? fn(prev) : prev));
    setDirty(true);
  }, []);

  const movePlayer = (fromTeam: TeamKey, toTeam: TeamKey, key: string) => {
    if (fromTeam === toTeam) return;
    mutate(s => {
      const player = s[fromTeam].find(p => p.key === key);
      if (!player) return s;
      return {
        ...s,
        [fromTeam]: s[fromTeam].filter(p => p.key !== key),
        [toTeam]: [...s[toTeam], player],
      };
    });
  };

  const removePlayer = (teamKey: TeamKey, key: string) =>
    mutate(s => ({
      ...s,
      [teamKey]: s[teamKey].filter(p => p.key !== key),
    }));

  const renamePlayer = (teamKey: TeamKey, key: string, name: string) =>
    mutate(s => ({
      ...s,
      [teamKey]: s[teamKey].map(p => (p.key === key ? { ...p, name } : p)),
    }));

  const clearTeam = (teamKey: TeamKey) =>
    mutate(s => ({ ...s, [teamKey]: [] }));

  const addToBench = () => {
    const name = addName.trim();
    if (!name) return;
    const key = `manual_${Date.now()}`;
    mutate(s => ({
      ...s,
      bench: [...s.bench, { key, name }],
    }));
    setAddName('');
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!storage) return;
    try {
      setSaving(true);
      const raw = await apiClient.saveBotStorage(storageToRaw(storage));
      setStorage(rawToStorage(raw));
      setDirty(false);
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Sync from vote ─────────────────────────────────────────────────────────

  const syncFromVote = async () => {
    if (!confirm('Sync players from active vote to bench?')) return;
    try {
      setSyncing(true);
      const result = await apiClient.syncBotStorageFromVote();
      setStorage(rawToStorage(result.storage));
      setDirty(false);
      alert(
        `Synced!\n✅ Added (${result.addedCount}): ${result.addedNames.join(', ') || 'none'}\n⏭️ Skipped (${result.skippedCount}): ${result.skippedNames.join(', ') || 'none'}`
      );
    } catch (e: any) {
      if (e?.message?.includes('NO_ACTIVE_VOTE')) {
        alert('No active vote found.');
      } else {
        console.error(e);
        alert('Sync failed');
      }
    } finally {
      setSyncing(false);
    }
  };

  // ── Reset all ─────────────────────────────────────────────────────────────

  const resetAll = async () => {
    if (!confirm('Reset all storage to defaults? This cannot be undone.'))
      return;
    try {
      setSaving(true);
      const raw = await apiClient.resetBotStorage();
      setStorage(rawToStorage(raw));
      setDirty(false);
    } catch (e) {
      console.error(e);
      alert('Failed to reset storage');
    } finally {
      setSaving(false);
    }
  };

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    (event: any) => {
      if (event.canceled) return;
      const data = event.operation.source?.data as
        | { player: BotPlayer; fromTeam: TeamKey }
        | undefined;
      const toTeam = event.operation.target?.id as TeamKey | undefined;
      if (!data || !toTeam) return;
      movePlayer(data.fromTeam, toTeam, data.player.key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storage]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="text-center py-8 text-[#6a6a6a] text-sm">Loading...</div>
    );
  }

  if (!storage) return null;

  const teamKeys: TeamKey[] = ['bench', 'teamA', 'teamB'];
  const team3Keys: TeamKey[] = ['team3A', 'team3B', 'team3C'];

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-[#222222] tracking-tight">
              Next Match
            </h1>
            {storage.lastUpdated && (
              <p className="text-xs text-[#6a6a6a] mt-0.5">
                Last updated: {new Date(storage.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="border-[#c1c1c1] text-[#222] rounded-airbnb"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={saving || !dirty}
                className="rounded-airbnb bg-[#222222] hover:bg-[#333] text-white"
              >
                <Save className="w-4 h-4 mr-1" />
                {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </Button>
            )}
          </div>
        </div>

        {dirty && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            You have unsaved changes. Click &quot;Save changes&quot; to persist
            to storage.json.
          </div>
        )}

        {/* Financial Info */}
        <Card className="rounded-airbnb shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-[#222]">
              Financial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Tiền sân */}
              <div className="space-y-1">
                <Label className="text-xs text-[#6a6a6a]">Tiền sân (₫)</Label>
                {editingTiensan ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={tiensanDraft}
                      onChange={e => setTiensanDraft(e.target.value)}
                      className="h-8 text-sm rounded-airbnb"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          mutate(s => ({
                            ...s,
                            tiensan: Number(tiensanDraft) || s.tiensan,
                          }));
                          setEditingTiensan(false);
                        }
                        if (e.key === 'Escape') setEditingTiensan(false);
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-8 rounded-airbnb"
                      onClick={() => {
                        mutate(s => ({
                          ...s,
                          tiensan: Number(tiensanDraft) || s.tiensan,
                        }));
                        setEditingTiensan(false);
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {storage.tiensan.toLocaleString()}₫
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => {
                          setTiensanDraft(String(storage.tiensan));
                          setEditingTiensan(true);
                        }}
                        className="text-[#6a6a6a] hover:text-[#222]"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Tiền nước */}
              <div className="space-y-1">
                <Label className="text-xs text-[#6a6a6a]">Tiền nước (₫)</Label>
                {editingTiennuoc ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={tiennuocDraft}
                      onChange={e => setTiennuocDraft(e.target.value)}
                      className="h-8 text-sm rounded-airbnb"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          mutate(s => ({
                            ...s,
                            tiennuoc: Number(tiennuocDraft) || s.tiennuoc,
                          }));
                          setEditingTiennuoc(false);
                        }
                        if (e.key === 'Escape') setEditingTiennuoc(false);
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-8 rounded-airbnb"
                      onClick={() => {
                        mutate(s => ({
                          ...s,
                          tiennuoc: Number(tiennuocDraft) || s.tiennuoc,
                        }));
                        setEditingTiennuoc(false);
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {storage.tiennuoc.toLocaleString()}₫
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => {
                          setTiennuocDraft(String(storage.tiennuoc));
                          setEditingTiennuoc(true);
                        }}
                        className="text-[#6a6a6a] hover:text-[#222]"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Team thua */}
              <div className="space-y-1">
                <Label className="text-xs text-[#6a6a6a]">Team Thua</Label>
                <span className="text-sm font-medium">
                  {storage.teamThua ?? (
                    <span className="text-[#aaa] italic">None</span>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Vote */}
        <Card className="rounded-airbnb shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-[#222] flex items-center gap-2">
                <Vote className="w-4 h-4 text-[#ff385c]" />
                Active Vote
              </CardTitle>
              {canEdit && storage.activeVote && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={syncing}
                  onClick={() => void syncFromVote()}
                  className="border-[#c1c1c1] rounded-airbnb text-sm"
                >
                  <Users className="w-4 h-4 mr-1" />
                  {syncing ? 'Syncing…' : 'Sync to bench'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {storage.activeVote ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-[#6a6a6a]">Question:</span>{' '}
                  <span className="font-medium">
                    {storage.activeVote.question}
                  </span>
                </p>
                <p>
                  <span className="text-[#6a6a6a]">Created by:</span>{' '}
                  {storage.activeVote.createdBy}
                </p>
                <p>
                  <span className="text-[#6a6a6a]">Total voters:</span>{' '}
                  {storage.activeVote.totalVoters}
                </p>
                {/* Vote breakdown */}
                <div className="mt-2">
                  <p className="text-xs font-semibold text-[#444] mb-1 uppercase tracking-wide">
                    Votes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(storage.activeVote.options ?? []).map((option, idx) => {
                      const voterNames = Object.values(
                        storage.activeVote!.votes
                      )
                        .filter(v => v.options.includes(idx))
                        .map(v => v.name);
                      return (
                        <div
                          key={idx}
                          className="bg-[#f7f7f7] border border-[#e0e0e0] rounded-lg px-3 py-1.5 min-w-[70px]"
                        >
                          <p className="text-xs font-bold text-[#222]">
                            {option}
                          </p>
                          <p className="text-[10px] text-[#888]">
                            {voterNames.length > 0
                              ? voterNames.join(', ')
                              : 'none'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 border-[#c1c1c1] text-[#6a6a6a] hover:text-[#ff385c] rounded-airbnb text-xs"
                    onClick={() => mutate(s => ({ ...s, activeVote: null }))}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear vote
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#aaa] italic">No active vote</p>
            )}
          </CardContent>
        </Card>

        {/* Teams */}
        <Card className="rounded-airbnb shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base font-semibold text-[#222]">
                  Players & Teams
                </CardTitle>
                {/* Mode toggle */}
                <div
                  className="inline-flex rounded-[20px] p-0.5"
                  style={{
                    boxShadow:
                      'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 6px, rgba(0,0,0,0.06) 0px 3px 6px',
                  }}
                >
                  <button
                    onClick={() => setTeamMode('2')}
                    className="px-3 py-1 rounded-[18px] text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor:
                        teamMode === '2' ? '#222222' : 'transparent',
                      color: teamMode === '2' ? '#ffffff' : '#6a6a6a',
                    }}
                  >
                    2 Teams
                  </button>
                  <button
                    onClick={() => setTeamMode('3')}
                    className="px-3 py-1 rounded-[18px] text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor:
                        teamMode === '3' ? '#222222' : 'transparent',
                      color: teamMode === '3' ? '#ffffff' : '#6a6a6a',
                    }}
                  >
                    3 Teams
                  </button>
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Player name"
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') addToBench();
                    }}
                    className="h-8 text-sm w-36 rounded-airbnb"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addToBench}
                    className="h-8 border-[#c1c1c1] rounded-airbnb"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add to bench
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamMode === '2' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {teamKeys.map(teamKey => (
                  <TeamColumn
                    key={teamKey}
                    teamKey={teamKey}
                    players={storage[teamKey]}
                    canEdit={canEdit}
                    onRemove={key => removePlayer(teamKey, key)}
                    onRename={(key, name) => renamePlayer(teamKey, key, name)}
                    onClear={() => clearTeam(teamKey)}
                  />
                ))}
              </div>
            ) : (
              <>
                {/* Bench row */}
                <TeamColumn
                  teamKey="bench"
                  players={storage.bench}
                  canEdit={canEdit}
                  onRemove={key => removePlayer('bench', key)}
                  onRename={(key, name) => renamePlayer('bench', key, name)}
                  onClear={() => clearTeam('bench')}
                />
                {/* 3 teams grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {team3Keys.map(teamKey => (
                    <TeamColumn
                      key={teamKey}
                      teamKey={teamKey}
                      players={storage[teamKey]}
                      canEdit={canEdit}
                      onRemove={key => removePlayer(teamKey, key)}
                      onRename={(key, name) => renamePlayer(teamKey, key, name)}
                      onClear={() => clearTeam(teamKey)}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        {canEdit && (
          <Card className="rounded-airbnb shadow-sm border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50 rounded-airbnb"
                  onClick={() => resetAll()}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reset all storage
                </Button>
              </div>
              <p className="text-xs text-[#888] mt-2">
                &quot;Reset all storage&quot; clears all teams, bench, and vote
                data back to defaults.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DragDropProvider>
  );
}
