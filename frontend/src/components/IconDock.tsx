"use client";

import { motion } from "framer-motion";
import {
    Github,
    MessageSquare,
    Network,
    Bell,
    Clock,
    Settings,
    Map,
    Download,
    EyeOff,
    HelpCircle,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";

interface IconDockProps {
    onEntityGraphClick?: () => void;
    onAlertsClick?: () => void;
    alertUnreadCount?: number;
    onTimelineClick?: () => void;
    onSettingsClick?: () => void;
    onLegendClick?: () => void;
    onHideUI?: () => void;
    updateAvailable?: boolean;
    updateStatus?: string;
    onUpdateClick?: () => void;
    onShowShortcuts?: () => void;
    entityGraphOpen?: boolean;
    settingsOpen?: boolean;
    legendOpen?: boolean;
}

interface DockButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    href?: string;
    isFirst?: boolean;
    isLast?: boolean;
    active?: boolean;
    badge?: number;
    indicator?: React.ReactNode;
    "aria-label"?: string;
}

function DockButton({
    icon,
    label,
    onClick,
    href,
    isFirst,
    isLast,
    active,
    badge,
    indicator,
    "aria-label": ariaLabel,
}: DockButtonProps) {
    const roundedClass = isFirst ? "rounded-tl-md" : isLast ? "rounded-bl-md" : "";
    const activeClass = active
        ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
        : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-cyan-500/50 hover:bg-[var(--hover-accent)] hover:text-cyan-400";

    const commonClass = `group relative flex items-center justify-center w-11 h-11 bg-[var(--bg-primary)]/70 backdrop-blur-md border-l border-t border-b transition-all cursor-pointer ${roundedClass} ${activeClass}`;

    const content = (
        <>
            {icon}
            {/* Tooltip */}
            <span className="absolute right-full mr-2 whitespace-nowrap px-2 py-1 bg-black/80 border border-[var(--border-primary)] text-[10px] font-mono text-cyan-400 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {label}
            </span>
            {/* Badge */}
            {badge !== undefined && badge > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-cyan-500 rounded-full text-[8px] font-mono text-black font-bold flex items-center justify-center px-0.5 pointer-events-none">
                    {badge > 99 ? "99+" : badge}
                </span>
            )}
            {/* Custom indicator (e.g. green dot for update) */}
            {indicator}
        </>
    );

    if (href) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className={commonClass}
                aria-label={ariaLabel ?? label}
            >
                {content}
            </a>
        );
    }

    return (
        <button
            onClick={onClick}
            className={commonClass}
            aria-label={ariaLabel ?? label}
        >
            {content}
        </button>
    );
}

export default function IconDock({
    onEntityGraphClick,
    onAlertsClick,
    alertUnreadCount,
    onTimelineClick,
    onSettingsClick,
    onLegendClick,
    onHideUI,
    updateAvailable,
    updateStatus,
    onUpdateClick,
    onShowShortcuts,
    entityGraphOpen,
    settingsOpen,
    legendOpen,
}: IconDockProps) {
    const updateIcon = () => {
        if (updateStatus === "checking") return <RefreshCw size={16} className="animate-spin" />;
        if (updateStatus === "uptodate") return <CheckCircle2 size={16} className="text-green-400" />;
        if (updateStatus === "error") return <AlertCircle size={16} className="text-red-400" />;
        return <Download size={16} />;
    };

    const updateLabel = () => {
        if (updateStatus === "checking") return "CHECKING...";
        if (updateStatus === "uptodate") return "UP TO DATE";
        if (updateStatus === "error") return "CHECK FAILED";
        if (updateAvailable) return "UPDATE AVAILABLE";
        return "CHECK UPDATES";
    };

    const buttons: DockButtonProps[] = [
        {
            icon: <Github size={16} />,
            label: "GITHUB",
            href: "https://github.com/BigBodyCobain/Shadowbroker",
            isFirst: true,
            "aria-label": "GitHub Repository",
        },
        {
            icon: <MessageSquare size={16} />,
            label: "DISCUSSIONS",
            href: "https://github.com/BigBodyCobain/Shadowbroker/discussions",
            "aria-label": "GitHub Discussions",
        },
        {
            icon: <Network size={16} />,
            label: "ENTITY GRAPH",
            onClick: onEntityGraphClick,
            active: entityGraphOpen,
            "aria-label": "Toggle Entity Graph",
        },
        ...(onAlertsClick
            ? [{
                icon: <Bell size={16} />,
                label: "ALERTS",
                onClick: onAlertsClick,
                badge: alertUnreadCount,
                "aria-label": "Toggle Alerts Panel",
            } as DockButtonProps]
            : []),
        ...(onTimelineClick
            ? [{
                icon: <Clock size={16} />,
                label: "TIMELINE",
                onClick: onTimelineClick,
                "aria-label": "Toggle Event Timeline",
            } as DockButtonProps]
            : []),
        {
            icon: <Settings size={16} />,
            label: "SETTINGS",
            onClick: onSettingsClick,
            active: settingsOpen,
            "aria-label": "Open Settings",
        },
        {
            icon: <Map size={16} />,
            label: "MAP LEGEND",
            onClick: onLegendClick,
            active: legendOpen,
            "aria-label": "Toggle Map Legend",
        },
        {
            icon: updateIcon(),
            label: updateLabel(),
            onClick: onUpdateClick,
            indicator: updateAvailable ? (
                <span className="absolute top-1 right-1 w-2 h-2 animate-pulse bg-green-400 rounded-full pointer-events-none" />
            ) : undefined,
            "aria-label": updateLabel(),
        },
        {
            icon: <EyeOff size={16} />,
            label: "HIDE UI",
            onClick: onHideUI,
            "aria-label": "Hide UI",
        },
        {
            icon: <HelpCircle size={16} />,
            label: "KEYBOARD SHORTCUTS",
            onClick: onShowShortcuts,
            isLast: true,
            "aria-label": "Show Keyboard Shortcuts",
        },
    ];

    return (
        <motion.div
            className="fixed right-0 top-1/2 -translate-y-1/2 z-[210] flex flex-col pointer-events-auto"
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
        >
            {buttons.map((btn, i) => (
                <DockButton key={i} {...btn} />
            ))}
        </motion.div>
    );
}
