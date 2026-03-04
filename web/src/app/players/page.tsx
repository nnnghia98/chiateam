import { AppShell } from "../_components/AppShell";
import { fetchPlayerSummaries } from "../../lib/api";

export default async function PlayersPage() {
  let summaries: Awaited<ReturnType<typeof fetchPlayerSummaries>> = [];
  try {
    summaries = await fetchPlayerSummaries();
  } catch {
    summaries = [];
  }

  const total = summaries.length;

  return (
    <AppShell
      title="Players"
      subtitle="View and manage all registered players."
    >
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Registered players</div>
            <div className="text-xs text-zinc-500">
              Total: <span className="font-mono">{total}</span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60">
              <tr>
                <th className="px-4 py-2">Number</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Matches</th>
                <th className="px-4 py-2">Goals</th>
                <th className="px-4 py-2">Assists</th>
                <th className="px-4 py-2">Join date</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(({ player: p, stats: s }) => (
                <tr
                  key={p.id}
                  className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                >
                  <td className="px-4 py-2 font-mono text-sm">#{p.number}</td>
                  <td className="px-4 py-2 text-sm">{p.name}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {p.username ? `@${p.username}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {s.total_match}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {s.goal}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {s.assist}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {new Date(p.created_at).toLocaleDateString("vi-VN")}
                  </td>
                </tr>
              ))}
              {summaries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-zinc-500"
                  >
                    No players registered yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-zinc-500">
          Player registration is currently managed via Telegram using the{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.75rem] font-mono dark:bg-zinc-800">
            /register
          </code>{" "}
          command. We can add creation and delete controls here later if needed.
        </p>
      </section>
    </AppShell>
  );
}

