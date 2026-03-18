"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Bell, BellOff, CheckCheck, Wifi, WifiOff } from "lucide-react";
import { useAlerts, AlertRule } from "@/hooks/useAlerts";
import { API_BASE } from "@/lib/api";

type Tab = "recent" | "rules";

interface NewRuleForm {
  name: string;
  type: "entity" | "geofence";
  entity_ids: string;
  geofence_south: string;
  geofence_west: string;
  geofence_north: string;
  geofence_east: string;
  geofence_layers: string;
  telegram_chat_id: string;
  discord_webhook_url: string;
  cooldown_seconds: string;
}

const DEFAULT_FORM: NewRuleForm = {
  name: "",
  type: "entity",
  entity_ids: "",
  geofence_south: "",
  geofence_west: "",
  geofence_north: "",
  geofence_east: "",
  geofence_layers: "private_jets,military_flights,ships",
  telegram_chat_id: "",
  discord_webhook_url: "",
  cooldown_seconds: "300",
};

/**
 * AlertPanel — bell icon button with a slide-over panel.
 *
 * Shows:
 *  - "Recent Alerts" tab: list of fired events from the WebSocket stream
 *  - "Manage Rules" tab: CRUD interface for alert rules
 */
export default function AlertPanel() {
  const { alerts, unreadCount, markAllRead, isConnected } = useAlerts();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("recent");
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [form, setForm] = useState<NewRuleForm>(DEFAULT_FORM);
  const [savingRule, setSavingRule] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Fetch rules when switching to rules tab or opening panel
  useEffect(() => {
    if (open && activeTab === "rules") {
      fetchRules();
    }
  }, [open, activeTab]);

  // Mark all read when opening panel
  const handleOpen = () => {
    setOpen(true);
    markAllRead();
  };

  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/rules`);
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch {
      // Network error — leave stale data
    }
    setLoadingRules(false);
  };

  const toggleRule = async (rule: AlertRule) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
      }
    } catch {
      // ignore
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/rules/${ruleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== ruleId));
      }
    } catch {
      // ignore
    }
  };

  const testRule = async (ruleId: string) => {
    try {
      await fetch(`${API_BASE}/api/alerts/test/${ruleId}`, { method: "POST" });
    } catch {
      // ignore
    }
  };

  const submitNewRule = async () => {
    setSavingRule(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name || "Unnamed Alert",
        enabled: true,
        type: form.type,
        entity_ids: form.entity_ids.split(",").map(s => s.trim()).filter(Boolean),
        geofence: form.type === "geofence" ? {
          south: parseFloat(form.geofence_south) || 0,
          west: parseFloat(form.geofence_west) || 0,
          north: parseFloat(form.geofence_north) || 0,
          east: parseFloat(form.geofence_east) || 0,
        } : {},
        geofence_layers: form.geofence_layers.split(",").map(s => s.trim()).filter(Boolean),
        telegram_chat_id: form.telegram_chat_id.trim(),
        discord_webhook_url: form.discord_webhook_url.trim(),
        notify_websocket: true,
        cooldown_seconds: parseInt(form.cooldown_seconds, 10) || 300,
      };
      const res = await fetch(`${API_BASE}/api/alerts/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = await res.json();
        setRules(prev => [...prev, created]);
        setForm(DEFAULT_FORM);
        setShowNewRuleForm(false);
      }
    } catch {
      // ignore
    }
    setSavingRule(false);
  };

  const formatTs = (ts: string | undefined) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return ts;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Bell button ── */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-primary)]/50 backdrop-blur-md border border-[var(--border-primary)] rounded-lg hover:border-cyan-500/50 hover:bg-[var(--hover-accent)] transition-all text-[10px] text-[var(--text-secondary)] font-mono cursor-pointer"
        title="Alert Notifications"
      >
        <Bell size={12} className="text-cyan-400 w-3 h-3" />
        <span className="tracking-widest">ALERTS</span>
        {unreadCount > 0 && (
          <span className="ml-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {!isConnected && (
          <WifiOff size={10} className="text-red-400 w-2.5 h-2.5 ml-0.5" />
        )}
      </button>

      {/* ── Slide-over panel ── */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-[380px] max-h-[75vh] z-[9999] flex flex-col bg-[var(--bg-primary)]/95 backdrop-blur-md border border-cyan-800/60 rounded-lg shadow-[0_4px_30px_rgba(0,255,255,0.15)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={12} className="text-cyan-400" />
              <span className="text-[10px] font-mono tracking-widest text-cyan-400">ALERT SYSTEM</span>
              {isConnected ? (
                <Wifi size={10} className="text-green-400" />
              ) : (
                <WifiOff size={10} className="text-red-400" />
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border-primary)] flex-shrink-0">
            {(["recent", "rules"] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-[9px] font-mono tracking-widest transition-colors ${
                  activeTab === tab
                    ? "text-cyan-400 border-b border-cyan-400"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {tab === "recent" ? "RECENT ALERTS" : "MANAGE RULES"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto styled-scrollbar">
            {activeTab === "recent" && (
              <div className="p-2 flex flex-col gap-1">
                {alerts.length === 0 ? (
                  <div className="py-8 text-center text-[10px] font-mono text-[var(--text-muted)] tracking-widest">
                    <BellOff size={20} className="mx-auto mb-2 opacity-30" />
                    NO ALERTS YET
                  </div>
                ) : (
                  <>
                    <div className="flex justify-end mb-1">
                      <button
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-[9px] font-mono tracking-widest text-[var(--text-muted)] hover:text-cyan-400 transition-colors"
                      >
                        <CheckCheck size={10} />
                        MARK ALL READ
                      </button>
                    </div>
                    {alerts.map((alert, i) => (
                      <div
                        key={`${alert.rule_id}-${i}`}
                        className="px-2 py-1.5 bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] rounded-md"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-mono text-cyan-400 tracking-wide font-semibold truncate max-w-[200px]">
                            {alert.rule_name || "Alert"}
                          </span>
                          <span className="text-[8px] font-mono text-[var(--text-muted)]">
                            {formatTs(alert.timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {alert.layer && (
                            <span className="text-[8px] font-mono text-[var(--text-muted)] bg-cyan-900/30 px-1.5 py-0.5 rounded uppercase tracking-widest">
                              {alert.layer}
                            </span>
                          )}
                          {alert.rule_type && (
                            <span className="text-[8px] font-mono text-[var(--text-muted)] bg-[var(--bg-secondary)]/80 px-1.5 py-0.5 rounded uppercase tracking-widest">
                              {alert.rule_type}
                            </span>
                          )}
                          <span className="text-[9px] font-mono text-[var(--text-secondary)] truncate max-w-[200px]">
                            {alert.entity_label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {activeTab === "rules" && (
              <div className="p-2 flex flex-col gap-2">
                {/* New rule button */}
                <button
                  onClick={() => setShowNewRuleForm(v => !v)}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[9px] font-mono tracking-widest text-cyan-400 border border-dashed border-cyan-800/60 rounded-md hover:border-cyan-500/60 hover:bg-cyan-900/20 transition-all"
                >
                  <Plus size={10} />
                  NEW RULE
                </button>

                {/* New rule form */}
                {showNewRuleForm && (
                  <div className="p-2 bg-[var(--bg-secondary)]/60 border border-cyan-800/40 rounded-md flex flex-col gap-2">
                    <p className="text-[9px] font-mono text-cyan-400 tracking-widest">CREATE ALERT RULE</p>

                    <label className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">NAME</span>
                      <input
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="My Alert"
                        className="w-full bg-[var(--bg-primary)]/80 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-cyan-500/60"
                      />
                    </label>

                    <label className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">TYPE</span>
                      <select
                        value={form.type}
                        onChange={e => setForm(f => ({ ...f, type: e.target.value as "entity" | "geofence" }))}
                        className="w-full bg-[var(--bg-primary)]/80 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-cyan-500/60"
                      >
                        <option value="entity">Entity (ICAO/tail/MMSI/name)</option>
                        <option value="geofence">Geofence (bounding box)</option>
                      </select>
                    </label>

                    {form.type === "entity" && (
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">ENTITY IDs (comma-separated)</span>
                        <input
                          value={form.entity_ids}
                          onChange={e => setForm(f => ({ ...f, entity_ids: e.target.value }))}
                          placeholder="N628TS, AE1234, 123456789"
                          className="w-full bg-[var(--bg-primary)]/80 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-cyan-500/60"
                        />
                      </label>
                    )}

                    {form.type === "geofence" && (
                      <>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(["geofence_south", "geofence_west", "geofence_north", "geofence_east"] as const).map(k => (
                            <label key={k} className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">{k.replace("geofence_", "").toUpperCase()}</span>
                              <input
                                type="number"
                                value={form[k]}
                                onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                                placeholder="0.0"
                                className="w-full bg-[var(--bg-primary)]/80 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-cyan-500/60"
                              />
                            </label>
                          ))}
                        </div>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">LAYERS (comma-separated)</span>
                          <input
                            value={form.geofence_layers}
                            onChange={e => setForm(f => ({ ...f, geofence_layers: e.target.value }))}
                            placeholder="private_jets,military_flights,ships"
                            className="w-full bg-[var(--bg-primary)]/80 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-cyan-500/60"
                          />
                        </label>
                      </>
                    )}

                    <label className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">COOLDOWN (seconds)</span>
                      <input
                        type="number"
                        value={form.cooldown_seconds}
                        onChange={e => setForm(f => ({ ...f, cooldown_seconds: e.target.value }))}
                        min="10"
                        className="w-full bg-[var(--bg-primary)]/80 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-cyan-500/60"
                      />
                    </label>

                    <label className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">TELEGRAM CHAT ID (optional)</span>
                      <input
                        value={form.telegram_chat_id}
                        onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
                        placeholder="-1001234567890"
                        className="w-full bg-[var(--bg-primary)]/80 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-cyan-500/60"
                      />
                    </label>

                    <label className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">DISCORD WEBHOOK URL (optional)</span>
                      <input
                        value={form.discord_webhook_url}
                        onChange={e => setForm(f => ({ ...f, discord_webhook_url: e.target.value }))}
                        placeholder="https://discord.com/api/webhooks/..."
                        className="w-full bg-[var(--bg-primary)]/80 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-cyan-500/60"
                      />
                    </label>

                    <div className="flex gap-1.5 mt-1">
                      <button
                        onClick={submitNewRule}
                        disabled={savingRule}
                        className="flex-1 py-1.5 bg-cyan-500/10 border border-cyan-500/40 rounded text-[9px] font-mono tracking-widest text-cyan-400 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                      >
                        {savingRule ? "SAVING..." : "SAVE RULE"}
                      </button>
                      <button
                        onClick={() => { setShowNewRuleForm(false); setForm(DEFAULT_FORM); }}
                        className="px-3 py-1.5 bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] rounded text-[9px] font-mono tracking-widest text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}

                {/* Rules list */}
                {loadingRules ? (
                  <div className="py-4 text-center text-[10px] font-mono text-[var(--text-muted)] tracking-widest">
                    LOADING...
                  </div>
                ) : rules.length === 0 && !showNewRuleForm ? (
                  <div className="py-6 text-center text-[10px] font-mono text-[var(--text-muted)] tracking-widest">
                    NO RULES DEFINED
                  </div>
                ) : (
                  rules.map(rule => (
                    <div
                      key={rule.id}
                      className={`px-2.5 py-2 border rounded-md transition-colors ${
                        rule.enabled
                          ? "border-cyan-800/40 bg-[var(--bg-secondary)]/40"
                          : "border-[var(--border-primary)] bg-[var(--bg-secondary)]/20 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-mono text-[var(--text-primary)] font-semibold truncate">
                            {rule.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[8px] font-mono text-[var(--text-muted)] bg-[var(--bg-secondary)]/80 px-1 py-0.5 rounded uppercase tracking-widest">
                              {rule.type}
                            </span>
                            {rule.type === "entity" && rule.entity_ids.length > 0 && (
                              <span className="text-[8px] font-mono text-[var(--text-muted)] truncate max-w-[150px]">
                                {rule.entity_ids.slice(0, 3).join(", ")}
                                {rule.entity_ids.length > 3 ? ` +${rule.entity_ids.length - 3}` : ""}
                              </span>
                            )}
                            {rule.type === "geofence" && (
                              <span className="text-[8px] font-mono text-[var(--text-muted)]">
                                {rule.geofence_layers.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Test */}
                          <button
                            onClick={() => testRule(rule.id)}
                            title="Send test notification"
                            className="text-[8px] font-mono text-[var(--text-muted)] hover:text-cyan-400 transition-colors px-1.5 py-0.5 border border-[var(--border-primary)] rounded hover:border-cyan-500/40"
                          >
                            TEST
                          </button>
                          {/* Toggle */}
                          <button
                            onClick={() => toggleRule(rule)}
                            title={rule.enabled ? "Disable rule" : "Enable rule"}
                            className={`transition-colors ${rule.enabled ? "text-cyan-400 hover:text-cyan-300" : "text-[var(--text-muted)] hover:text-cyan-400"}`}
                          >
                            {rule.enabled ? <Bell size={11} /> : <BellOff size={11} />}
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => deleteRule(rule.id)}
                            title="Delete rule"
                            className="text-[var(--text-muted)] hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
