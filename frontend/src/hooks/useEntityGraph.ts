import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/lib/api";

export interface EntityNode {
  id: string;
  label: string;
  type: string;
  owner?: string;
  active?: boolean;
  sanctioned?: boolean;
  lat?: number | null;
  lng?: number | null;
  nationality?: string;
}

export interface EntityEdge {
  source: string;
  target: string;
  relation: string;
}

export interface GraphStats {
  total_nodes: number;
  active_assets: number;
  known_owners: number;
  total_edges: number;
}

export interface EntityGraph {
  nodes: EntityNode[];
  edges: EntityEdge[];
  stats: GraphStats;
}

export interface EntityEntry {
  id: string;
  name: string;
  owner: string;
  owner_type: string;
  affiliation: string;
  nationality: string;
  asset_type: string;
  related: string[];
  notes: string;
  sanctioned: boolean;
}

export function useEntityGraph(enabled: boolean) {
  const [graph, setGraph] = useState<EntityGraph | null>(null);
  const [allEntities, setAllEntities] = useState<EntityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [graphRes, allRes] = await Promise.all([
        fetch(`${API_BASE}/api/entity-graph`),
        fetch(`${API_BASE}/api/entity-graph/all`),
      ]);
      if (!graphRes.ok) throw new Error(`Graph fetch failed: ${graphRes.status}`);
      if (!allRes.ok) throw new Error(`Entities fetch failed: ${allRes.status}`);
      const [graphData, allData] = await Promise.all([
        graphRes.json() as Promise<EntityGraph>,
        allRes.json() as Promise<EntityEntry[]>,
      ]);
      setGraph(graphData);
      setAllEntities(allData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const searchEntities = useCallback(async (q: string): Promise<EntityEntry[]> => {
    if (!q.trim()) return allEntities;
    try {
      const res = await fetch(`${API_BASE}/api/entity-graph/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return allEntities;
      return res.json() as Promise<EntityEntry[]>;
    } catch {
      return allEntities;
    }
  }, [allEntities]);

  useEffect(() => {
    if (enabled) fetchGraph();
  }, [enabled, fetchGraph]);

  return { graph, allEntities, loading, error, refetch: fetchGraph, searchEntities };
}
