"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE } from "@/lib/api";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  layer: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  lat?: number | null;
  lng?: number | null;
  icon: string;
  entity_id?: string | null;
}

export interface TimelineStats {
  "1h": { total: number; by_layer: Record<string, number>; by_severity: Record<string, number> };
  "6h": { total: number; by_layer: Record<string, number>; by_severity: Record<string, number> };
  "24h": { total: number; by_layer: Record<string, number>; by_severity: Record<string, number> };
}

export interface UseTimelineOptions {
  limit?: number;
  layer?: string;
  severity?: string;
}

const WS_RING_SIZE = 200;
const POLL_INTERVAL_MS = 30_000;
const WS_RECONNECT_BASE_MS = 1_000;
const WS_RECONNECT_MAX_MS = 30_000;

function buildWsUrl(): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // WebSocket must go directly to the backend (cannot be proxied by Next.js)
  const host = window.location.hostname;
  return `${protocol}//${host}:8000/ws/timeline`;
}

export function useTimeline(options?: UseTimelineOptions) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [filterLayer, setFilterLayer] = useState<string | null>(options?.layer ?? null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(WS_RECONNECT_BASE_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const limit = options?.limit ?? 100;
  const severityFilter = options?.severity;

  // ---------------------------------------------------------------------------
  // REST pre-fetch & polling fallback
  // ---------------------------------------------------------------------------
  const fetchEvents = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (filterLayer) params.set("layer", filterLayer);
      if (severityFilter) params.set("severity", severityFilter);
      const [evRes, stRes] = await Promise.all([
        fetch(`${API_BASE}/api/timeline?${params}`),
        fetch(`${API_BASE}/api/timeline/stats`),
      ]);
      if (evRes.ok) {
        const data: TimelineEvent[] = await evRes.json();
        if (mountedRef.current) setEvents(data.slice(0, WS_RING_SIZE));
      }
      if (stRes.ok) {
        const data: TimelineStats = await stRes.json();
        if (mountedRef.current) setStats(data);
      }
    } catch {
      // Network error — silently ignore; polling will retry
    }
    if (mountedRef.current) {
      pollTimerRef.current = setTimeout(fetchEvents, POLL_INTERVAL_MS);
    }
  }, [limit, filterLayer, severityFilter]);

  // ---------------------------------------------------------------------------
  // WebSocket connection
  // ---------------------------------------------------------------------------
  const connectWs = useCallback(() => {
    if (!mountedRef.current) return;
    const url = buildWsUrl();
    if (!url) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setIsConnected(true);
        reconnectDelayRef.current = WS_RECONNECT_BASE_MS;
      };

      ws.onmessage = (evt) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(evt.data as string);
          // Ignore keep-alive pings
          if (msg?.type === "ping") return;
          const event = msg as TimelineEvent;
          if (!event.id || !event.layer) return;
          setEvents((prev) => {
            // Prepend and cap to ring size
            const next = [event, ...prev.filter((e) => e.id !== event.id)];
            return next.slice(0, WS_RING_SIZE);
          });
        } catch {
          // Malformed message — ignore
        }
      };

      ws.onerror = () => {
        // onclose will fire right after
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;
        // Exponential backoff reconnect
        reconnectTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            WS_RECONNECT_MAX_MS
          );
          connectWs();
        }, reconnectDelayRef.current);
      };
    } catch {
      // WebSocket constructor threw (e.g. in SSR) — ignore
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Mount / unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    // Initial data fetch
    fetchEvents();
    // WebSocket connection
    connectWs();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      wsRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when filters change
  useEffect(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    fetchEvents();
  }, [filterLayer, severityFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearEvents = useCallback(() => setEvents([]), []);

  // Filtered view for consumers that pass a layer filter through the hook
  const visibleEvents = filterLayer
    ? events.filter((e) => e.layer === filterLayer)
    : events;

  return { events: visibleEvents, stats, isConnected, clearEvents, filterLayer, setFilterLayer };
}
