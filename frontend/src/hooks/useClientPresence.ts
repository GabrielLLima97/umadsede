import { useEffect } from "react";
import { api } from "../api";

const STORAGE_KEY = "client-presence-id-v1";
const HEARTBEAT_MS = 30_000;

function ensureSessionId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const generated = generateId();
  window.localStorage.setItem(STORAGE_KEY, generated);
  return generated;
}

function generateId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function sendPresence(sessionId: string) {
  if (!sessionId) return;
  try {
    await api.post("/presence", {
      session_id: sessionId,
      source: "client",
    });
  } catch {
    // presença é best-effort – falhas são ignoradas
  }
}

export function useClientPresence(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const sessionId = ensureSessionId();
    let stopped = false;

    const heartbeat = () => {
      if (stopped) return;
      void sendPresence(sessionId);
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
  }, [enabled]);
}
