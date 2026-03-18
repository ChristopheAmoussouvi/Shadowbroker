"use client";

import { useEffect } from "react";

export interface ShortcutHandlers {
    onToggleHUD: () => void;
    onFocusSearch: () => void;
    onForceRefresh: () => void;
    onToggleLeftPanel: () => void;
    onToggleMeasure: () => void;
    onEscape: () => void;
    onToggleSettings: () => void;
    onToggleLegend: () => void;
    onToggleEntityGraph: () => void;
    onShowShortcuts: () => void;
}

export function useKeyboardShortcuts(
    handlers: ShortcutHandlers,
    modalOpen: boolean
) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Ignore when typing in an input, textarea, or contenteditable
            const target = e.target as HTMLElement;
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return;
            }

            // Ignore most shortcuts when a modal is open (except Escape)
            if (modalOpen && e.key !== "Escape") return;

            const key = e.key.toUpperCase();

            // Ctrl+K / Cmd+K — focus search
            if ((e.ctrlKey || e.metaKey) && key === "K") {
                e.preventDefault();
                handlers.onFocusSearch();
                return;
            }

            // Ignore modifier combos for single-key shortcuts
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            switch (key) {
                case "H":
                    handlers.onToggleHUD();
                    break;
                case "F":
                    handlers.onFocusSearch();
                    break;
                case "R":
                    handlers.onForceRefresh();
                    break;
                case "L":
                    handlers.onToggleLeftPanel();
                    break;
                case "M":
                    handlers.onToggleMeasure();
                    break;
                case "ESCAPE":
                    handlers.onEscape();
                    break;
                case "S":
                    handlers.onToggleSettings();
                    break;
                case "G":
                    handlers.onToggleLegend();
                    break;
                case "E":
                    handlers.onToggleEntityGraph();
                    break;
                case "?":
                    handlers.onShowShortcuts();
                    break;
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [handlers, modalOpen]);
}
