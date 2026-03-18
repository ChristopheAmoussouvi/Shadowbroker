"use client";

import { Download, RefreshCw, ExternalLink, X } from "lucide-react";
import { useUpdateChecker } from "@/hooks/useUpdateChecker";

interface TopRightControlsProps {
    /** Called whenever the update availability changes (true = update available). */
    onUpdateStatusChange?: (available: boolean) => void;
}

/**
 * TopRightControls renders only the update confirmation and error dialog overlays.
 * The visible button row has moved to IconDock.
 */
export default function TopRightControls({ onUpdateStatusChange }: TopRightControlsProps) {
    const {
        updateStatus,
        setUpdateStatus,
        latestVersion,
        errorMessage,
        currentVersion,
        triggerUpdate,
    } = useUpdateChecker(onUpdateStatusChange);

    // ── Confirmation Dialog ──
    const renderConfirmDialog = () => (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 z-[9999]">
            <div className="bg-[var(--bg-primary)]/95 backdrop-blur-md border border-cyan-800/60 rounded-lg shadow-[0_4px_30px_rgba(0,255,255,0.15)] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
                    <span className="text-[10px] font-mono tracking-widest text-cyan-400">
                        UPDATE v{currentVersion} → v{latestVersion}
                    </span>
                    <button
                        onClick={() => setUpdateStatus("available")}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        aria-label="Close update dialog"
                    >
                        <X size={12} />
                    </button>
                </div>

                {/* Actions */}
                <div className="p-3 flex flex-col gap-2">
                    <button
                        onClick={triggerUpdate}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/40 rounded-md hover:bg-cyan-500/20 transition-all text-[10px] text-cyan-400 font-mono tracking-widest"
                    >
                        <Download size={12} />
                        AUTO UPDATE
                    </button>

                    <a
                        href="https://github.com/BigBodyCobain/Shadowbroker/releases/latest"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] rounded-md hover:border-[var(--text-muted)] transition-all text-[10px] text-[var(--text-muted)] font-mono tracking-widest"
                    >
                        <ExternalLink size={12} />
                        MANUAL DOWNLOAD
                    </a>

                    <button
                        onClick={() => setUpdateStatus("available")}
                        className="w-full flex items-center justify-center px-3 py-1.5 text-[9px] text-[var(--text-muted)] font-mono tracking-widest hover:text-[var(--text-secondary)] transition-colors"
                    >
                        CANCEL
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Error Dialog ──
    const renderErrorDialog = () => (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 z-[9999]">
            <div className="bg-[var(--bg-primary)]/95 backdrop-blur-md border border-red-800/60 rounded-lg shadow-[0_4px_30px_rgba(255,0,0,0.1)] overflow-hidden">
                <div className="px-3 py-2 border-b border-red-900/40">
                    <span className="text-[10px] font-mono tracking-widest text-red-400">
                        UPDATE FAILED
                    </span>
                </div>
                <div className="p-3 flex flex-col gap-2">
                    <p className="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed break-words">
                        {errorMessage}
                    </p>
                    <button
                        onClick={() => setUpdateStatus("confirming")}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/40 rounded-md hover:bg-cyan-500/20 transition-all text-[10px] text-cyan-400 font-mono tracking-widest"
                    >
                        <RefreshCw size={12} />
                        TRY AGAIN
                    </button>
                    <a
                        href="https://github.com/BigBodyCobain/Shadowbroker/releases/latest"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] rounded-md hover:border-[var(--text-muted)] transition-all text-[10px] text-[var(--text-muted)] font-mono tracking-widest"
                    >
                        <ExternalLink size={12} />
                        MANUAL DOWNLOAD
                    </a>
                </div>
            </div>
        </div>
    );

    // Only render dialogs — the button row lives in IconDock
    if (updateStatus === "confirming") return renderConfirmDialog();
    if (updateStatus === "update_error") return renderErrorDialog();
    return null;
}
