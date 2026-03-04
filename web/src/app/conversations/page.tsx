import { AppShell } from "../_components/AppShell";
import { fetchConversations } from "../../lib/api";

export default async function ConversationsPage() {
  let data: Awaited<ReturnType<typeof fetchConversations>> | null = null;
  try {
    data = await fetchConversations();
  } catch {
    data = null;
  }

  const items = data?.items ?? [];

  return (
    <AppShell
      title="Conversations"
      subtitle="Recent interactions and command activity."
      rightActions={
        <>
          <button className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800">
            Export
          </button>
          <button className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">
            Clear view
          </button>
        </>
      }
    >
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              Recent ({items.length.toString()})
            </div>
            <div className="flex gap-2">
              <input
                className="h-9 w-56 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                placeholder="Search user or command..."
              />
              <button className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800">
                Filter
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60">
                <tr>
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Command</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                  >
                    <td className="px-4 py-2">{row.user}</td>
                    <td className="px-4 py-2 text-xs font-medium text-emerald-600">
                      {row.command}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          row.status === "ok"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        }
                      >
                        {row.status === "ok" ? "OK" : "Error"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-zinc-500">
                      {row.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-semibold">Selected</div>
            <div className="mt-2 text-sm text-zinc-500">
              Click a row to show details (next step).
            </div>
            <div className="mt-4 space-y-2 text-xs text-zinc-500">
              <div className="flex items-center justify-between">
                <span>Chat ID</span>
                <span className="font-mono">—</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last command</span>
                <span className="font-mono">—</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Latency</span>
                <span className="font-mono">—</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-semibold">Notes</div>
            <p className="mt-2 text-sm text-zinc-500">
              We&apos;ll replace this mocked data by adding a small HTTP API in the
              bot process (or a separate server) and fetching it from this page.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

