import { AppShell } from "./_components/AppShell";
import { fetchStatus } from "../lib/api";

export default async function Home() {
  let status: Awaited<ReturnType<typeof fetchStatus>> | null = null;
  try {
    status = await fetchStatus();
  } catch {
    status = null;
  }

  const online = status?.online ?? false;
  const startedAt = status?.startedAt
    ? new Date(status.startedAt).toLocaleString()
    : "unknown";
  const environment = status?.settings?.environment ?? "unknown";

  return (
    <AppShell
      title="Dashboard"
      subtitle="High-level view of your Telegram bot activity."
      rightActions={
        <>
          <span
            className={
              online
                ? "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
            }
          >
            {online ? "Online" : "Offline"}
          </span>
          <button className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800">
            Refresh
          </button>
          <button className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            New Test Conversation
          </button>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Status
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">
                  {online ? "Healthy" : "Unavailable"}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Environment: <span className="font-mono">{environment}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Started: <span className="font-mono">{startedAt}</span>
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Active players
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold">16</span>
                <span className="text-xs text-zinc-500">this week</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Registered and active in matches.</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Error rate
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold">1.2%</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  Stable
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Failed commands in the last 24h.</p>
            </div>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recent conversations</h2>
                <button className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                  View all
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60">
                    <tr>
                      <th className="px-4 py-2">User</th>
                      <th className="px-4 py-2">Last message</th>
                      <th className="px-4 py-2">Command</th>
                      <th className="px-4 py-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60">
                      <td className="px-4 py-2 text-sm">@alice</td>
                      <td className="px-4 py-2 text-sm text-zinc-500">
                        &quot;create team for tonight?&quot;
                      </td>
                      <td className="px-4 py-2 text-xs font-medium text-emerald-600">
                        /chia-team
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-zinc-500">
                        2 min ago
                      </td>
                    </tr>
                    <tr className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60">
                      <td className="px-4 py-2 text-sm">@bob</td>
                      <td className="px-4 py-2 text-sm text-zinc-500">
                        &quot;add me to bench&quot;
                      </td>
                      <td className="px-4 py-2 text-xs font-medium text-emerald-600">
                        /bench
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-zinc-500">
                        8 min ago
                      </td>
                    </tr>
                    <tr className="border-t border-zinc-100 hover:bg-zinc-800/60 dark:border-zinc-800 dark:hover:bg-zinc-800/60">
                      <td className="px-4 py-2 text-sm">@carol</td>
                      <td className="px-4 py-2 text-sm text-zinc-500">
                        &quot;edit my stats&quot;
                      </td>
                      <td className="px-4 py-2 text-xs font-medium text-emerald-600">
                        /leaderboard
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-zinc-500">
                        21 min ago
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Quick settings</h2>
              <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Maintenance mode</div>
                    <div className="text-xs text-zinc-500">
                      Temporarily disable new commands.
                    </div>
                  </div>
                  <button className="inline-flex items-center rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600">
                    Off
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Debug logging</div>
                    <div className="text-xs text-zinc-500">
                      Include extra info in logs.
                    </div>
                  </div>
                  <button className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                    On
                  </button>
                </div>
                <div className="text-xs text-zinc-500">
                  These controls are mocked for now. We&apos;ll wire them up to real
                  APIs in the next step.
                </div>
              </div>
            </div>
          </section>
    </AppShell>
  );
}
