const BASE_URL =
  process.env.NEXT_PUBLIC_UI_API_BASE_URL || "http://localhost:8787";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export type StatusResponse = {
  startedAt: string;
  online: boolean;
  botInitialized?: boolean;
  settings?: {
    maintenanceMode: boolean;
    debugLogging: boolean;
    environment: string;
  };
};

export type ConversationItem = {
  id: string;
  user: string;
  command: string | null;
  lastMessage: string;
  status: string;
  time: string;
};

export type Settings = {
  maintenanceMode: boolean;
  debugLogging: boolean;
  environment: string;
  botCommandPrefix: string;
  allowedChatIds: string[];
};

export async function fetchStatus(): Promise<StatusResponse> {
  return getJson<StatusResponse>("/api/status");
}

export async function fetchConversations(): Promise<{ items: ConversationItem[] }> {
  return getJson<{ items: ConversationItem[] }>("/api/conversations");
}

export async function fetchSettings(): Promise<Settings> {
  return getJson<Settings>("/api/settings");
}

export async function updateSettings(
  payload: Partial<Pick<Settings, "maintenanceMode" | "debugLogging" | "botCommandPrefix" | "allowedChatIds">>,
): Promise<Settings> {
  const res = await fetch(`${BASE_URL}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Settings;
}

