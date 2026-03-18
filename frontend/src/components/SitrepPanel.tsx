"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bot,
    X,
    RefreshCw,
    Copy,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Settings,
    Clock,
    Cpu,
    Zap,
    AlertCircle,
} from "lucide-react";
import { useSitrep } from "@/hooks/useSitrep";
import type { SitrepEntry } from "@/hooks/useSitrep";

interface SitrepPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings: () => void;
}

/** Very simple markdown renderer for the SITREP format */
function renderMarkdown(text: string): React.ReactNode[] {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
        // ## H2
        if (line.startsWith("## ")) {
            return (
                <h2
                    key={idx}
                    className="text-[13px] font-bold font-mono text-cyan-300 mt-4 mb-1 tracking-wide border-b border-cyan-900/40 pb-1"
                >
                    {line.slice(3)}
                </h2>
            );
        }
        // ### H3
        if (line.startsWith("### ")) {
            return (
                <h3 key={idx} className="text-[11px] font-bold font-mono text-cyan-400/80 mt-3 mb-0.5 tracking-wider uppercase">
                    {line.slice(4)}
                </h3>
            );
        }
        // Empty line
        if (line.trim() === "") {
            return <div key={idx} className="h-1" />;
        }
        // Normal line — handle **bold** and emoji
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
            <p key={idx} className="text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed">
                {parts.map((part, pi) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                        return (
                            <strong key={pi} className="text-[var(--text-primary)] font-bold">
                                {part.slice(2, -2)}
                            </strong>
                        );
                    }
                    return <span key={pi}>{part}</span>;
                })}
            </p>
        );
    });
}

function SitrepMetaBar({ sitrep }: { sitrep: SitrepEntry }) {
    const generated = new Date(sitrep.generated_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    return (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-[var(--bg-primary)]/40 border-b border-[var(--border-primary)]/60 text-[8px] font-mono text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
                <Clock size={9} />
                {generated}
            </span>
            <span className="flex items-center gap-1">
                <Bot size={9} />
                {sitrep.model}
            </span>
            <span className="flex items-center gap-1">
                <Cpu size={9} />
                {sitrep.tokens_used.toLocaleString()} tokens
            </span>
            <span className="flex items-center gap-1">
                <Zap size={9} />
                {(sitrep.duration_ms / 1000).toFixed(1)}s
            </span>
            <span className="px-1.5 py-0.5 rounded border border-[var(--border-primary)] text-[7px] uppercase">
                {sitrep.provider}
            </span>
        </div>
    );
}

export default function SitrepPanel({ isOpen, onClose, onOpenSettings }: SitrepPanelProps) {
    const { history, currentSitrep, setCurrentSitrep, generating, generateError, historyLoading, generateNew } =
        useSitrep();

    const [historyOpen, setHistoryOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        if (!currentSitrep) return;
        try {
            await navigator.clipboard.writeText(currentSitrep.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* ignore */
        }
    }, [currentSitrep]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
                        onClick={onClose}
                    />

                    {/* Slide-over panel from right */}
                    <motion.div
                        initial={{ opacity: 0, x: 480 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 480 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed right-0 top-0 bottom-0 w-[480px] bg-[var(--bg-secondary)]/95 backdrop-blur-xl border-l border-cyan-900/50 z-[9999] flex flex-col shadow-[-4px_0_40px_rgba(0,0,0,0.3)]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]/80 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                                    <Bot size={16} className="text-cyan-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold tracking-[0.2em] text-[var(--text-primary)] font-mono">
                                        AI SITREP
                                    </h2>
                                    <span className="text-[9px] text-[var(--text-muted)] font-mono tracking-widest">
                                        LLM SITUATION REPORT
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onOpenSettings}
                                    title="Configure AI"
                                    className="flex items-center gap-1 px-2 py-1.5 rounded border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-cyan-400 hover:border-cyan-500/50 transition-all text-[9px] font-mono"
                                >
                                    <Settings size={11} />
                                    CONFIGURE
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-lg border border-[var(--border-primary)] hover:border-red-500/50 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition-all hover:bg-red-950/20"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="p-4 border-b border-[var(--border-primary)]/60 flex-shrink-0">
                            <button
                                onClick={generateNew}
                                disabled={generating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/25 transition-all text-[11px] font-mono font-bold tracking-widest disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,255,255,0.05)]"
                            >
                                {generating ? (
                                    <>
                                        <RefreshCw size={13} className="animate-spin" />
                                        GENERATING SITREP...
                                    </>
                                ) : (
                                    <>
                                        <Bot size={13} />
                                        GENERATE NEW SITREP
                                    </>
                                )}
                            </button>
                            {generateError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-2 flex items-start gap-2 px-3 py-2 rounded border border-red-900/40 bg-red-950/20 text-[10px] font-mono text-red-400"
                                >
                                    <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
                                    <span>{generateError}</span>
                                </motion.div>
                            )}
                        </div>

                        {/* SITREP Content */}
                        <div className="flex-1 overflow-y-auto styled-scrollbar min-h-0">
                            {!currentSitrep && !historyLoading ? (
                                /* Empty state */
                                <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                                    <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                        <Bot size={28} className="text-cyan-400/60" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-mono text-[var(--text-secondary)] mb-2">
                                            No SITREP generated yet
                                        </p>
                                        <p className="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed max-w-[280px]">
                                            Configure your AI provider in Settings → AI / SITREP, then click
                                            &quot;Generate New SITREP&quot; to receive an LLM-powered analysis of live global data.
                                        </p>
                                    </div>
                                    <button
                                        onClick={onOpenSettings}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 transition-colors text-[10px] font-mono"
                                    >
                                        <Settings size={11} />
                                        CONFIGURE AI
                                    </button>
                                </div>
                            ) : currentSitrep ? (
                                <>
                                    {/* Metadata bar */}
                                    <SitrepMetaBar sitrep={currentSitrep} />

                                    {/* Copy button */}
                                    <div className="flex justify-end px-4 pt-2">
                                        <button
                                            onClick={handleCopy}
                                            className="flex items-center gap-1 text-[9px] font-mono text-[var(--text-muted)] hover:text-cyan-400 transition-colors"
                                        >
                                            {copied ? (
                                                <>
                                                    <CheckCircle2 size={10} className="text-green-400" />
                                                    <span className="text-green-400">COPIED</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={10} />
                                                    COPY
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Markdown content */}
                                    <div className="px-4 pb-4 pt-1">
                                        {renderMarkdown(currentSitrep.content)}
                                    </div>
                                </>
                            ) : null}
                        </div>

                        {/* History section */}
                        {history.length > 0 && (
                            <div className="flex-shrink-0 border-t border-[var(--border-primary)]/60">
                                <button
                                    onClick={() => setHistoryOpen(!historyOpen)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-secondary)]/50 transition-colors"
                                >
                                    <span className="text-[9px] font-mono tracking-widest text-[var(--text-muted)]">
                                        HISTORY ({history.length})
                                    </span>
                                    {historyOpen ? (
                                        <ChevronDown size={12} className="text-[var(--text-muted)]" />
                                    ) : (
                                        <ChevronUp size={12} className="text-[var(--text-muted)]" />
                                    )}
                                </button>
                                <AnimatePresence>
                                    {historyOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="max-h-48 overflow-y-auto styled-scrollbar">
                                                {history.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => {
                                                            setCurrentSitrep(item);
                                                            setHistoryOpen(false);
                                                        }}
                                                        className={`w-full flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-primary)]/40 hover:bg-cyan-950/20 transition-colors ${
                                                            currentSitrep?.id === item.id ? "bg-cyan-950/10" : ""
                                                        }`}
                                                    >
                                                        <div className="text-left">
                                                            <div className="text-[9px] font-mono text-[var(--text-secondary)] truncate max-w-[280px]">
                                                                {new Date(item.generated_at).toLocaleString("en-US", {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                    hour12: false,
                                                                })}
                                                            </div>
                                                            <div className="text-[8px] font-mono text-[var(--text-muted)]">
                                                                {item.model} · {item.tokens_used.toLocaleString()} tokens
                                                            </div>
                                                        </div>
                                                        {currentSitrep?.id === item.id && (
                                                            <CheckCircle2 size={10} className="text-cyan-400 flex-shrink-0" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
