'use client';

import { useState, useEffect } from 'react';
import { LeaderboardEntry } from '@/types/leaderboard';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, X, Trophy } from 'lucide-react';

export default function LeaderboardPage() {
  const { canEdit } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<LeaderboardEntry | null>(
    null
  );
  const [formData, setFormData] = useState({
    goal: '',
    assist: '',
    total_match: '',
    total_win: '',
    total_lose: '',
    total_draw: '',
  });

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getLeaderboard();
      setLeaderboard(data.sort((a, b) => b.stats.winrate - a.stats.winrate));
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      alert('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    try {
      await apiClient.updateLeaderboardEntry(editingEntry.player?.number, {
        goal: formData.goal ? parseInt(formData.goal) : undefined,
        assist: formData.assist ? parseInt(formData.assist) : undefined,
        total_match: formData.total_match
          ? parseInt(formData.total_match)
          : undefined,
        total_win: formData.total_win
          ? parseInt(formData.total_win)
          : undefined,
        total_lose: formData.total_lose
          ? parseInt(formData.total_lose)
          : undefined,
        total_draw: formData.total_draw
          ? parseInt(formData.total_draw)
          : undefined,
      });
      cancelEdit();
      loadLeaderboard();
    } catch (error) {
      console.error('Failed to update leaderboard entry:', error);
      alert('Failed to update leaderboard entry');
    }
  };

  const startEdit = (entry: LeaderboardEntry) => {
    setEditingEntry(entry);
    setFormData({
      goal: entry.stats.goal.toString(),
      assist: entry.stats.assist.toString(),
      total_match: entry.stats.total_match.toString(),
      total_win: entry.stats.total_win.toString(),
      total_lose: entry.stats.total_lose.toString(),
      total_draw: entry.stats.total_draw.toString(),
    });
  };

  const cancelEdit = () => {
    setEditingEntry(null);
    setFormData({
      goal: '',
      assist: '',
      total_match: '',
      total_win: '',
      total_lose: '',
      total_draw: '',
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-[#6a6a6a] text-sm">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#222222] tracking-tight">
          Leaderboard Management
        </h1>
        <p className="text-[#6a6a6a] mt-1 text-sm">
          {canEdit
            ? 'View and modify player statistics'
            : 'View player statistics (read-only)'}
        </p>
      </div>

      {editingEntry && canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Player Stats</CardTitle>
            <CardDescription>
              Editing statistics for player #{editingEntry.player.number}
              {editingEntry.player && ` - ${editingEntry.player.name}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal">Goals</Label>
                  <Input
                    id="goal"
                    type="number"
                    value={formData.goal}
                    onChange={e =>
                      setFormData({ ...formData, goal: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assist">Assists</Label>
                  <Input
                    id="assist"
                    type="number"
                    value={formData.assist}
                    onChange={e =>
                      setFormData({ ...formData, assist: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_match">Total Matches</Label>
                  <Input
                    id="total_match"
                    type="number"
                    value={formData.total_match}
                    onChange={e =>
                      setFormData({ ...formData, total_match: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_win">Wins</Label>
                  <Input
                    id="total_win"
                    type="number"
                    value={formData.total_win}
                    onChange={e =>
                      setFormData({ ...formData, total_win: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_lose">Losses</Label>
                  <Input
                    id="total_lose"
                    type="number"
                    value={formData.total_lose}
                    onChange={e =>
                      setFormData({ ...formData, total_lose: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_draw">Draws</Label>
                  <Input
                    id="total_draw"
                    type="number"
                    value={formData.total_draw}
                    onChange={e =>
                      setFormData({ ...formData, total_draw: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Update</Button>
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-[#222222]">
            <Trophy className="w-5 h-5" style={{ color: '#ff385c' }} />
            Leaderboard ({leaderboard.length} players)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Player #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-center">Win Rate</TableHead>
                <TableHead className="text-center">Goals</TableHead>
                <TableHead className="text-center">Assists</TableHead>
                <TableHead className="text-center">Matches</TableHead>
                <TableHead className="text-center">W/L/D</TableHead>
                {canEdit && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((entry, index) => (
                <TableRow key={entry.player.number}>
                  <TableCell className="font-bold">
                    {index === 0 && <span className="text-yellow-500">🥇</span>}
                    {index === 1 && <span>🥈</span>}
                    {index === 2 && <span className="text-orange-600">🥉</span>}
                    {index > 2 && `#${index + 1}`}
                  </TableCell>
                  <TableCell className="font-medium">
                    #{entry.player.number}
                  </TableCell>
                  <TableCell>{entry.player?.name || '-'}</TableCell>
                  <TableCell className="text-center font-semibold">
                    {(entry.stats.winrate * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.stats.goal}
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.stats.assist}
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.stats.total_match}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    <span className="text-green-600">
                      {entry.stats.total_win}
                    </span>
                    /
                    <span className="text-red-600">
                      {entry.stats.total_lose}
                    </span>
                    /
                    <span className="text-[#6a6a6a]">
                      {entry.stats.total_draw}
                    </span>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(entry)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
