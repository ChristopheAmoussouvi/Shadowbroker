"use client";

import { useState, useRef, useEffect } from "react";
import { API_BASE } from "@/lib/api";
import packageJson from "../../package.json";

export type UpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "uptodate"
    | "error"
    | "confirming"
    | "updating"
    | "restarting"
    | "update_error";

export interface UseUpdateCheckerReturn {
    updateStatus: UpdateStatus;
    setUpdateStatus: (s: UpdateStatus) => void;
    latestVersion: string;
    errorMessage: string;
    currentVersion: string;
    checkForUpdates: () => Promise<void>;
    triggerUpdate: () => Promise<void>;
    startRestartPolling: () => void;
}

export function useUpdateChecker(
    onUpdateStatusChange?: (available: boolean) => void
): UseUpdateCheckerReturn {
    const [updateStatus, setUpdateStatusInternal] = useState<UpdateStatus>("idle");
    const [latestVersion, setLatestVersion] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState("");
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentVersion = packageJson.version;

    const setUpdateStatus = (s: UpdateStatus) => {
        setUpdateStatusInternal(s);
        if (onUpdateStatusChange) {
            onUpdateStatusChange(s === "available" || s === "confirming");
        }
    };

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const checkForUpdates = async () => {
        setUpdateStatus("checking");
        try {
            const res = await fetch("https://api.github.com/repos/BigBodyCobain/Shadowbroker/releases/latest");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();

            const latest = data.tag_name?.replace("v", "") || data.name?.replace("v", "");
            const current = currentVersion.replace("v", "");

            if (latest && latest !== current) {
                setLatestVersion(latest);
                setUpdateStatus("available");
            } else {
                setUpdateStatus("uptodate");
                setTimeout(() => setUpdateStatus("idle"), 3000);
            }
        } catch (err) {
            console.error("Update check failed:", err);
            setUpdateStatus("error");
            setTimeout(() => setUpdateStatus("idle"), 3000);
        }
    };

    const startRestartPolling = () => {
        setUpdateStatus("restarting");

        pollRef.current = setInterval(async () => {
            try {
                const h = await fetch(`${API_BASE}/api/health`);
                if (h.ok) {
                    if (pollRef.current) clearInterval(pollRef.current);
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    window.location.reload();
                }
            } catch {
                // Backend still down — keep polling
            }
        }, 3000);

        timeoutRef.current = setTimeout(() => {
            if (pollRef.current) clearInterval(pollRef.current);
            setErrorMessage("Restart timed out — the app may need to be started manually.");
            setUpdateStatus("update_error");
        }, 90000);
    };

    const triggerUpdate = async () => {
        setUpdateStatus("updating");
        setErrorMessage("");
        try {
            const headers: Record<string, string> = {};
            const adminKey = typeof window !== "undefined" ? localStorage.getItem("sb_admin_key") : null;
            if (adminKey) headers["X-Admin-Key"] = adminKey;

            const res = await fetch(`${API_BASE}/api/system/update`, { method: "POST", headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.detail || "Update failed");

            startRestartPolling();
        } catch (err: unknown) {
            const error = err as Error;
            const isNetworkDrop = err instanceof TypeError || error.message === "Failed to fetch";
            if (isNetworkDrop) {
                startRestartPolling();
            } else {
                setErrorMessage(error.message || "Unknown error");
                setUpdateStatus("update_error");
            }
        }
    };

    return {
        updateStatus,
        setUpdateStatus,
        latestVersion,
        errorMessage,
        currentVersion,
        checkForUpdates,
        triggerUpdate,
        startRestartPolling,
    };
}
