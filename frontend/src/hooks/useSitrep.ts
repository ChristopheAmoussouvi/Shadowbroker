"use client";

import { useState, useCallback, useEffect } from "react";
import { API_BASE } from "@/lib/api";

export interface SitrepEntry {
    id: string;
    generated_at: string;
    content: string;
    model: string;
    provider: string;
    tokens_used: number;
    duration_ms: number;
}

export interface LLMConfig {
    provider: string;
    openrouter_api_key: string;
    openrouter_model: string;
    gemini_api_key: string;
    gemini_model: string;
    system_prompt: string;
    temperature: number;
    max_tokens: number;
    sitrep_auto_interval_minutes: number;
    sitrep_focus_layers: string[];
}

export interface ModelInfo {
    id: string;
    name: string;
    context: string;
    tier: string;
}

export interface AvailableModels {
    openrouter: ModelInfo[];
    gemini: ModelInfo[];
}

function getAdminHeaders(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
    if (typeof window !== "undefined") {
        const key = localStorage.getItem("sb_admin_key");
        if (key) h["X-Admin-Key"] = key;
    }
    return h;
}

export function useSitrep() {
    const [history, setHistory] = useState<SitrepEntry[]>([]);
    const [currentSitrep, setCurrentSitrep] = useState<SitrepEntry | null>(null);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/sitrep/history?limit=10`, {
                headers: getAdminHeaders(),
            });
            if (res.ok) {
                const data: SitrepEntry[] = await res.json();
                setHistory(data);
                if (data.length > 0 && !currentSitrep) {
                    setCurrentSitrep(data[0]);
                }
            }
        } catch (e) {
            console.error("Failed to fetch SITREP history", e);
        } finally {
            setHistoryLoading(false);
        }
    }, [currentSitrep]);

    const generateNew = useCallback(async () => {
        setGenerating(true);
        setGenerateError(null);
        try {
            const res = await fetch(`${API_BASE}/api/sitrep/generate`, {
                method: "POST",
                headers: getAdminHeaders(),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Unknown error" }));
                throw new Error(err.detail || "Generation failed");
            }
            const sitrep: SitrepEntry = await res.json();
            setCurrentSitrep(sitrep);
            setHistory((prev) => [sitrep, ...prev.slice(0, 9)]);
            return sitrep;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setGenerateError(msg);
            return null;
        } finally {
            setGenerating(false);
        }
    }, []);

    // Load history on mount
    useEffect(() => {
        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        history,
        currentSitrep,
        setCurrentSitrep,
        generating,
        generateError,
        historyLoading,
        generateNew,
        fetchHistory,
    };
}

export function useLLMConfig() {
    const [config, setConfig] = useState<LLMConfig | null>(null);
    const [models, setModels] = useState<AvailableModels | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        ok: boolean;
        latency_ms: number;
        model: string;
        error: string | null;
    } | null>(null);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/sitrep/config`, {
                headers: getAdminHeaders(),
            });
            if (res.ok) setConfig(await res.json());
        } catch (e) {
            console.error("Failed to fetch LLM config", e);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchModels = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/sitrep/models`);
            if (res.ok) setModels(await res.json());
        } catch (e) {
            console.error("Failed to fetch available models", e);
        }
    }, []);

    const saveConfig = useCallback(
        async (updates: Partial<LLMConfig>) => {
            setSaving(true);
            setSaveMsg(null);
            try {
                const res = await fetch(`${API_BASE}/api/sitrep/config`, {
                    method: "PUT",
                    headers: getAdminHeaders(),
                    body: JSON.stringify(updates),
                });
                if (!res.ok) throw new Error("Save failed");
                const updated: LLMConfig = await res.json();
                setConfig(updated);
                setSaveMsg({ type: "ok", text: "Configuration saved." });
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                setSaveMsg({ type: "err", text: msg });
            } finally {
                setSaving(false);
                setTimeout(() => setSaveMsg(null), 4000);
            }
        },
        []
    );

    const testConnection = useCallback(async (partialConfig?: Partial<LLMConfig>) => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch(`${API_BASE}/api/sitrep/config/test`, {
                method: "POST",
                headers: getAdminHeaders(),
                body: JSON.stringify(partialConfig ?? {}),
            });
            const data = await res.json();
            setTestResult(data);
        } catch {
            setTestResult({ ok: false, latency_ms: 0, model: "", error: "Network error" });
        } finally {
            setTesting(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
        fetchModels();
    }, [fetchConfig, fetchModels]);

    return {
        config,
        setConfig,
        models,
        loading,
        saving,
        saveMsg,
        testing,
        testResult,
        saveConfig,
        testConnection,
        fetchConfig,
    };
}
