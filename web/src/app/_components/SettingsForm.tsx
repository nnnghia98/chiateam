"use client";

import { useState, useTransition } from "react";
import type { Settings } from "../../lib/api";
import { updateSettings } from "../../lib/api";

export function SettingsForm({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const onToggle = (key: "maintenanceMode" | "debugLogging") => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const onChangePrefix = (value: string) => {
    setSettings(prev => ({ ...prev, botCommandPrefix: value }));
  };

  const onChangeAllowed = (value: string) => {
    const parts = value
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
    setSettings(prev => ({ ...prev, allowedChatIds: parts }));
  };

  const onReset = () => {
    setSettings(initial);
    setMessage("Reset to last saved values.");
  };

  const onSave = () => {
    setMessage(null);
    startSaving(async () => {
      try {
        const next = await updateSettings({
          maintenanceMode: settings.maintenanceMode,
          debugLogging: settings.debugLogging,
          botCommandPrefix: settings.botCommandPrefix,
          allowedChatIds: settings.allowedChatIds,
        });
        setSettings(next);
        setMessage("Saved.");
      } catch (e) {
        setMessage("Failed to save settings.");
      }
    });
  };

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-semibold">General</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="text-xs font-medium text-zinc-500">
                  Environment
                </div>
                <input
                  className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400"
                  value={settings.environment}
                  readOnly
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-zinc-500">
                  Bot command prefix
                </div>
                <input
                  className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-500"
                  value={settings.botCommandPrefix}
                  onChange={event => onChangePrefix(event.target.value)}
                />
              </label>

              <label className="block sm:col-span-2">
                <div className="text-xs font-medium text-zinc-500">
                  Allowed chat IDs
                </div>
                <input
                  className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-500"
                  value={settings.allowedChatIds.join(", ")}
                  onChange={event => onChangeAllowed(event.target.value)}
                  placeholder="e.g. -1001234567890, -1009876543210"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-semibold">Safety</div>
            <div className="mt-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Maintenance mode</div>
                  <div className="text-xs text-zinc-500">
                    Reject new commands and show a short message.
                  </div>
                </div>
                <button
                  onClick={() => onToggle("maintenanceMode")}
                  className={
                    settings.maintenanceMode
                      ? "inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      : "inline-flex items-center rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                  }
                >
                  {settings.maintenanceMode ? "On" : "Off"}
                </button>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Debug logging</div>
                  <div className="text-xs text-zinc-500">
                    Include extra details for troubleshooting.
                  </div>
                </div>
                <button
                  onClick={() => onToggle("debugLogging")}
                  className={
                    settings.debugLogging
                      ? "inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      : "inline-flex items-center rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                  }
                >
                  {settings.debugLogging ? "On" : "Off"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-semibold">About</div>
            <div className="mt-2 text-sm text-zinc-500">
              Changes are stored in-memory in the bot process for now. You can
              later persist them to SQLite or environment variables.
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-semibold">API status</div>
            <div className="mt-2 space-y-2 text-xs text-zinc-500">
              <div className="flex items-center justify-between">
                <span>UI</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  OK
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Bot API</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="mt-4 text-xs text-zinc-500">
          {saving ? "Saving..." : message}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </>
  );
}

