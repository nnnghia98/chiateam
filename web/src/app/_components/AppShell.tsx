"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/conversations", label: "Conversations" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  title,
  subtitle,
  children,
  rightActions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  rightActions?: ReactNode;
}) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="flex h-screen">
        <aside className="flex w-64 flex-col border-r border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Chiateam
            </div>
            <div className="text-lg font-semibold">Bot Console</div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 text-sm">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "rounded-md bg-zinc-100 px-3 py-2 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                      : "rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
            Designed to be edited with the Cursor Browser visual editor.
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-zinc-50 p-6 dark:bg-zinc-950">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? (
                <p className="text-sm text-zinc-500">{subtitle}</p>
              ) : null}
            </div>
            {rightActions ? <div className="flex gap-2">{rightActions}</div> : null}
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}

