"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SHORTCUTS: { key: string; action: string }[] = [
    { key: "H", action: "Toggle HUD visibility" },
    { key: "L", action: "Toggle left panel" },
    { key: "F or Ctrl+K", action: "Focus search bar" },
    { key: "R", action: "Force data refresh" },
    { key: "M", action: "Toggle measure mode" },
    { key: "S", action: "Open settings" },
    { key: "G", action: "Toggle map legend" },
    { key: "E", action: "Open entity graph" },
    { key: "Esc", action: "Close panels / modals" },
    { key: "?", action: "Show this help" },
];

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[9500] bg-black/60 backdrop-blur-sm flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto styled-scrollbar"
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ duration: 0.15 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <span className="font-mono text-[11px] tracking-widest text-cyan-400 uppercase">
                                Keyboard Shortcuts
                            </span>
                            <button
                                onClick={onClose}
                                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                                aria-label="Close keyboard shortcuts"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Shortcut list */}
                        <div className="flex flex-col gap-1.5">
                            {SHORTCUTS.map(({ key, action }) => (
                                <div
                                    key={key}
                                    className="flex items-center justify-between gap-4 px-2 py-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]/40"
                                >
                                    <kbd className="px-2 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded text-[10px] font-mono text-cyan-400 whitespace-nowrap">
                                        {key}
                                    </kbd>
                                    <span className="text-[10px] font-mono text-[var(--text-muted)] text-right">
                                        {action}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
