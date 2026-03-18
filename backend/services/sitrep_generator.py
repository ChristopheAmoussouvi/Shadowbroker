"""
SITREP Generator Service — calls configured LLM provider (OpenRouter or Google Gemini)
with a summary of live Shadowbroker data and returns a structured situation report.

History (last 20 SITREPs) is kept in memory and optionally persisted to
backend/data/sitrep_history.json.
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from services.llm_config import get_llm_config_raw

logger = logging.getLogger(__name__)

_HISTORY_PATH = Path(__file__).resolve().parent.parent / "data" / "sitrep_history.json"
_MAX_HISTORY = 20

# In-memory ring buffer of generated SITREPs
_sitrep_history: list[dict[str, Any]] = []
_history_loaded = False


# ---------------------------------------------------------------------------
# History helpers
# ---------------------------------------------------------------------------

def _load_history() -> None:
    global _sitrep_history, _history_loaded
    if _history_loaded:
        return
    _history_loaded = True
    if not _HISTORY_PATH.exists():
        return
    try:
        with open(_HISTORY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            _sitrep_history = data[-_MAX_HISTORY:]
    except Exception as e:
        logger.warning(f"Could not load SITREP history: {e}")


def _persist_history() -> None:
    try:
        _HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(_sitrep_history, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Could not persist SITREP history: {e}")


def save_sitrep(sitrep: dict[str, Any]) -> None:
    _load_history()
    _sitrep_history.append(sitrep)
    # Trim to max
    if len(_sitrep_history) > _MAX_HISTORY:
        del _sitrep_history[:-_MAX_HISTORY]
    _persist_history()


def get_sitrep_history(limit: int = 10) -> list[dict[str, Any]]:
    _load_history()
    return list(reversed(_sitrep_history[-limit:]))


def get_sitrep_by_id(sitrep_id: str) -> dict[str, Any] | None:
    _load_history()
    for s in _sitrep_history:
        if s.get("id") == sitrep_id:
            return s
    return None


# ---------------------------------------------------------------------------
# Data summary builder
# ---------------------------------------------------------------------------

def build_data_summary(live_data: dict[str, Any]) -> str:
    """Convert live data snapshot into a concise text summary for LLM context."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

    lines = [f"LIVE DATA SNAPSHOT [{now} UTC]"]

    # Flights
    commercial = len(live_data.get("commercial_flights", []))
    military = len(live_data.get("military_flights", []))
    tracked = len(live_data.get("tracked_flights", []))
    jets = len(live_data.get("private_jets", []))
    lines.append(
        f"Flights: {commercial:,} commercial | {military} military | {tracked} tracked/high-interest | {jets} private jets"
    )

    # Ships
    ships = live_data.get("ships", [])
    total_ships = len(ships)
    mil_ships = sum(1 for s in ships if s.get("ship_type", "").lower() in ("military", "warship", "navy"))
    tankers = sum(1 for s in ships if "tanker" in s.get("ship_type", "").lower())
    lines.append(f"Ships: {total_ships:,} total | {mil_ships} military | {tankers} tankers")

    # Earthquakes
    quakes = live_data.get("earthquakes", [])
    sig_quakes = [q for q in quakes if q.get("magnitude", 0) >= 4.0]
    quake_detail = ""
    if sig_quakes:
        top = sorted(sig_quakes, key=lambda x: x.get("magnitude", 0), reverse=True)[:3]
        quake_detail = " [" + ", ".join(
            f"M{q.get('magnitude', '?')} {q.get('place', q.get('location', 'Unknown'))}"
            for q in top
        ) + "]"
    lines.append(f"Earthquakes (last 24h): {len(sig_quakes)} events mag≥4.0{quake_detail}")

    # GPS Jamming
    jamming = live_data.get("gps_jamming", [])
    jam_locations = ""
    if jamming:
        top_jam = jamming[:3]
        jam_locations = " [" + ", ".join(
            j.get("location", j.get("country", "Unknown")) for j in top_jam
        ) + "]"
    lines.append(f"GPS Jamming: {len(jamming)} active zones{jam_locations}")

    # FIRMS Fires
    fires = live_data.get("firms_fires", [])
    lines.append(f"Active Fires (FIRMS): {len(fires):,} hotspots")

    # Internet Outages
    outages = live_data.get("internet_outages", [])
    outage_detail = ""
    if outages:
        top_out = outages[:2]
        outage_detail = " [" + ", ".join(
            o.get("location", o.get("country", "Unknown")) for o in top_out
        ) + "]"
    lines.append(f"Internet Outages: {len(outages)} active{outage_detail}")

    # Space Weather
    sw = live_data.get("space_weather")
    if sw:
        kp = sw.get("kp_index", "N/A")
        kp_text = sw.get("kp_text", "")
        lines.append(f"Space Weather: Kp={kp} ({kp_text})")

    # Top news headlines
    news = live_data.get("news", [])
    if news:
        top_news = news[:5]
        lines.append("News headlines:")
        for item in top_news:
            title = item.get("title", "")
            source = item.get("source", "")
            if title:
                lines.append(f"  - [{source}] {title}")

    # UAVs
    uavs = live_data.get("uavs", [])
    if uavs:
        lines.append(f"UAVs/Drones: {len(uavs)} tracked")

    # LiveUAMap events
    liveuamap = live_data.get("liveuamap", [])
    if liveuamap:
        lines.append(f"Conflict Events (LiveUAMap): {len(liveuamap)} recent events")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# LLM provider clients
# ---------------------------------------------------------------------------

def _call_openrouter(prompt: str, config: dict[str, Any]) -> dict[str, Any]:
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {config['openrouter_api_key']}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://shadowbroker.osint",
            "X-Title": "Shadowbroker SITREP",
        },
        json={
            "model": config["openrouter_model"],
            "messages": [
                {"role": "system", "content": config["system_prompt"]},
                {"role": "user", "content": prompt},
            ],
            "temperature": config.get("temperature", 0.7),
            "max_tokens": config.get("max_tokens", 2048),
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return {
        "content": data["choices"][0]["message"]["content"],
        "tokens_used": data.get("usage", {}).get("total_tokens", 0),
    }


def _call_gemini(prompt: str, config: dict[str, Any]) -> dict[str, Any]:
    model = config["gemini_model"]
    api_key = config["gemini_api_key"]
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    response = requests.post(
        url,
        json={
            "system_instruction": {"parts": [{"text": config["system_prompt"]}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": config.get("temperature", 0.7),
                "maxOutputTokens": config.get("max_tokens", 2048),
            },
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    tokens_used = data.get("usageMetadata", {}).get("totalTokenCount", 0)
    return {"content": content, "tokens_used": tokens_used}


def _call_llm(prompt: str, config: dict[str, Any]) -> dict[str, Any]:
    """Dispatch to the configured provider."""
    provider = config.get("provider", "openrouter")
    if provider == "gemini":
        return _call_gemini(prompt, config)
    return _call_openrouter(prompt, config)


# ---------------------------------------------------------------------------
# Main generate function
# ---------------------------------------------------------------------------

async def generate_sitrep(
    live_data: dict[str, Any],
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Build data summary, call the LLM, persist and return the SITREP.

    Returns a dict with keys:
      id, content, model, provider, generated_at, tokens_used, duration_ms
    """
    if config is None:
        config = get_llm_config_raw()

    provider = config.get("provider", "openrouter")

    # Validate API key presence
    key_field = "openrouter_api_key" if provider == "openrouter" else "gemini_api_key"
    if not config.get(key_field):
        raise ValueError(
            f"No API key configured for provider '{provider}'. "
            "Please set it in the AI/SITREP settings."
        )

    model = config.get("openrouter_model") if provider == "openrouter" else config.get("gemini_model")

    data_summary = build_data_summary(live_data)

    t0 = time.time()
    # Run the blocking HTTP call in a thread pool to avoid blocking the event loop
    result = await asyncio.to_thread(_call_llm, data_summary, config)
    duration_ms = round((time.time() - t0) * 1000)

    sitrep: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "content": result["content"],
        "model": model,
        "provider": provider,
        "tokens_used": result.get("tokens_used", 0),
        "duration_ms": duration_ms,
    }

    save_sitrep(sitrep)
    return sitrep


# ---------------------------------------------------------------------------
# Connectivity test
# ---------------------------------------------------------------------------

async def test_llm_connection(config: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Send a minimal test message to check API key validity and measure latency.
    Returns {"ok": bool, "latency_ms": int, "model": str, "error": str|None}
    """
    if config is None:
        config = get_llm_config_raw()

    provider = config.get("provider", "openrouter")
    key_field = "openrouter_api_key" if provider == "openrouter" else "gemini_api_key"
    if not config.get(key_field):
        return {"ok": False, "latency_ms": 0, "model": "", "error": "No API key configured"}

    model = config.get("openrouter_model") if provider == "openrouter" else config.get("gemini_model")
    test_config = dict(config)
    test_config["max_tokens"] = 32
    test_config["system_prompt"] = "You are a test assistant."

    t0 = time.time()
    try:
        result = await asyncio.to_thread(
            _call_llm, "Reply with exactly: OK", test_config
        )
        latency_ms = round((time.time() - t0) * 1000)
        return {"ok": True, "latency_ms": latency_ms, "model": model, "error": None}
    except Exception as e:
        latency_ms = round((time.time() - t0) * 1000)
        return {"ok": False, "latency_ms": latency_ms, "model": model, "error": str(e)}
