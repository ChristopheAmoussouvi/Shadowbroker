"use client";

import { useState, useCallback, useEffect } from "react";
import type { SelectedEntity, DashboardData } from "@/types/dashboard";

export interface RecentEntry {
  id: string | number;
  type: string;
  name: string;
  label: string;
  icon: string;
  lat?: number;
  lng?: number;
  extra?: Record<string, any>;
  viewedAt: number;
}

const MAX_RECENT = 8;
const STORAGE_KEY = "shadowbroker_recent_entities";

function getIconForType(type: string): string {
  switch (type) {
    case "flight":
    case "private_flight":
    case "private_jet":
      return "✈️";
    case "military_flight":
    case "tracked_flight":
      return "🛩️";
    case "uav":
      return "🚁";
    case "ship":
      return "🚢";
    case "satellite":
      return "📡";
    case "earthquake":
      return "🌍";
    case "cctv":
      return "📹";
    case "liveuamap":
    case "gdelt":
      return "⚡";
    case "region_dossier":
      return "📍";
    default:
      return "🔍";
  }
}

function extractLabel(entity: SelectedEntity): string {
  const { type, id, extra } = entity;
  switch (type) {
    case "flight":
    case "private_flight":
    case "private_jet":
    case "military_flight":
    case "tracked_flight":
    case "uav":
      return String(extra?.callsign || extra?.tail || extra?.icao || id);
    case "ship":
      return String(extra?.name || extra?.mmsi || id);
    case "satellite":
      return String(extra?.name || id);
    case "earthquake":
      return extra?.place ? String(extra.place) : `M${extra?.mag ?? "?"}`;
    default:
      return String(entity.name || id);
  }
}

function extractLatLng(
  entity: SelectedEntity,
  data: DashboardData | null
): { lat?: number; lng?: number } {
  if (entity.extra?.lat != null && entity.extra?.lng != null) {
    return { lat: entity.extra.lat, lng: entity.extra.lng };
  }
  if (!data) return {};
  const { type, id } = entity;

  const findByIdentifier = <T extends { icao24?: string; mmsi?: number; id?: string | number; lat?: number; lng?: number }>(
    arr: T[] | undefined
  ): T | undefined => arr?.find((item) => item.icao24 === id || item.mmsi === Number(id) || item.id === id);

  switch (type) {
    case "flight": {
      const f = findByIdentifier(data.commercial_flights as any);
      return f ? { lat: f.lat, lng: f.lng } : {};
    }
    case "private_flight": {
      const f = findByIdentifier(data.private_flights as any);
      return f ? { lat: f.lat, lng: f.lng } : {};
    }
    case "private_jet": {
      const f = findByIdentifier(data.private_jets as any);
      return f ? { lat: f.lat, lng: f.lng } : {};
    }
    case "military_flight": {
      const f = findByIdentifier(data.military_flights as any);
      return f ? { lat: f.lat, lng: f.lng } : {};
    }
    case "tracked_flight": {
      const f = findByIdentifier(data.tracked_flights as any);
      return f ? { lat: f.lat, lng: f.lng } : {};
    }
    case "uav": {
      const f = findByIdentifier(data.uavs as any);
      return f ? { lat: f.lat, lng: f.lng } : {};
    }
    case "ship": {
      const s = data.ships?.find((sh) => sh.mmsi === Number(id));
      return s ? { lat: s.lat, lng: s.lng } : {};
    }
    case "satellite": {
      const s = data.satellites?.find((sat) => sat.id === id || sat.name === id);
      return s ? { lat: s.lat, lng: s.lng } : {};
    }
    case "earthquake": {
      const eq = data.earthquakes?.find((e) => e.id === id);
      return eq ? { lat: eq.lat, lng: eq.lng } : {};
    }
    default:
      return {};
  }
}

export function useRecentEntities() {
  const [entries, setEntries] = useState<RecentEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const addEntity = useCallback(
    (entity: SelectedEntity, data: DashboardData | null) => {
      const label = extractLabel(entity);
      const icon = getIconForType(entity.type);
      const { lat, lng } = extractLatLng(entity, data);

      const newEntry: RecentEntry = {
        id: entity.id,
        type: entity.type,
        name: entity.name || label,
        label,
        icon,
        lat,
        lng,
        extra: entity.extra,
        viewedAt: Date.now(),
      };

      setEntries((prev) => {
        // Deduplicate: move existing entry to front
        const filtered = prev.filter(
          (e) => !(e.id === entity.id && e.type === entity.type)
        );
        const next = [newEntry, ...filtered];
        return next.slice(0, MAX_RECENT);
      });
    },
    []
  );

  const clearEntries = useCallback(() => setEntries([]), []);

  // Persist to localStorage on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore storage errors
    }
  }, [entries]);

  return { entries, addEntity, clearEntries };
}
