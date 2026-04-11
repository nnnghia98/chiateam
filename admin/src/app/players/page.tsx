'use client';

import { useState, useEffect } from 'react';
import { Player } from '@/types/player';
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
import { Plus, Pencil, Trash2, X } from 'lucide-react';

export default function PlayersPage() {
  const { canEdit } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    number: '',
    username: '',
  });

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPlayers();
      setPlayers(data.sort((a, b) => a.number - b.number));
    } catch (error) {
      console.error('Failed to load players:', error);
      alert('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createPlayer({
        name: formData.name,
        number: parseInt(formData.number),
        username: formData.username || undefined,
      });
      setFormData({ name: '', number: '', username: '' });
      setIsCreating(false);
      loadPlayers();
    } catch (error) {
      console.error('Failed to create player:', error);
      alert('Failed to create player');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;

    try {
      await apiClient.updatePlayer(editingPlayer.number, {
        name: formData.name,
        username: formData.username || null,
      });
      setEditingPlayer(null);
      setFormData({ name: '', number: '', username: '' });
      loadPlayers();
    } catch (error) {
      console.error('Failed to update player:', error);
      alert('Failed to update player');
    }
  };

  const handleDelete = async (number: number) => {
    if (!confirm('Are you sure you want to delete this player?')) return;

    try {
      await apiClient.deletePlayer(number);
      loadPlayers();
    } catch (error) {
      console.error('Failed to delete player:', error);
      alert('Failed to delete player');
    }
  };

  const startEdit = (player: Player) => {
    setEditingPlayer(player);
    setFormData({
      name: player.name,
      number: player.number.toString(),
      username: player.username || '',
    });
    setIsCreating(false);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingPlayer(null);
    setFormData({ name: '', number: '', username: '' });
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingPlayer(null);
    setFormData({ name: '', number: '', username: '' });
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-[#6a6a6a] text-sm">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#222222] tracking-tight">
            Players Management
          </h1>
          <p className="text-[#6a6a6a] mt-1 text-sm">
            {canEdit
              ? 'View and manage registered players'
              : 'View registered players (read-only)'}
          </p>
        </div>
        {canEdit && !isCreating && !editingPlayer && (
          <Button onClick={startCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Player
          </Button>
        )}
      </div>

      {canEdit && (isCreating || editingPlayer) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isCreating ? 'Create New Player' : 'Edit Player'}
            </CardTitle>
            <CardDescription>
              {isCreating
                ? 'Add a new player to the system'
                : `Editing player #${editingPlayer?.number}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={isCreating ? handleCreate : handleUpdate}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number">Number *</Label>
                  <Input
                    id="number"
                    type="number"
                    value={formData.number}
                    onChange={e =>
                      setFormData({ ...formData, number: e.target.value })
                    }
                    required
                    disabled={!!editingPlayer}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={e =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {isCreating ? 'Create' : 'Update'}
                </Button>
                <Button type="button" variant="outline" onClick={cancelForm}>
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
          <CardTitle>All Players ({players.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Created</TableHead>
                {canEdit && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map(player => (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">
                    #{player.number}
                  </TableCell>
                  <TableCell>{player.name}</TableCell>
                  <TableCell>{player.username || '-'}</TableCell>
                  <TableCell className="text-sm text-[#6a6a6a]">
                    {player.user_id}
                  </TableCell>
                  <TableCell
                    className="text-sm text-[#6a6a6a]"
                    suppressHydrationWarning
                  >
                    {new Date(player.created_at).toLocaleDateString()}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(player)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(player.number)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
