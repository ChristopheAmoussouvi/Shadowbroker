"""
LLM Configuration Service — manages provider selection, API keys, model settings,
and system prompt for the AI SITREP generator.

Configuration is persisted to backend/data/llm_config.json.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "llm_config.json"

DEFAULT_SYSTEM_PROMPT = """You are SITREP, an expert OSINT analyst AI embedded in the Shadowbroker global intelligence platform.

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

Keep the report factual, concise (under 800 words), and avoid speculation beyond what the data supports."""

DEFAULT_CONFIG: dict[str, Any] = {
    "provider": "openrouter",
    "openrouter_api_key": "",
    "openrouter_model": "anthropic/claude-3.5-sonnet",
    "gemini_api_key": "",
    "gemini_model": "gemini-2.0-flash",
    "system_prompt": DEFAULT_SYSTEM_PROMPT,
    "temperature": 0.7,
    "max_tokens": 2048,
    "sitrep_auto_interval_minutes": 0,
    "sitrep_focus_layers": [
        "earthquakes",
        "military_flights",
        "tracked_flights",
        "gps_jamming",
        "firms_fires",
        "internet_outages",
    ],
}

AVAILABLE_MODELS: dict[str, list[dict[str, str]]] = {
    "openrouter": [
        {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "context": "200k", "tier": "premium"},
        {"id": "anthropic/claude-3-haiku", "name": "Claude 3 Haiku", "context": "200k", "tier": "fast"},
        {"id": "openai/gpt-4o", "name": "GPT-4o", "context": "128k", "tier": "premium"},
        {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "context": "128k", "tier": "fast"},
        {"id": "google/gemini-2.0-flash-exp:free", "name": "Gemini 2.0 Flash (Free)", "context": "1M", "tier": "free"},
        {"id": "google/gemini-pro-1.5", "name": "Gemini Pro 1.5", "context": "1M", "tier": "premium"},
        {"id": "meta-llama/llama-3.3-70b-instruct", "name": "Llama 3.3 70B", "context": "128k", "tier": "free"},
        {"id": "meta-llama/llama-3.1-8b-instruct:free", "name": "Llama 3.1 8B (Free)", "context": "128k", "tier": "free"},
        {"id": "mistralai/mistral-large", "name": "Mistral Large", "context": "128k", "tier": "premium"},
        {"id": "mistralai/mistral-nemo:free", "name": "Mistral Nemo (Free)", "context": "128k", "tier": "free"},
        {"id": "deepseek/deepseek-chat", "name": "DeepSeek V3", "context": "64k", "tier": "fast"},
        {"id": "x-ai/grok-2", "name": "Grok 2", "context": "128k", "tier": "premium"},
        {"id": "qwen/qwen-2.5-72b-instruct", "name": "Qwen 2.5 72B", "context": "128k", "tier": "fast"},
    ],
    "gemini": [
        {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "context": "1M", "tier": "fast"},
        {"id": "gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite", "context": "1M", "tier": "free"},
        {"id": "gemini-2.5-pro-preview-03-25", "name": "Gemini 2.5 Pro Preview", "context": "1M", "tier": "premium"},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "context": "2M", "tier": "premium"},
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "context": "1M", "tier": "fast"},
        {"id": "gemini-1.5-flash-8b", "name": "Gemini 1.5 Flash 8B", "context": "1M", "tier": "free"},
    ],
}


def _load_raw() -> dict[str, Any]:
    """Load raw config from disk (no masking)."""
    if not _CONFIG_PATH.exists():
        return dict(DEFAULT_CONFIG)
    try:
        with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
            stored = json.load(f)
        # Merge with defaults so new fields appear automatically
        merged = dict(DEFAULT_CONFIG)
        merged.update(stored)
        return merged
    except Exception as e:
        logger.error(f"Failed to load LLM config: {e}")
        return dict(DEFAULT_CONFIG)


def _save_raw(config: dict[str, Any]) -> bool:
    """Persist config to disk."""
    try:
        _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logger.error(f"Failed to save LLM config: {e}")
        return False


def _mask_key(value: str) -> str:
    """Return first 8 chars + '...' for display, or empty string if unset."""
    if not value:
        return ""
    if len(value) <= 8:
        return value[:4] + "..."
    return value[:8] + "..."


def get_llm_config() -> dict[str, Any]:
    """Return current config with API keys masked (safe for API responses)."""
    config = _load_raw()
    safe = dict(config)
    safe["openrouter_api_key"] = _mask_key(config.get("openrouter_api_key", ""))
    safe["gemini_api_key"] = _mask_key(config.get("gemini_api_key", ""))
    return safe


def get_llm_config_raw() -> dict[str, Any]:
    """Return current config with real API keys (for internal use only)."""
    return _load_raw()


def update_llm_config(updates: dict[str, Any]) -> dict[str, Any]:
    """
    Apply updates to the stored config.
    API keys that look like masked values (end with '...') are left unchanged.
    Returns the updated config with masked keys.
    """
    config = _load_raw()

    allowed_keys = set(DEFAULT_CONFIG.keys())
    for key, value in updates.items():
        if key not in allowed_keys:
            continue
        # Skip masked key values — user didn't change them
        if key in ("openrouter_api_key", "gemini_api_key"):
            if isinstance(value, str) and value.endswith("..."):
                continue
        # Validate temperature
        if key == "temperature":
            try:
                v = float(value)
                config[key] = max(0.0, min(1.0, v))
            except (TypeError, ValueError):
                pass
            continue
        # Validate max_tokens
        if key == "max_tokens":
            try:
                v = int(value)
                config[key] = max(128, min(8192, v))
            except (TypeError, ValueError):
                pass
            continue
        config[key] = value

    _save_raw(config)
    return get_llm_config()


def get_available_models() -> dict[str, list[dict[str, str]]]:
    """Return the static curated list of available models per provider."""
    return AVAILABLE_MODELS
