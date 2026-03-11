"use client";

import { useState } from "react";
import type { Match } from "../../../lib/api";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatMoney(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("vi-VN").format(amount);
}

type MatchAccordionItemProps = {
  match: Match;
  isOpen: boolean;
  onToggle: () => void;
};

function MatchAccordionItem({ match, isOpen, onToggle }: MatchAccordionItemProps) {
  const hasScore = match.home_score !== null && match.away_score !== null;
  const homeWon = hasScore && match.home_score! > match.away_score!;
  const awayWon = hasScore && match.away_score! > match.home_score!;
  const draw = hasScore && match.home_score === match.away_score;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Accordion Header - Clickable */}
      <button
        onClick={onToggle}
        className="w-full border-b border-zinc-100 bg-zinc-50 p-4 text-left transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:bg-zinc-800/60"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span
              className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
            >
              ▶
            </span>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {formatDate(match.match_date)}
              </h3>
              <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                {match.san && (
                  <span className="flex items-center gap-1">
                    📍 {match.san}
                  </span>
                )}
                {match.tiensan && (
                  <span className="flex items-center gap-1">
                    💸 {formatMoney(match.tiensan)} VND
                  </span>
                )}
              </div>
            </div>
          </div>
          {hasScore && (
            <div className="text-right">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {match.home_score} - {match.away_score}
              </div>
              {draw && (
                <div className="text-xs font-medium text-yellow-600 dark:text-yellow-500">
                  Draw
                </div>
              )}
            </div>
          )}
        </div>
      </button>

      {/* Accordion Content - Expandable */}
      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Home Team */}
          <div className="border-b border-zinc-100 p-4 md:border-b-0 md:border-r dark:border-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                Home Team
              </h4>
              {homeWon && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Winner
                </span>
              )}
            </div>
            <div className="space-y-2">
              {match.homePlayers.length === 0 ? (
                <p className="text-xs text-zinc-400">No players</p>
              ) : (
                match.homePlayers.map((player, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      player.isMvp
                        ? "bg-yellow-50 dark:bg-yellow-900/20"
                        : "bg-zinc-50 dark:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {player.number !== null && (
                          <span className="font-mono text-xs font-semibold text-zinc-500">
                            #{player.number}
                          </span>
                        )}
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {player.name || player.displayName || "?"}
                        </span>
                        {player.isMvp && (
                          <span className="text-xs">🏆 MVP</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {(player.goals ?? 0) > 0 && (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            ⚽ {player.goals}
                          </span>
                        )}
                        {(player.assists ?? 0) > 0 && (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            🎯 {player.assists}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Away Team */}
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                Away Team
              </h4>
              {awayWon && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Winner
                </span>
              )}
            </div>
            <div className="space-y-2">
              {match.awayPlayers.length === 0 ? (
                <p className="text-xs text-zinc-400">No players</p>
              ) : (
                match.awayPlayers.map((player, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      player.isMvp
                        ? "bg-yellow-50 dark:bg-yellow-900/20"
                        : "bg-zinc-50 dark:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {player.number !== null && (
                          <span className="font-mono text-xs font-semibold text-zinc-500">
                            #{player.number}
                          </span>
                        )}
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {player.name || player.displayName || "?"}
                        </span>
                        {player.isMvp && (
                          <span className="text-xs">🏆 MVP</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {(player.goals ?? 0) > 0 && (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            ⚽ {player.goals}
                          </span>
                        )}
                        {(player.assists ?? 0) > 0 && (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            🎯 {player.assists}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type MatchAccordionProps = {
  matches: Match[];
};

export function MatchAccordion({ matches }: MatchAccordionProps) {
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  const toggleMatch = (matchId: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenIds(new Set(matches.map((m) => m.id)));
  };

  const collapseAll = () => {
    setOpenIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          {openIds.size} of {matches.length} expanded
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {matches.map((match) => (
          <MatchAccordionItem
            key={match.id}
            match={match}
            isOpen={openIds.has(match.id)}
            onToggle={() => toggleMatch(match.id)}
          />
        ))}
      </div>
    </div>
  );
}
