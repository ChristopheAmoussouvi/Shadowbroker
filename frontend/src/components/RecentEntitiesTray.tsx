"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RecentEntry } from "@/hooks/useRecentEntities";

interface RecentEntitiesTrayProps {
  entries: RecentEntry[];
  onSelect: (entry: RecentEntry) => void;
  onClear: () => void;
}

export default function RecentEntitiesTray({
  entries,
  onSelect,
  onClear,
}: RecentEntitiesTrayProps) {
  if (entries.length === 0) return null;

  return (
    <div className="absolute bottom-[9.5rem] left-1/2 -translate-x-1/2 z-[200] pointer-events-auto">
      <div className="flex items-center gap-2 bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-primary)] rounded-xl px-3 py-1.5 max-w-[600px] overflow-hidden">
        {/* Label */}
        <span className="text-[8px] font-mono tracking-widest text-[var(--text-muted)] flex-shrink-0">
          RECENT
        </span>

        {/* Scrollable chips */}
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.button
                key={`${entry.type}-${entry.id}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => onSelect(entry)}
                className="flex items-center gap-1 bg-[var(--bg-secondary)]/60 hover:bg-cyan-950/40 border border-[var(--border-primary)] hover:border-cyan-500/40 rounded-md px-2 py-0.5 cursor-pointer transition-colors flex-shrink-0"
              >
                <span className="text-[10px]">{entry.icon}</span>
                <span className="text-[9px] font-mono text-[var(--text-secondary)] max-w-[80px] truncate">
                  {entry.label}
                </span>
                <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase">
                  {entry.type.replace(/_/g, " ")}
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Clear button */}
        <button
          onClick={onClear}
          className="text-[var(--text-muted)] hover:text-red-400 transition-colors text-[10px] flex-shrink-0 ml-1"
          title="Clear recent entities"
        >
          ×
        </button>
      </div>
    </div>
  );
}
