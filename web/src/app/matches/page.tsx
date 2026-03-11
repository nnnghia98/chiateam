import { AppShell } from "../_components/AppShell";
import { fetchMatches } from "../../lib/api";
import { MatchAccordion } from "./_components/MatchAccordion";

export default async function MatchesPage() {
  let matches: Awaited<ReturnType<typeof fetchMatches>> = [];
  try {
    matches = await fetchMatches(20, 0);
  } catch {
    matches = [];
  }

  const total = matches.length;

  return (
    <AppShell title="Matches" subtitle="View all matches and player statistics.">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Recorded matches</div>
            <div className="text-xs text-zinc-500">
              Total: <span className="font-mono">{total}</span>
            </div>
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">
              No matches recorded yet. Use the <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.75rem] font-mono dark:bg-zinc-800">/match SAVE</code> command in Telegram to save matches.
            </p>
          </div>
        ) : (
          <MatchAccordion matches={matches} />
        )}

        <p className="text-xs text-zinc-500">
          Match management is currently handled via Telegram using the{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.75rem] font-mono dark:bg-zinc-800">
            /match
          </code>{" "}
          command. Use{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.75rem] font-mono dark:bg-zinc-800">
            /match SAVE
          </code>{" "}
          to save a match,{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.75rem] font-mono dark:bg-zinc-800">
            /match goal 10 2
          </code>{" "}
          to record goals, and{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.75rem] font-mono dark:bg-zinc-800">
            /match mvp 10
          </code>{" "}
          to set MVP.
        </p>
      </section>
    </AppShell>
  );
}
