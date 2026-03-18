"use client";

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X, ChevronDown, ChevronUp, Map } from "lucide-react";
import { useTimeline } from "@/hooks/useTimeline";
import type { TimelineEvent } from "@/hooks/useTimeline";

// ---------------------------------------------------------------------------
// Layer metadata
// ---------------------------------------------------------------------------
interface LayerMeta {
  label: string;
  icon: string;
}

const LAYER_META: Record<string, LayerMeta> = {
  earthquakes:      { label: "Earthquakes",    icon: "🌍" },
  tracked_flights:  { label: "Tracked Flights", icon: "✈️" },
  military_flights: { label: "Military Flights",icon: "🛩️" },
  gps_jamming:      { label: "GPS Jamming",     icon: "📡" },
  firms_fires:      { label: "Fires",           icon: "🔥" },
  internet_outages: { label: "Internet",        icon: "🌐" },
  space_weather:    { label: "Space Weather",   icon: "☀️" },
  uavs:             { label: "UAVs",            icon: "🚁" },
  ships:            { label: "Ships",           icon: "🚢" },
};

const SEVERITY_COLORS: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-orange-500",
  low:    "bg-blue-500",
};

const SEVERITY_TEXT: Record<string, string> = {
  high:   "text-red-400",
  medium: "text-orange-400",
  low:    "text-blue-400",
};

const SEVERITY_BORDER: Record<string, string> = {
  high:   "border-red-800/40",
  medium: "border-orange-800/40",
  low:    "border-blue-800/40",
};

// ---------------------------------------------------------------------------
// Relative timestamp
// ---------------------------------------------------------------------------
function relativeTime(isoTimestamp: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
    if (diff < 10) return "just now";
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Single event row
// ---------------------------------------------------------------------------
interface EventRowProps {
  event: TimelineEvent;
  onJump?: (lat: number, lng: number) => void;
  now: number; // epoch ms, for reactive relative time
}

const EventRow = memo(function EventRow({ event, onJump, now: _now }: EventRowProps) {
  const canJump = event.lat != null && event.lng != null;
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 border-b ${SEVERITY_BORDER[event.severity] ?? "border-[var(--border-primary)]"} hover:bg-[var(--bg-secondary)]/40 transition-colors group`}
    >
      {/* Icon */}
      <span className="text-base leading-none flex-shrink-0 mt-0.5">{event.icon}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_COLORS[event.severity] ?? "bg-gray-500"}`} />
          <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">{event.title}</span>
        </div>
        <p className="text-[9px] text-[var(--text-muted)] truncate">{event.detail}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[8px] text-[var(--text-muted)]/60 font-mono">{relativeTime(event.timestamp)}</span>
          <span className={`text-[8px] font-mono tracking-wide ${SEVERITY_TEXT[event.severity] ?? ""}`}>
            {event.layer.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Jump to map button */}
      {canJump && (
        <button
          onClick={() => onJump && onJump(event.lat!, event.lng!)}
          className="flex-shrink-0 p-1 rounded text-[var(--text-muted)] hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors opacity-0 group-hover:opacity-100"
          title="Jump to location"
        >
          <Map size={10} />
        </button>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main EventTimeline component
// ---------------------------------------------------------------------------
interface EventTimelineProps {
  onJumpToLocation?: (lat: number, lng: number) => void;
}

export default function EventTimeline({ onJumpToLocation }: EventTimelineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeSeverity, setActiveSeverity] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { events, stats, isConnected, filterLayer, setFilterLayer } = useTimeline({ limit: 100 });

  // Update relative timestamps every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Filtered events
  const filtered = events.filter((e) => {
    if (filterLayer && e.layer !== filterLayer) return false;
    if (activeSeverity && e.severity !== activeSeverity) return false;
    return true;
  });

  const stats1h = stats?.["1h"];
  const totalUnread = stats1h?.total ?? filtered.length;

  const handleJump = useCallback(
    (lat: number, lng: number) => {
      onJumpToLocation?.(lat, lng);
    },
    [onJumpToLocation]
  );

  return (
    <>
      {/* Toggle button — rendered inline in the top-right controls area */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 backdrop-blur-md border rounded-lg transition-all text-[10px] font-mono cursor-pointer ${
          isOpen
            ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-400"
            : "bg-[var(--bg-primary)]/50 border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-cyan-500/50 hover:bg-[var(--hover-accent)]"
        }`}
        title="Live Activity Feed"
      >
        <Activity size={12} className="text-cyan-400 w-3 h-3" />
        <span className="tracking-widest">ACTIVITY</span>
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            className="fixed left-[360px] top-24 w-72 z-[300] pointer-events-auto flex flex-col"
            style={{ maxHeight: "calc(100vh - 120px)" }}
          >
            <div className="flex flex-col bg-[var(--bg-primary)]/95 backdrop-blur-md border border-[var(--border-primary)] rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.4)] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-primary)] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Activity size={12} className="text-cyan-500" />
                  <span className="text-[10px] font-mono tracking-widest text-cyan-400">LIVE ACTIVITY FEED</span>
                  {/* Connection status dot */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400" : "bg-red-500"}`}
                    title={isConnected ? "Connected" : "Disconnected — polling fallback"}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMinimized((v) => !v)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {isMinimized ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {!isMinimized && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex flex-col overflow-hidden"
                  >
                    {/* Layer filter pills */}
                    <div className="px-3 py-2 border-b border-[var(--border-primary)] flex-shrink-0">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setFilterLayer(null)}
                          className={`px-2 py-0.5 rounded-full text-[8px] font-mono tracking-widest transition-colors ${
                            !filterLayer
                              ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                              : "bg-[var(--bg-secondary)]/50 text-[var(--text-muted)] border border-[var(--border-primary)] hover:border-cyan-700"
                          }`}
                        >
                          ALL
                        </button>
                        {Object.entries(LAYER_META).map(([key, meta]) => (
                          <button
                            key={key}
                            onClick={() => setFilterLayer(filterLayer === key ? null : key)}
                            className={`px-2 py-0.5 rounded-full text-[8px] font-mono transition-colors ${
                              filterLayer === key
                                ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                                : "bg-[var(--bg-secondary)]/50 text-[var(--text-muted)] border border-[var(--border-primary)] hover:border-cyan-700"
                            }`}
                          >
                            {meta.icon} {meta.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Severity filter */}
                    <div className="px-3 py-2 border-b border-[var(--border-primary)] flex-shrink-0">
                      <div className="flex gap-1.5">
                        {(["high", "medium", "low"] as const).map((sev) => (
                          <button
                            key={sev}
                            onClick={() => setActiveSeverity(activeSeverity === sev ? null : sev)}
                            className={`flex-1 py-1 rounded text-[8px] font-mono tracking-widest transition-colors border ${
                              activeSeverity === sev
                                ? sev === "high"
                                  ? "bg-red-500/20 border-red-500/50 text-red-400"
                                  : sev === "medium"
                                  ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                                  : "bg-blue-500/20 border-blue-500/50 text-blue-400"
                                : "bg-[var(--bg-secondary)]/50 border-[var(--border-primary)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                            }`}
                          >
                            {sev === "high" ? "🔴" : sev === "medium" ? "🟠" : "🔵"} {sev.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Event list */}
                    <div
                      ref={scrollRef}
                      className="overflow-y-auto styled-scrollbar flex-1"
                      style={{ maxHeight: "380px" }}
                    >
                      {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
                          <Activity size={20} className="mb-2 opacity-30" />
                          <p className="text-[9px] font-mono tracking-widest opacity-50">NO EVENTS YET</p>
                        </div>
                      ) : (
                        filtered.map((event) => (
                          <EventRow
                            key={event.id}
                            event={event}
                            onJump={handleJump}
                            now={now}
                          />
                        ))
                      )}
                    </div>

                    {/* Stats bar */}
                    {stats1h && (
                      <div className="px-3 py-2 border-t border-[var(--border-primary)] flex-shrink-0 bg-[var(--bg-secondary)]/30">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[8px] font-mono text-[var(--text-muted)]">
                            Last hour: <span className="text-cyan-400">{stats1h.total}</span>
                          </span>
                          <span className="text-[8px] font-mono text-red-400">
                            🔴 {stats1h.by_severity?.high ?? 0}
                          </span>
                          <span className="text-[8px] font-mono text-orange-400">
                            🟠 {stats1h.by_severity?.medium ?? 0}
                          </span>
                          <span className="text-[8px] font-mono text-blue-400">
                            🔵 {stats1h.by_severity?.low ?? 0}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
