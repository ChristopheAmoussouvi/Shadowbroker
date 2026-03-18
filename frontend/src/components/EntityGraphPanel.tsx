"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Network, Table, Search, RefreshCw, AlertCircle } from "lucide-react";
import { useEntityGraph, EntityNode, EntityEdge } from "@/hooks/useEntityGraph";

// ── Types ────────────────────────────────────────────────────────────────────

type FilterMode = "all" | "active" | "sanctioned" | "individual" | "company";
type ViewMode = "graph" | "catalogue";

interface LayoutNode extends EntityNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onJumpToLocation?: (lat: number, lng: number) => void;
}

// ── Visual constants ─────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  individual: "#facc15",   // yellow
  government: "#a78bfa",   // purple
  company: "#60a5fa",      // blue
  private_jet: "#2dd4bf",  // teal
  tracked_flight: "#2dd4bf",
  military_flight: "#f97316",
  superyacht: "#1e40af",   // navy
  ship: "#3b82f6",
  asset: "#94a3b8",        // grey fallback
};

const NODE_SHAPES: Record<string, string> = {
  individual: "circle",
  government: "circle",
  company: "square",
  private_jet: "diamond",
  tracked_flight: "diamond",
  military_flight: "diamond",
  superyacht: "diamond",
  ship: "diamond",
};

function nodeColor(node: LayoutNode): string {
  if (node.sanctioned) return "#ef4444"; // red override
  return NODE_COLORS[node.type] ?? "#94a3b8";
}

function nodeShape(node: LayoutNode): string {
  return NODE_SHAPES[node.type] ?? "circle";
}

function nodeRadius(node: LayoutNode, edges: EntityEdge[]): number {
  const degree = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  ).length;
  return Math.max(7, Math.min(20, 7 + degree * 1.5));
}

// ── Force simulation (lightweight, no external lib) ──────────────────────────

function initLayout(nodes: EntityNode[], edges: EntityEdge[], w: number, h: number): LayoutNode[] {
  return nodes.map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI;
    const r = Math.min(w, h) * 0.3;
    return {
      ...n,
      x: w / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 40,
      y: h / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
      radius: nodeRadius(n as LayoutNode, edges),
    };
  });
}

function runForce(nodes: LayoutNode[], edges: EntityEdge[], w: number, h: number): LayoutNode[] {
  const alpha = 0.15;
  const repulsion = 1800;
  const springLen = 120;
  const springK = 0.04;
  const damping = 0.8;
  const padding = 30;

  const idx: Record<string, number> = {};
  nodes.forEach((n, i) => { idx[n.id] = i; });

  // Repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      nodes[i].vx -= fx;
      nodes[i].vy -= fy;
      nodes[j].vx += fx;
      nodes[j].vy += fy;
    }
  }

  // Spring (edges)
  for (const edge of edges) {
    const si = idx[edge.source];
    const ti = idx[edge.target];
    if (si === undefined || ti === undefined) continue;
    const dx = nodes[ti].x - nodes[si].x;
    const dy = nodes[ti].y - nodes[si].y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const stretch = dist - springLen;
    const force = stretch * springK;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    nodes[si].vx += fx;
    nodes[si].vy += fy;
    nodes[ti].vx -= fx;
    nodes[ti].vy -= fy;
  }

  // Centre attraction (weak)
  for (const n of nodes) {
    n.vx += (w / 2 - n.x) * 0.003;
    n.vy += (h / 2 - n.y) * 0.003;
  }

  // Integrate & damp
  for (const n of nodes) {
    n.vx *= damping;
    n.vy *= damping;
    n.x += n.vx * alpha;
    n.y += n.vy * alpha;
    n.x = Math.max(padding + n.radius, Math.min(w - padding - n.radius, n.x));
    n.y = Math.max(padding + n.radius, Math.min(h - padding - n.radius, n.y));
  }

  return nodes;
}

// ── Draw a single node on canvas ─────────────────────────────────────────────

function drawNode(ctx: CanvasRenderingContext2D, n: LayoutNode, selected: boolean, tick: number) {
  const color = nodeColor(n);
  const shape = nodeShape(n);
  const r = n.radius;

  ctx.save();
  ctx.translate(n.x, n.y);

  // Active pulse ring
  if (n.active) {
    const pulseR = r + 4 + Math.sin(tick * 0.08) * 3;
    ctx.beginPath();
    ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(tick * 0.08);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Selection ring
  if (selected) {
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.strokeStyle = selected ? "#fff" : "rgba(0,0,0,0.6)";
  ctx.lineWidth = selected ? 2 : 1;

  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (shape === "square") {
    ctx.beginPath();
    ctx.rect(-r, -r, r * 2, r * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Diamond
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.2);
    ctx.lineTo(r * 1.1, 0);
    ctx.lineTo(0, r * 1.2);
    ctx.lineTo(-r * 1.1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `${Math.max(9, r * 0.85)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const maxLabel = 18;
  const label = n.label.length > maxLabel ? n.label.slice(0, maxLabel) + "…" : n.label;
  ctx.fillText(label, 0, r + 3);

  ctx.restore();
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EntityGraphPanel({ isOpen, onClose, onJumpToLocation }: Props) {
  const { graph, allEntities, loading, error, refetch, searchEntities } = useEntityGraph(isOpen);

  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [catalogueResults, setCatalogueResults] = useState(allEntities);
  const [searchPending, setSearchPending] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<LayoutNode[]>([]);
  const rafRef = useRef<number>(0);
  const tickRef = useRef(0);
  const stableFrames = useRef(0);

  // Sync catalogue search
  useEffect(() => {
    setCatalogueResults(allEntities);
  }, [allEntities]);

  const handleSearch = useCallback(
    async (q: string) => {
      setSearchQuery(q);
      setSearchPending(true);
      const results = await searchEntities(q);
      setCatalogueResults(results);
      setSearchPending(false);
    },
    [searchEntities]
  );

  // Build layout when graph data arrives
  useEffect(() => {
    if (!graph || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 500;
    canvas.width = w;
    canvas.height = h;
    layoutRef.current = initLayout(graph.nodes, graph.edges, w, h);
    stableFrames.current = 0;
  }, [graph]);

  // Animation loop
  useEffect(() => {
    if (viewMode !== "graph" || !graph) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const MAX_STABLE = 300; // stop physics after ~5s of micro-movements

    const loop = () => {
      tickRef.current++;
      const w = canvas.width;
      const h = canvas.height;

      if (stableFrames.current < MAX_STABLE) {
        layoutRef.current = runForce(layoutRef.current, graph.edges, w, h);
        stableFrames.current++;
      }

      ctx.clearRect(0, 0, w, h);

      // Draw edges
      for (const edge of graph.edges) {
        const src = layoutRef.current.find((n) => n.id === edge.source);
        const tgt = layoutRef.current.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = "rgba(100,120,150,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Edge label
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        ctx.fillStyle = "rgba(148,163,184,0.55)";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(edge.relation, mx, my);
      }

      // Draw nodes
      for (const n of layoutRef.current) {
        // Apply filter
        if (!passesFilter(n, filterMode)) continue;
        drawNode(ctx, n, n.id === selectedNodeId, tickRef.current);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [graph, viewMode, filterMode, selectedNodeId]);

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const n of layoutRef.current) {
        const dx = mx - n.x;
        const dy = my - n.y;
        if (Math.sqrt(dx * dx + dy * dy) <= n.radius + 4) {
          setSelectedNodeId((prev) => (prev === n.id ? null : n.id));
          return;
        }
      }
      setSelectedNodeId(null);
    },
    []
  );

  const handleCanvasDblClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !onJumpToLocation) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const n of layoutRef.current) {
        const dx = mx - n.x;
        const dy = my - n.y;
        if (Math.sqrt(dx * dx + dy * dy) <= n.radius + 4) {
          if (n.active && n.lat != null && n.lng != null) {
            onJumpToLocation(n.lat, n.lng);
          }
          return;
        }
      }
    },
    [onJumpToLocation]
  );

  // Canvas resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      if (!graph) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w;
      canvas.height = h;
      layoutRef.current = initLayout(graph.nodes, graph.edges, w, h);
      stableFrames.current = 0;
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [graph]);

  if (!isOpen) return null;

  const selectedNode = graph?.nodes.find((n) => n.id === selectedNodeId);
  const selectedEntry = allEntities.find((e) => e.id === selectedNodeId);

  const filteredCatalogue = catalogueResults.filter((e) => {
    if (filterMode === "active") {
      return graph?.nodes.find((n) => n.id === e.id)?.active;
    }
    if (filterMode === "sanctioned") return e.sanctioned;
    if (filterMode === "individual") return e.owner_type === "individual";
    if (filterMode === "company") return e.owner_type === "company";
    return true;
  });

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-[1400px] h-full max-h-[90vh] bg-[var(--bg-primary)] border border-cyan-800/50 rounded-xl shadow-[0_0_60px_rgba(0,255,255,0.12)] flex flex-col overflow-hidden">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <Network size={16} className="text-cyan-400" />
            <span className="text-[11px] font-mono tracking-widest text-cyan-400">
              ENTITY RELATIONSHIP GRAPH
            </span>
            {graph && (
              <span className="text-[9px] font-mono text-[var(--text-muted)]">
                {graph.stats.total_nodes} nodes · {graph.stats.total_edges} edges · {graph.stats.active_assets} active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-1 border border-[var(--border-primary)] rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("graph")}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-mono tracking-widest transition-colors ${
                  viewMode === "graph"
                    ? "bg-cyan-500/15 text-cyan-400"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <Network size={10} />
                GRAPH
              </button>
              <button
                onClick={() => setViewMode("catalogue")}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-mono tracking-widest transition-colors ${
                  viewMode === "catalogue"
                    ? "bg-cyan-500/15 text-cyan-400"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <Table size={10} />
                CATALOGUE
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={refetch}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-mono tracking-widest border border-[var(--border-primary)] rounded-lg hover:border-cyan-800 text-[var(--text-muted)] hover:text-cyan-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
              REFRESH
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 border border-[var(--border-primary)] rounded-lg hover:border-red-500/50 text-[var(--text-muted)] hover:text-red-400 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-primary)] flex-shrink-0">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 max-w-xs bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded-lg px-2.5 py-1.5">
            <Search size={10} className="text-[var(--text-muted)] flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search entities…"
              className="flex-1 bg-transparent text-[10px] font-mono text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none"
            />
            {searchPending && <RefreshCw size={8} className="animate-spin text-cyan-400" />}
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1">
            {(["all", "active", "sanctioned", "individual", "company"] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilterMode(f)}
                className={`px-2 py-1 text-[8px] font-mono tracking-widest rounded border transition-colors ${
                  filterMode === f
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-400"
                    : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-950/40 border-b border-red-900/40 text-[9px] font-mono text-red-400 flex-shrink-0">
            <AlertCircle size={12} />
            {error}
          </div>
        )}

        <div className="flex flex-1 min-h-0">

          {/* ── Graph view ─────────────────────────────────────────────── */}
          {viewMode === "graph" && (
            <>
              <div className="relative flex-1 min-w-0">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400">
                      <RefreshCw size={12} className="animate-spin" />
                      LOADING GRAPH…
                    </div>
                  </div>
                )}
                {!graph && !loading && (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-[var(--text-muted)]">
                    No data — click REFRESH
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair"
                  onClick={handleCanvasClick}
                  onDoubleClick={handleCanvasDblClick}
                />

                {/* Legend */}
                <div className="absolute bottom-3 left-3 flex flex-col gap-1 bg-[var(--bg-primary)]/80 backdrop-blur-sm border border-[var(--border-primary)] rounded-lg px-3 py-2">
                  <span className="text-[8px] font-mono tracking-widest text-[var(--text-muted)] mb-1">LEGEND</span>
                  {[
                    { color: "#facc15", shape: "●", label: "Individual" },
                    { color: "#60a5fa", shape: "■", label: "Company / Org" },
                    { color: "#2dd4bf", shape: "◆", label: "Aircraft" },
                    { color: "#1e40af", shape: "◆", label: "Yacht / Ship" },
                    { color: "#ef4444", shape: "●", label: "Sanctioned" },
                  ].map(({ color, shape, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span style={{ color }} className="text-sm leading-none">{shape}</span>
                      <span className="text-[8px] font-mono text-[var(--text-muted)]">{label}</span>
                    </div>
                  ))}
                  <div className="mt-1 pt-1 border-t border-[var(--border-primary)] text-[7px] font-mono text-[var(--text-muted)]">
                    Click = select · Dbl-click = jump to map
                  </div>
                </div>
              </div>

              {/* Node detail panel */}
              {selectedNode && (
                <div className="w-72 flex-shrink-0 border-l border-[var(--border-primary)] p-4 overflow-y-auto styled-scrollbar">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono tracking-widest text-cyan-400">NODE DETAIL</span>
                    <button
                      onClick={() => setSelectedNodeId(null)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <X size={10} />
                    </button>
                  </div>

                  <NodeDetailPanel
                    node={selectedNode}
                    entry={selectedEntry ?? null}
                    onJumpToLocation={onJumpToLocation}
                  />
                </div>
              )}
            </>
          )}

          {/* ── Catalogue view ─────────────────────────────────────────── */}
          {viewMode === "catalogue" && (
            <div className="flex-1 overflow-auto styled-scrollbar">
              <table className="w-full text-[9px] font-mono">
                <thead className="sticky top-0 bg-[var(--bg-primary)] z-10">
                  <tr className="border-b border-[var(--border-primary)]">
                    {["ASSET ID", "NAME", "OWNER", "AFFILIATION", "NATIONALITY", "TYPE", "ACTIVE", "SANCTIONED"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[8px] tracking-widest text-[var(--text-muted)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalogue.map((e) => {
                    const isActive = !!graph?.nodes.find((n) => n.id === e.id)?.active;
                    const isSelected = e.id === selectedNodeId;
                    return (
                      <tr
                        key={e.id}
                        onClick={() => { setSelectedNodeId(e.id); setViewMode("graph"); }}
                        className={`border-b border-[var(--border-primary)]/40 cursor-pointer transition-colors hover:bg-cyan-500/5 ${
                          isSelected ? "bg-cyan-500/10" : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-cyan-400">{e.id}</td>
                        <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[160px] truncate">{e.name}</td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{e.owner}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)] max-w-[140px] truncate">{e.affiliation}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">{e.nationality}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[7px] tracking-widest ${
                            e.asset_type === "superyacht" || e.asset_type === "ship"
                              ? "bg-blue-900/40 text-blue-300"
                              : "bg-teal-900/40 text-teal-300"
                          }`}>
                            {e.asset_type.replace("_", " ").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">{isActive ? "✅" : "—"}</td>
                        <td className="px-3 py-2 text-center">{e.sanctioned ? "🔴" : "—"}</td>
                      </tr>
                    );
                  })}
                  {filteredCatalogue.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-[var(--text-muted)]">
                        No entities match current filter
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Node detail sub-component ─────────────────────────────────────────────────

function passesFilter(node: LayoutNode, mode: FilterMode): boolean {
  if (mode === "all") return true;
  if (mode === "active") return !!node.active;
  if (mode === "sanctioned") return !!node.sanctioned;
  if (mode === "individual") return node.type === "individual";
  if (mode === "company") return node.type === "company";
  return true;
}

interface NodeDetailProps {
  node: EntityNode;
  entry: import("@/hooks/useEntityGraph").EntityEntry | null;
  onJumpToLocation?: (lat: number, lng: number) => void;
}

function NodeDetailPanel({ node, entry, onJumpToLocation }: NodeDetailProps) {
  const color = node.sanctioned ? "#ef4444" : (NODE_COLORS[node.type] ?? "#94a3b8");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[10px] font-mono text-[var(--text-primary)] break-words">{node.label}</span>
      </div>

      {node.active && (
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          CURRENTLY ACTIVE
          {node.lat != null && node.lng != null && onJumpToLocation && (
            <button
              onClick={() => onJumpToLocation(node.lat!, node.lng!)}
              className="ml-auto px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-[8px] text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            >
              JUMP TO MAP
            </button>
          )}
        </div>
      )}

      {node.sanctioned && (
        <div className="text-[9px] font-mono text-red-400 bg-red-950/30 border border-red-800/40 rounded px-2 py-1">
          ⚠ SANCTIONED ENTITY
        </div>
      )}

      <div className="flex flex-col gap-1.5 text-[9px] font-mono">
        {[
          ["ID", node.id],
          ["TYPE", node.type],
          ...(node.owner ? [["OWNER", node.owner]] : []),
          ...(node.nationality ? [["NATIONALITY", node.nationality]] : []),
          ...(entry?.affiliation ? [["AFFILIATION", entry.affiliation]] : []),
          ...(entry?.notes ? [["NOTES", entry.notes]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-[var(--text-muted)] min-w-[80px]">{k}</span>
            <span className="text-[var(--text-secondary)] break-words">{v}</span>
          </div>
        ))}
      </div>

      {entry?.related && entry.related.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-[var(--text-muted)] mb-1 tracking-widest">RELATED ENTITIES</div>
          <div className="flex flex-wrap gap-1">
            {entry.related.map((r) => (
              <span
                key={r}
                className="px-1.5 py-0.5 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded text-[8px] font-mono text-[var(--text-muted)]"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
