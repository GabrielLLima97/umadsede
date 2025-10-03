import { useEffect } from "react";
import { api } from "../api";

const STORAGE_MAP: Record<string, string> = {
  client: "client-presence-id-v1",
  admin: "admin-presence-id-v1",
};

const HEARTBEAT_MS = 30_000;

function ensureSessionId(source: "client" | "admin"): string {
  if (typeof window === "undefined") return "";
  const storageKey = STORAGE_MAP[source] ?? STORAGE_MAP.client;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const generated = generateId();
  window.localStorage.setItem(storageKey, generated);
  return generated;
}

function generateId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function sendPresence(sessionId: string, source: "client" | "admin") {
  if (!sessionId) return;
  try {
    await api.post("/presence", {
      session_id: sessionId,
      source,
    });
  } catch {
    // presença é best-effort – falhas são ignoradas
  }
}

export function usePresence(source: "client" | "admin", enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const sessionId = ensureSessionId(source);
    let stopped = false;

    const heartbeat = () => {
      if (stopped) return;
      void sendPresence(sessionId, source);
    };

    heartbeat();
    const interval = window.setInterval(heartbeat, HEARTBEAT_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        heartbeat();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, source]);
}

export function useClientPresence(enabled = true) {
  usePresence("client", enabled);
}

export function useAdminPresence(enabled = true) {
  usePresence("admin", enabled);
}
