"""Alert manager — maintains watchlist rules and fires notifications.

Rules are persisted in backend/data/alert_rules.json so they survive restarts.
Supports two rule types:
  - ``entity``   — fires when a tracked entity (by ICAO, tail, MMSI, callsign, or name) is seen in live data.
  - ``geofence`` — fires when any item in the specified layers has lat/lng inside the bounding box.

Notifications are sent via:
  - WebSocket broadcast (always, when ``notify_websocket`` is true)
  - Telegram bot API  (when ``telegram_chat_id`` and ``TELEGRAM_BOT_TOKEN`` env var are set)
  - Discord webhook   (when ``discord_webhook_url`` is set)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Coroutine, Deque, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------
_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_RULES_FILE = _DATA_DIR / "alert_rules.json"

# In-memory collections
_rules: List[Dict[str, Any]] = []
_recent_alerts: Deque[Dict[str, Any]] = deque(maxlen=200)

# WebSocket broadcast callback — injected by main.py at startup
_broadcast_fn: Optional[Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]] = None
_event_loop: Optional[asyncio.AbstractEventLoop] = None


def set_broadcast(fn: Callable[[Dict[str, Any]], Coroutine[Any, Any, None]],
                  loop: asyncio.AbstractEventLoop) -> None:
    """Register the WebSocket broadcast coroutine and event loop from main.py."""
    global _broadcast_fn, _event_loop
    _broadcast_fn = fn
    _event_loop = loop


# ---------------------------------------------------------------------------
# Rule persistence helpers
# ---------------------------------------------------------------------------

def _load_rules() -> None:
    """Load alert rules from disk into memory."""
    global _rules
    if _RULES_FILE.exists():
        try:
            with open(_RULES_FILE, "r", encoding="utf-8") as f:
                _rules = json.load(f)
            logger.info("Loaded %d alert rules from %s", len(_rules), _RULES_FILE)
        except Exception as exc:
            logger.error("Failed to load alert rules: %s", exc)
            _rules = []
    else:
        _rules = []


def _save_rules() -> None:
    """Persist rules to disk atomically (write-to-temp then rename)."""
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=_DATA_DIR,
            suffix=".tmp",
            delete=False,
        ) as tf:
            json.dump(_rules, tf, indent=2)
            tmp_path = tf.name
        os.replace(tmp_path, _RULES_FILE)
    except Exception as exc:
        logger.error("Failed to save alert rules: %s", exc)


# Load on module import so rules are ready before first evaluate_alerts call
_load_rules()


# ---------------------------------------------------------------------------
# Public CRUD API
# ---------------------------------------------------------------------------

def get_rules() -> List[Dict[str, Any]]:
    """Return all alert rules."""
    return list(_rules)


def add_rule(rule: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and append a new alert rule, then persist.

    The caller must supply at minimum ``name`` and ``type``.
    ``id`` is auto-generated; missing fields receive sensible defaults.
    """
    rule = _apply_defaults(rule)
    rule["id"] = str(uuid.uuid4())
    _rules.append(rule)
    _save_rules()
    logger.info("Alert rule added: %s (%s)", rule["name"], rule["id"])
    return rule


def update_rule(rule_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update an existing rule by ID and persist. Returns the updated rule or None."""
    for i, r in enumerate(_rules):
        if r["id"] == rule_id:
            _rules[i] = {**r, **updates, "id": rule_id}
            _save_rules()
            logger.info("Alert rule updated: %s", rule_id)
            return _rules[i]
    return None


def delete_rule(rule_id: str) -> bool:
    """Delete a rule by ID and persist. Returns True if found and deleted."""
    global _rules
    original_len = len(_rules)
    _rules = [r for r in _rules if r["id"] != rule_id]
    if len(_rules) < original_len:
        _save_rules()
        logger.info("Alert rule deleted: %s", rule_id)
        return True
    return False


def get_recent_alerts(limit: int = 50) -> List[Dict[str, Any]]:
    """Return up to ``limit`` most-recent fired alert events (newest first)."""
    alerts = list(_recent_alerts)
    alerts.reverse()
    return alerts[:limit]


# ---------------------------------------------------------------------------
# Alert evaluation — called on every data refresh
# ---------------------------------------------------------------------------

def evaluate_alerts(live_data: Dict[str, Any]) -> None:
    """Check all enabled rules against current live data and fire if matched.

    This function is called from a background thread after each data refresh.
    It is intentionally non-blocking: external HTTP calls (Telegram, Discord)
    are fire-and-forget within the same thread pool.
    """
    now = time.time()
    for rule in list(_rules):
        if not rule.get("enabled", True):
            continue

        # Cooldown check
        last_fired = rule.get("last_fired")
        cooldown = rule.get("cooldown_seconds", 300)
        if last_fired and (now - last_fired) < cooldown:
            continue

        rule_type = rule.get("type", "entity")
        if rule_type == "entity":
            match = _check_entity_rule(rule, live_data)
        elif rule_type == "geofence":
            match = _check_geofence_rule(rule, live_data)
        else:
            match = None

        if match:
            _fire_alert(rule, match, now)


# ---------------------------------------------------------------------------
# Rule matchers
# ---------------------------------------------------------------------------

def _check_entity_rule(
    rule: Dict[str, Any], live_data: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Return the first matching entity from live data, or None."""
    entity_ids: List[str] = [eid.lower() for eid in rule.get("entity_ids", [])]
    if not entity_ids:
        return None

    layers = {
        "tracked_flights": live_data.get("tracked_flights", []),
        "private_jets": live_data.get("private_jets", []),
        "military_flights": live_data.get("military_flights", []),
        "ships": live_data.get("ships", []),
        "commercial_flights": live_data.get("commercial_flights", []),
    }

    for layer_name, items in layers.items():
        for item in items:
            if _entity_matches(item, entity_ids):
                return {"layer": layer_name, "entity": item}
    return None


def _entity_matches(item: Dict[str, Any], entity_ids: List[str]) -> bool:
    """Return True if any lookup field in *item* matches one of *entity_ids*."""
    fields = [
        str(item.get("icao", "") or "").lower(),
        str(item.get("tail", "") or "").lower(),
        str(item.get("mmsi", "") or "").lower(),
        str(item.get("callsign", "") or "").lower(),
        str(item.get("name", "") or "").lower(),
        str(item.get("flight", "") or "").lower(),
        str(item.get("registration", "") or "").lower(),
    ]
    return any(f for f in fields if f and f in entity_ids)


def _check_geofence_rule(
    rule: Dict[str, Any], live_data: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Return the first item found inside the geofence, or None."""
    gf = rule.get("geofence", {})
    south = gf.get("south")
    west = gf.get("west")
    north = gf.get("north")
    east = gf.get("east")
    if any(v is None for v in (south, west, north, east)):
        return None

    watched_layers: List[str] = rule.get(
        "geofence_layers", ["private_jets", "military_flights", "ships"]
    )

    for layer_name in watched_layers:
        items = live_data.get(layer_name, [])
        for item in items:
            lat = item.get("lat")
            lng = item.get("lng") or item.get("lon")
            if lat is None or lng is None:
                continue
            if _in_bbox(lat, lng, south, west, north, east):
                return {"layer": layer_name, "entity": item}
    return None


def _in_bbox(
    lat: float, lng: float,
    south: float, west: float, north: float, east: float,
) -> bool:
    """Return True if (lat, lng) is inside the bounding box."""
    if not (south <= lat <= north):
        return False
    # Handle antimeridian crossing
    if west <= east:
        return west <= lng <= east
    return lng >= west or lng <= east


# ---------------------------------------------------------------------------
# Alert firing & notification dispatch
# ---------------------------------------------------------------------------

def _fire_alert(
    rule: Dict[str, Any], match: Dict[str, Any], now: float
) -> None:
    """Record the alert event and dispatch notifications."""
    entity = match.get("entity", {})
    layer = match.get("layer", "unknown")

    # Build a human-readable label for the matched entity
    label = (
        entity.get("name")
        or entity.get("callsign")
        or entity.get("tail")
        or entity.get("icao")
        or entity.get("mmsi")
        or "Unknown entity"
    )

    event: Dict[str, Any] = {
        "type": "alert",
        "rule_id": rule["id"],
        "rule_name": rule["name"],
        "rule_type": rule.get("type", "entity"),
        "layer": layer,
        "entity_label": label,
        "entity": entity,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Update last_fired on the rule (in-place — persisted next save cycle)
    rule["last_fired"] = now
    _save_rules()

    # Store in recent alerts ring buffer
    _recent_alerts.append(event)
    logger.info(
        "Alert fired — rule '%s' matched '%s' on layer '%s'",
        rule["name"], label, layer,
    )

    # ── Notifications ──
    message = _format_message(rule, label, layer)

    if rule.get("notify_websocket", True):
        _broadcast_ws(event)

    telegram_chat_id = rule.get("telegram_chat_id", "")
    if telegram_chat_id:
        _send_telegram(telegram_chat_id, message)

    discord_url = rule.get("discord_webhook_url", "")
    if discord_url:
        _send_discord(discord_url, message)


def _format_message(rule: Dict[str, Any], label: str, layer: str) -> str:
    """Build a human-readable notification message."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return (
        f"🔔 SHADOWBROKER ALERT — {rule['name']}\n"
        f"Layer: {layer}\n"
        f"Entity: {label}\n"
        f"Time: {ts}"
    )


def _broadcast_ws(event: Dict[str, Any]) -> None:
    """Push the alert event to all connected WebSocket clients (non-blocking)."""
    if _broadcast_fn is None or _event_loop is None:
        return
    try:
        asyncio.run_coroutine_threadsafe(_broadcast_fn(event), _event_loop)
    except Exception as exc:
        logger.debug("WebSocket broadcast failed: %s", exc)


def _send_telegram(chat_id: str, message: str) -> None:
    """Send a Telegram message via Bot API. Silently skipped if token is absent."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        logger.debug("TELEGRAM_BOT_TOKEN not set — skipping Telegram notification")
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        resp = requests.post(
            url,
            json={"chat_id": chat_id, "text": message},
            timeout=10,
        )
        if not resp.ok:
            logger.warning("Telegram notification failed: %s", resp.text)
    except Exception as exc:
        logger.debug("Telegram request error: %s", exc)


def _send_discord(webhook_url: str, message: str) -> None:
    """POST a message to a Discord webhook. Silently skipped on error."""
    try:
        resp = requests.post(
            webhook_url,
            json={"content": message},
            timeout=10,
        )
        if not resp.ok:
            logger.warning("Discord notification failed: %s", resp.text)
    except Exception as exc:
        logger.debug("Discord request error: %s", exc)


# ---------------------------------------------------------------------------
# Default rule schema
# ---------------------------------------------------------------------------

def _apply_defaults(rule: Dict[str, Any]) -> Dict[str, Any]:
    """Fill in missing fields with their default values."""
    defaults: Dict[str, Any] = {
        "name": "Unnamed Alert",
        "enabled": True,
        "type": "entity",
        "entity_ids": [],
        "geofence": {},
        "geofence_layers": ["private_jets", "military_flights", "ships"],
        "telegram_chat_id": "",
        "discord_webhook_url": "",
        "notify_websocket": True,
        "cooldown_seconds": 300,
        "last_fired": None,
    }
    return {**defaults, **rule}
