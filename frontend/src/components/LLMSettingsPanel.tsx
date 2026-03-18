"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Bot,
    Key,
    Eye,
    EyeOff,
    Save,
    RotateCcw,
    Zap,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    Loader2,
} from "lucide-react";
import { useLLMConfig } from "@/hooks/useSitrep";
import type { LLMConfig, ModelInfo } from "@/hooks/useSitrep";

const DEFAULT_SYSTEM_PROMPT = `You are SITREP, an expert OSINT analyst AI embedded in the Shadowbroker global intelligence platform.

Your role is to analyze real-time global data feeds and produce concise, actionable situation reports (SITREPs) for analysts, journalists, and researchers.

When analyzing data, you should:
1. Identify the most significant events across all data layers
2. Detect patterns, anomalies, and correlations between different data types
3. Assess regional tensions based on military activity, GPS jamming, and seismic data
4. Flag unusual concentrations of private jets or ships that may indicate high-profile gatherings
5. Provide geopolitical context for significant events
6. Rate overall global tension level on a scale of 1-10

Format your SITREP as:
## SITUATION REPORT — {datetime} UTC
### EXECUTIVE SUMMARY
[2-3 sentence overview of the most critical developments]

### KEY EVENTS BY PRIORITY
🔴 CRITICAL: [events requiring immediate attention]
🟠 HIGH: [significant developments]
🟡 MEDIUM: [notable but lower-priority items]

### REGIONAL BREAKDOWN
[By geographic region, highlight notable activity]

### ANOMALIES & PATTERNS
[Unusual correlations or patterns detected]

### GLOBAL TENSION INDEX: X/10
[Brief justification]

Keep the report factual, concise (under 800 words), and avoid speculation beyond what the data supports.`;

const FOCUS_LAYER_OPTIONS = [
    { id: "earthquakes", label: "🌍 Earthquakes" },
    { id: "military_flights", label: "🛩️ Military Flights" },
    { id: "tracked_flights", label: "✈️ Tracked Flights" },
    { id: "gps_jamming", label: "📡 GPS Jamming" },
    { id: "firms_fires", label: "🔥 FIRMS Fires" },
    { id: "internet_outages", label: "🌐 Internet Outages" },
    { id: "ships", label: "🚢 Ships" },
    { id: "uavs", label: "🚁 UAVs/Drones" },
    { id: "news", label: "📰 News Headlines" },
];

const AUTO_INTERVAL_OPTIONS = [
    { value: 0, label: "Disabled" },
    { value: 5, label: "Every 5 minutes" },
    { value: 15, label: "Every 15 minutes" },
    { value: 30, label: "Every 30 minutes" },
    { value: 60, label: "Every hour" },
];

const TIER_COLORS: Record<string, string> = {
    free: "text-green-400 border-green-500/40 bg-green-950/20",
    fast: "text-blue-400 border-blue-500/40 bg-blue-950/20",
    premium: "text-purple-400 border-purple-500/40 bg-purple-950/20",
};

export default function LLMSettingsPanel() {
    const { config, setConfig, models, loading, saving, saveMsg, testing, testResult, saveConfig, testConnection } =
        useLLMConfig();

    // Local editable state
    const [localConfig, setLocalConfig] = useState<LLMConfig | null>(null);
    const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);

    useEffect(() => {
        if (config && !localConfig) {
            setLocalConfig({ ...config });
        }
    }, [config, localConfig]);

    if (loading || !localConfig) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 size={20} className="animate-spin text-cyan-400" />
                <span className="ml-2 text-[11px] font-mono text-[var(--text-muted)]">LOADING CONFIG...</span>
            </div>
        );
    }

    const update = (key: keyof LLMConfig, value: LLMConfig[keyof LLMConfig]) => {
        setLocalConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    };

    const handleSave = async () => {
        if (!localConfig) return;
        await saveConfig(localConfig);
        // Refresh local state from server response
        setConfig(null as unknown as LLMConfig);
        setLocalConfig(null);
    };

    const handleTest = async () => {
        if (!localConfig) return;
        await testConnection(localConfig);
    };

    const handleResetPrompt = () => {
        update("system_prompt", DEFAULT_SYSTEM_PROMPT);
    };

    const toggleFocusLayer = (layerId: string) => {
        const current = localConfig.sitrep_focus_layers ?? [];
        const next = current.includes(layerId)
            ? current.filter((l) => l !== layerId)
            : [...current, layerId];
        update("sitrep_focus_layers", next);
    };

    const currentModels: ModelInfo[] =
        localConfig.provider === "gemini"
            ? (models?.gemini ?? [])
            : (models?.openrouter ?? []);

    return (
        <div className="flex flex-col gap-0 overflow-y-auto styled-scrollbar">
            {/* ── A) Provider Selection ── */}
            <div className="p-4 border-b border-[var(--border-primary)]/60">
                <div className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] mb-3">
                    AI PROVIDER
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {/* OpenRouter Card */}
                    <button
                        onClick={() => update("provider", "openrouter")}
                        className={`flex flex-col gap-2 p-3 rounded-lg border text-left transition-all ${
                            localConfig.provider === "openrouter"
                                ? "border-cyan-500/60 bg-cyan-950/20 shadow-[0_0_12px_rgba(0,255,255,0.1)]"
                                : "border-[var(--border-primary)] hover:border-[var(--border-secondary)] bg-[var(--bg-primary)]/30"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <Bot size={14} className={localConfig.provider === "openrouter" ? "text-cyan-400" : "text-[var(--text-muted)]"} />
                            <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">OpenRouter</span>
                            {localConfig.provider === "openrouter" && (
                                <CheckCircle2 size={10} className="text-cyan-400 ml-auto" />
                            )}
                        </div>
                        <p className="text-[9px] text-[var(--text-muted)] font-mono leading-relaxed">
                            200+ models via one API.{" "}
                            <a
                                href="https://openrouter.ai"
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                openrouter.ai
                            </a>
                        </p>
                    </button>

                    {/* Gemini Card */}
                    <button
                        onClick={() => update("provider", "gemini")}
                        className={`flex flex-col gap-2 p-3 rounded-lg border text-left transition-all ${
                            localConfig.provider === "gemini"
                                ? "border-green-500/60 bg-green-950/20 shadow-[0_0_12px_rgba(34,197,94,0.1)]"
                                : "border-[var(--border-primary)] hover:border-[var(--border-secondary)] bg-[var(--bg-primary)]/30"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <Bot size={14} className={localConfig.provider === "gemini" ? "text-green-400" : "text-[var(--text-muted)]"} />
                            <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">Google Gemini</span>
                            {localConfig.provider === "gemini" && (
                                <CheckCircle2 size={10} className="text-green-400 ml-auto" />
                            )}
                        </div>
                        <p className="text-[9px] text-[var(--text-muted)] font-mono leading-relaxed">
                            Google&apos;s native models.{" "}
                            <a
                                href="https://aistudio.google.com"
                                target="_blank"
                                rel="noreferrer"
                                className="text-green-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                aistudio.google.com
                            </a>
                        </p>
                    </button>
                </div>
            </div>

            {/* ── B) API Key Configuration ── */}
            <div className="p-4 border-b border-[var(--border-primary)]/60">
                <div className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] mb-3">
                    API KEY
                </div>

                {localConfig.provider === "openrouter" ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Key size={10} className="text-cyan-400 flex-shrink-0" />
                            <span className="text-[10px] font-mono text-[var(--text-secondary)]">OpenRouter API Key</span>
                            <a
                                href="https://openrouter.ai/keys"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--text-muted)] hover:text-cyan-400 ml-auto"
                            >
                                <ExternalLink size={10} />
                            </a>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type={showOpenRouterKey ? "text" : "password"}
                                value={localConfig.openrouter_api_key}
                                onChange={(e) => update("openrouter_api_key", e.target.value)}
                                placeholder="sk-or-v1-..."
                                className="flex-1 bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded px-2 py-1.5 text-[10px] font-mono text-[var(--text-secondary)] outline-none focus:border-cyan-700 placeholder:text-[var(--text-muted)]/50"
                            />
                            <button
                                onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                                className="px-2 py-1.5 rounded border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                {showOpenRouterKey ? <EyeOff size={11} /> : <Eye size={11} />}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Key size={10} className="text-green-400 flex-shrink-0" />
                            <span className="text-[10px] font-mono text-[var(--text-secondary)]">Gemini API Key</span>
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--text-muted)] hover:text-green-400 ml-auto"
                            >
                                <ExternalLink size={10} />
                            </a>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type={showGeminiKey ? "text" : "password"}
                                value={localConfig.gemini_api_key}
                                onChange={(e) => update("gemini_api_key", e.target.value)}
                                placeholder="AIza..."
                                className="flex-1 bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded px-2 py-1.5 text-[10px] font-mono text-[var(--text-secondary)] outline-none focus:border-green-700 placeholder:text-[var(--text-muted)]/50"
                            />
                            <button
                                onClick={() => setShowGeminiKey(!showGeminiKey)}
                                className="px-2 py-1.5 rounded border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                {showGeminiKey ? <EyeOff size={11} /> : <Eye size={11} />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Test Connection */}
                <div className="mt-2 flex items-center gap-2">
                    <button
                        onClick={handleTest}
                        disabled={testing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border-primary)] text-[var(--text-muted)] hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-[10px] font-mono disabled:opacity-50"
                    >
                        {testing ? (
                            <Loader2 size={10} className="animate-spin" />
                        ) : (
                            <Zap size={10} />
                        )}
                        TEST CONNECTION
                    </button>
                    {testResult && (
                        <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex items-center gap-1 text-[9px] font-mono ${testResult.ok ? "text-green-400" : "text-red-400"}`}
                        >
                            {testResult.ok ? (
                                <>
                                    <CheckCircle2 size={10} />
                                    {testResult.latency_ms}ms OK
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={10} />
                                    <span className="max-w-[180px] truncate" title={testResult.error ?? ""}>
                                        {testResult.error}
                                    </span>
                                </>
                            )}
                        </motion.div>
                    )}
                </div>
            </div>

            {/* ── C) Model Selection ── */}
            <div className="p-4 border-b border-[var(--border-primary)]/60">
                <div className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] mb-3">
                    MODEL
                </div>
                <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto styled-scrollbar pr-1">
                    {currentModels.map((m) => {
                        const isSelected =
                            localConfig.provider === "openrouter"
                                ? localConfig.openrouter_model === m.id
                                : localConfig.gemini_model === m.id;
                        return (
                            <button
                                key={m.id}
                                onClick={() =>
                                    update(
                                        localConfig.provider === "openrouter" ? "openrouter_model" : "gemini_model",
                                        m.id
                                    )
                                }
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                                    isSelected
                                        ? "border-cyan-500/50 bg-cyan-950/20"
                                        : "border-[var(--border-primary)]/40 hover:border-[var(--border-secondary)] bg-[var(--bg-primary)]/20"
                                }`}
                            >
                                <div className="flex-1">
                                    <div className="text-[10px] font-mono text-[var(--text-primary)]">{m.name}</div>
                                    <div className="text-[8px] font-mono text-[var(--text-muted)]">{m.id}</div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-[8px] font-mono text-[var(--text-muted)]">{m.context}</span>
                                    <span
                                        className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${TIER_COLORS[m.tier] ?? "text-gray-400 border-gray-600"}`}
                                    >
                                        {m.tier.toUpperCase()}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── D) Generation Parameters ── */}
            <div className="p-4 border-b border-[var(--border-primary)]/60">
                <div className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] mb-3">
                    GENERATION PARAMETERS
                </div>

                {/* Temperature */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-[var(--text-secondary)]">Temperature</span>
                        <span className="text-[10px] font-mono text-cyan-400">{localConfig.temperature.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={localConfig.temperature}
                        onChange={(e) => update("temperature", parseFloat(e.target.value))}
                        className="w-full accent-cyan-500"
                    />
                    <div className="flex justify-between text-[8px] font-mono text-[var(--text-muted)] mt-0.5">
                        <span>← Factual</span>
                        <span>Creative →</span>
                    </div>
                </div>

                {/* Max Tokens */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-[var(--text-secondary)]">Max Tokens</span>
                        <span className="text-[10px] font-mono text-cyan-400">{localConfig.max_tokens.toLocaleString()}</span>
                    </div>
                    <input
                        type="range"
                        min={512}
                        max={8192}
                        step={256}
                        value={localConfig.max_tokens}
                        onChange={(e) => update("max_tokens", parseInt(e.target.value, 10))}
                        className="w-full accent-cyan-500"
                    />
                    <div className="flex justify-between text-[8px] font-mono text-[var(--text-muted)] mt-0.5">
                        <span>512</span>
                        <span>8192</span>
                    </div>
                </div>

                {/* Focus Layers */}
                <div>
                    <div className="text-[10px] font-mono text-[var(--text-secondary)] mb-2">SITREP Focus Layers</div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {FOCUS_LAYER_OPTIONS.map((layer) => {
                            const active = (localConfig.sitrep_focus_layers ?? []).includes(layer.id);
                            return (
                                <button
                                    key={layer.id}
                                    onClick={() => toggleFocusLayer(layer.id)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[9px] font-mono transition-all ${
                                        active
                                            ? "border-cyan-500/50 text-cyan-300 bg-cyan-950/20"
                                            : "border-[var(--border-primary)]/40 text-[var(--text-muted)] hover:border-[var(--border-secondary)]"
                                    }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-cyan-400" : "bg-[var(--text-muted)]/30"}`} />
                                    {layer.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── E) System Prompt Editor ── */}
            <div className="p-4 border-b border-[var(--border-primary)]/60">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-[9px] font-mono tracking-widest text-[var(--text-muted)]">SYSTEM PROMPT</div>
                    <button
                        onClick={handleResetPrompt}
                        className="flex items-center gap-1 text-[9px] font-mono text-[var(--text-muted)] hover:text-orange-400 transition-colors"
                    >
                        <RotateCcw size={9} />
                        RESET
                    </button>
                </div>
                <textarea
                    value={localConfig.system_prompt}
                    onChange={(e) => update("system_prompt", e.target.value)}
                    rows={8}
                    className="w-full bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded px-3 py-2 text-[10px] font-mono text-[var(--text-secondary)] outline-none focus:border-cyan-700 resize-y styled-scrollbar"
                    style={{ minHeight: "200px", fontFamily: "monospace" }}
                />
                <div className="text-[8px] font-mono text-[var(--text-muted)] mt-1 text-right">
                    {localConfig.system_prompt.length} chars
                </div>
            </div>

            {/* ── F) Auto-generation ── */}
            <div className="p-4 border-b border-[var(--border-primary)]/60">
                <div className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] mb-3">
                    AUTO-GENERATION
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">Interval:</span>
                    <select
                        value={localConfig.sitrep_auto_interval_minutes}
                        onChange={(e) => update("sitrep_auto_interval_minutes", parseInt(e.target.value, 10))}
                        className="flex-1 bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-[var(--text-secondary)] outline-none focus:border-cyan-700"
                    >
                        {AUTO_INTERVAL_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                {localConfig.sitrep_auto_interval_minutes > 0 && (
                    <p className="text-[9px] font-mono text-cyan-400/70 mt-1.5">
                        Auto-SITREP every {localConfig.sitrep_auto_interval_minutes} min (requires backend support)
                    </p>
                )}
            </div>

            {/* ── G) Save button ── */}
            <div className="p-4">
                {saveMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mb-2 px-3 py-2 rounded text-[10px] font-mono border ${
                            saveMsg.type === "ok"
                                ? "text-green-400 bg-green-950/20 border-green-900/30"
                                : "text-red-400 bg-red-950/20 border-red-900/30"
                        }`}
                    >
                        {saveMsg.text}
                    </motion.div>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 transition-all text-[10px] font-mono font-bold tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? "SAVING..." : "SAVE CONFIGURATION"}
                </button>
            </div>
        </div>
    );
}
