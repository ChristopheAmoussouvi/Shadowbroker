"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/** A single fired alert event received from the backend. */
export interface AlertEvent {
  type: "alert" | "ping";
  rule_id?: string;
  rule_name?: string;
  rule_type?: "entity" | "geofence";
  layer?: string;
  entity_label?: string;
  entity?: Record<string, unknown>;
  timestamp?: string;
}

/** A persisted alert rule as returned by GET /api/alerts/rules. */
export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  type: "entity" | "geofence";
  entity_ids: string[];
  geofence: {
    south?: number;
    west?: number;
    north?: number;
    east?: number;
  };
  geofence_layers: string[];
  telegram_chat_id: string;
  discord_webhook_url: string;
  notify_websocket: boolean;
  cooldown_seconds: number;
  last_fired: number | null;
}

const MAX_ALERTS = 100;
const LAST_READ_KEY = "sb_alerts_last_read";

/** Derive the WebSocket URL from the current browser location. */
function getWsUrl(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  // Backend always runs on port 8000; Next.js doesn't proxy WebSocket upgrades.
  return `${proto}://${window.location.hostname}:8000/ws/alerts`;
}

/**
 * Custom hook that manages the real-time alert WebSocket connection.
 *
 * Features:
 * - Auto-reconnects with exponential backoff (1s → 2s → 4s → … → 30s max)
 * - Stores up to 100 recent alert events in state
 * - Persists `lastReadAt` in localStorage so the unread count survives refresh
 *
 * Returns: `{ alerts, unreadCount, markAllRead, isConnected }`
 */
export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem(LAST_READ_KEY) || "0", 10);
  });

  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(1000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    const url = getWsUrl();
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setIsConnected(true);
      retryDelayRef.current = 1000; // reset backoff on successful connection
    };

    ws.onmessage = (evt) => {
      try {
        const data: AlertEvent = JSON.parse(evt.data as string);
        if (data.type === "ping") return; // keep-alive ping — ignore
        setAlerts(prev => {
          const next = [data, ...prev];
          return next.slice(0, MAX_ALERTS);
        });
      } catch {
        // Malformed message — ignore
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setIsConnected(false);
      wsRef.current = null;
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap)
      const delay = Math.min(retryDelayRef.current, 30000);
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);
      retryTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose which handles reconnect
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  /** Count alerts received after the last "mark all read" timestamp. */
  const unreadCount = alerts.filter(a => {
    if (!a.timestamp) return false;
    return new Date(a.timestamp).getTime() > lastReadAt;
  }).length;

  /** Mark all current alerts as read and persist the timestamp. */
  const markAllRead = useCallback(() => {
    const now = Date.now();
    setLastReadAt(now);
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_READ_KEY, String(now));
    }
  }, []);

  return { alerts, unreadCount, markAllRead, isConnected };
}
