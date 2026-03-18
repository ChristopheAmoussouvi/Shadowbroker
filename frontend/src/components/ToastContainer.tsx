"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, CheckCircle2, AlertTriangle, AlertCircle, Bell, X } from "lucide-react";
import {
    type Toast,
    type ToastType,
    subscribeToasts,
    dismissToast,
} from "@/lib/toast";

// Per-type styles
const TYPE_STYLES: Record<ToastType, { bg: string; border: string; text: string; strip: string }> = {
    info: {
        bg: "bg-[var(--bg-secondary)]/90",
        border: "border-[var(--border-primary)]",
        text: "text-[var(--text-secondary)]",
        strip: "bg-cyan-500/60",
    },
    success: {
        bg: "bg-green-950/90",
        border: "border-green-500/40",
        text: "text-green-400",
        strip: "bg-green-500",
    },
    warning: {
        bg: "bg-amber-950/90",
        border: "border-amber-500/40",
        text: "text-amber-400",
        strip: "bg-amber-500",
    },
    error: {
        bg: "bg-red-950/90",
        border: "border-red-500/40",
        text: "text-red-400",
        strip: "bg-red-500",
    },
    alert: {
        bg: "bg-cyan-950/90",
        border: "border-cyan-500/40",
        text: "text-cyan-400",
        strip: "bg-cyan-500",
    },
};

const TYPE_ICONS: Record<ToastType, React.ReactNode> = {
    info: <Info size={13} />,
    success: <CheckCircle2 size={13} />,
    warning: <AlertTriangle size={13} />,
    error: <AlertCircle size={13} />,
    alert: <Bell size={13} />,
};

interface ToastCardProps {
    toast: Toast;
}

function ToastCard({ toast }: ToastCardProps) {
    const styles = TYPE_STYLES[toast.type];
    const duration = toast.duration ?? 4000;
    const persistent = duration === 0;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!persistent) {
            timerRef.current = setTimeout(() => dismissToast(toast.id), duration);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [toast.id, duration, persistent]);

    const timeStr = new Date(toast.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto w-80 max-w-sm flex rounded-lg border backdrop-blur-md overflow-hidden ${styles.bg} ${styles.border}`}
        >
            {/* Colored left strip */}
            <div className={`w-1 flex-shrink-0 ${styles.strip}`} />

            {/* Content */}
            <div className="flex-1 p-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className={`flex items-center gap-1.5 ${styles.text}`}>
                        {TYPE_ICONS[toast.type]}
                        <span className="text-[11px] font-mono font-bold tracking-widest truncate">
                            {toast.title}
                        </span>
                    </div>
                    <button
                        onClick={() => dismissToast(toast.id)}
                        className="text-[var(--text-muted)] hover:text-white transition-colors flex-shrink-0 mt-0.5"
                        aria-label="Dismiss notification"
                    >
                        <X size={12} />
                    </button>
                </div>

                {toast.body && (
                    <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1 leading-relaxed break-words">
                        {toast.body}
                    </p>
                )}

                <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[9px] text-[var(--text-muted)] font-mono">{timeStr}</span>
                    {persistent && (
                        <button
                            onClick={() => dismissToast(toast.id)}
                            className="text-[9px] font-mono text-[var(--text-muted)] hover:text-white tracking-widest transition-colors"
                        >
                            DISMISS
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

export default function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const unsub = subscribeToasts(setToasts);
        return unsub;
    }, []);

    return (
        <div className="fixed bottom-6 right-14 z-[9000] flex flex-col gap-2 items-end pointer-events-none">
            <AnimatePresence initial={false}>
                {toasts.map((toast) => (
                    <ToastCard key={toast.id} toast={toast} />
                ))}
            </AnimatePresence>
        </div>
    );
}
