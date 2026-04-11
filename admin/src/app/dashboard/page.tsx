'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Calendar, Trophy, Target } from 'lucide-react';

interface Stats {
  totalPlayers: number;
  totalMatches: number;
  recentMatches: any[];
  topScorers: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalPlayers: 0,
    totalMatches: 0,
    recentMatches: [],
    topScorers: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [players, matches, leaderboard] = await Promise.all([
        apiClient.getPlayers(),
        apiClient.getMatches(),
        apiClient.getLeaderboard(),
      ]);

      const sortedMatches = matches
        .sort(
          (a, b) =>
            new Date(b.match_date).getTime() - new Date(a.match_date).getTime()
        )
        .slice(0, 5);

      const topScorers = leaderboard
        .sort((a, b) => b.stats.goal - a.stats.goal)
        .slice(0, 5);

      setStats({
        totalPlayers: players.length,
        totalMatches: matches.length,
        recentMatches: sortedMatches,
        topScorers,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      alert('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
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
          Dashboard
        </h1>
        <p className="text-[#6a6a6a] mt-1 text-sm">
          Overview of your football team statistics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#6a6a6a]">
              Total Players
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-[#f2f2f2] flex items-center justify-center">
              <Users className="h-4 w-4" style={{ color: '#ff385c' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#222222]">
              {stats.totalPlayers}
            </div>
            <p className="text-xs text-[#6a6a6a]">Registered players</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#6a6a6a]">
              Total Matches
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-[#f2f2f2] flex items-center justify-center">
              <Calendar className="h-4 w-4" style={{ color: '#ff385c' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#222222]">
              {stats.totalMatches}
            </div>
            <p className="text-xs text-[#6a6a6a]">Matches played</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#6a6a6a]">
              Top Scorer
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-[#f2f2f2] flex items-center justify-center">
              <Target className="h-4 w-4" style={{ color: '#ff385c' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#222222]">
              {stats.topScorers[0]?.stats.goal || 0}
            </div>
            <p className="text-xs text-[#6a6a6a]">
              {stats.topScorers[0]?.player?.name || 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#6a6a6a]">
              Best Win Rate
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-[#f2f2f2] flex items-center justify-center">
              <Trophy className="h-4 w-4" style={{ color: '#ff385c' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#222222]">
              {stats.topScorers[0]
                ? `${(stats.topScorers[0].stats.winrate * 100).toFixed(1)}%`
                : '0%'}
            </div>
            <p className="text-xs text-[#6a6a6a]">
              {stats.topScorers[0]?.player?.name || 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#222222]">
              Recent Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentMatches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[#6a6a6a] text-xs font-medium">
                      Date
                    </TableHead>
                    <TableHead className="text-[#6a6a6a] text-xs font-medium">
                      Location
                    </TableHead>
                    <TableHead className="text-right text-[#6a6a6a] text-xs font-medium">
                      Score
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentMatches.map(match => (
                    <TableRow key={match.id}>
                      <TableCell
                        className="font-medium text-[#222222]"
                        suppressHydrationWarning
                      >
                        {new Date(match.match_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-[#6a6a6a]">
                        {match.san || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-[#222222]">
                        {match.home_score !== null && match.away_score !== null
                          ? `${match.home_score} - ${match.away_score}`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-[#6a6a6a] text-sm py-4">
                No matches yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#222222]">
              Top Scorers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topScorers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[#6a6a6a] text-xs font-medium">
                      Player
                    </TableHead>
                    <TableHead className="text-center text-[#6a6a6a] text-xs font-medium">
                      Goals
                    </TableHead>
                    <TableHead className="text-center text-[#6a6a6a] text-xs font-medium">
                      Assists
                    </TableHead>
                    <TableHead className="text-right text-[#6a6a6a] text-xs font-medium">
                      Win Rate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topScorers.map((entry, index) => (
                    <TableRow key={entry.player.number}>
                      <TableCell className="font-medium text-[#222222]">
                        {index === 0 && '🥇 '}
                        {index === 1 && '🥈 '}
                        {index === 2 && '🥉 '}
                        {entry.player?.name || `#${entry.player?.number}`}
                      </TableCell>
                      <TableCell className="text-center text-[#222222]">
                        {entry.stats.goal}
                      </TableCell>
                      <TableCell className="text-center text-[#222222]">
                        {entry.stats.assist}
                      </TableCell>
                      <TableCell className="text-right text-[#222222]">
                        {(entry.stats.winrate * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-[#6a6a6a] text-sm py-4">
                No data yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
