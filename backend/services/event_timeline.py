"""Event Timeline service — maintains an in-memory ring buffer of the last 500
significant OSINT events detected across all data layers.

Usage:
    from services.event_timeline import ingest_events, get_recent_events, get_event_stats
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------
MAX_BUFFER_SIZE: int = 500
DEDUP_WINDOW_SECONDS: int = 1800  # 30 minutes — seen IDs are reset after this

# ---------------------------------------------------------------------------
# Ring buffer & state
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_events: deque[dict] = deque(maxlen=MAX_BUFFER_SIZE)

# Track seen entity IDs per layer to avoid duplicate events
_seen: dict[str, dict[str, float]] = {}  # layer -> {entity_id -> seen_at_timestamp}

# Callbacks registered by the WebSocket layer to broadcast new events
_broadcast_callbacks: list[Callable[[dict], None]] = []

# Previous snapshot for computing kp_index delta
_prev_kp_index: Optional[float] = None


def register_broadcast_callback(cb: Callable[[dict], None]) -> None:
    """Register a function to be called whenever a new event is emitted."""
    with _lock:
        _broadcast_callbacks.append(cb)


def _now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _is_seen(layer: str, entity_id: str) -> bool:
    """Return True if this entity was already seen within DEDUP_WINDOW_SECONDS."""
    now = time.monotonic()
    layer_seen = _seen.setdefault(layer, {})
    # Purge stale entries for this layer
    stale = [k for k, t in layer_seen.items() if now - t > DEDUP_WINDOW_SECONDS]
    for k in stale:
        del layer_seen[k]
    return entity_id in layer_seen


def _mark_seen(layer: str, entity_id: str) -> None:
    _seen.setdefault(layer, {})[entity_id] = time.monotonic()


def _emit(
    layer: str,
    severity: str,
    title: str,
    detail: str,
    icon: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    entity_id: Optional[str] = None,
) -> dict:
    event: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "timestamp": _now_utc(),
        "layer": layer,
        "severity": severity,
        "title": title,
        "detail": detail,
        "lat": lat,
        "lng": lng,
        "icon": icon,
        "entity_id": entity_id,
    }
    with _lock:
        _events.appendleft(event)
        callbacks = list(_broadcast_callbacks)
    for cb in callbacks:
        try:
            cb(event)
        except Exception as exc:
            logger.warning("Timeline broadcast callback error: %s", exc)
    return event


# ---------------------------------------------------------------------------
# Per-layer ingestion helpers
# ---------------------------------------------------------------------------

def _ingest_earthquakes(quakes: list[dict]) -> None:
    for q in quakes:
        try:
            mag = float(q.get("mag") or 0)
            if mag < 4.0:
                continue
            eq_id = str(q.get("id") or "")
            if not eq_id:
                continue
            if _is_seen("earthquakes", eq_id):
                continue
            _mark_seen("earthquakes", eq_id)
            severity = "high" if mag >= 6.0 else ("medium" if mag >= 4.5 else "low")
            place = q.get("place") or "unknown location"
            lat = q.get("lat")
            lng = q.get("lng")
            detail_parts = [f"Magnitude: {mag:.1f}"]
            depth = q.get("depth") or q.get("properties", {}).get("depth")
            if depth is not None:
                detail_parts.append(f"Depth: {depth}km")
            _emit(
                layer="earthquakes",
                severity=severity,
                title=f"M{mag:.1f} earthquake near {place}",
                detail=", ".join(detail_parts),
                icon="🌍",
                lat=float(lat) if lat is not None else None,
                lng=float(lng) if lng is not None else None,
                entity_id=eq_id,
            )
        except Exception as exc:
            logger.debug("earthquake ingest error: %s", exc)


def _ingest_tracked_flights(flights: list[dict]) -> None:
    for f in flights:
        try:
            icao = str(f.get("icao") or f.get("hex") or "")
            if not icao:
                continue
            if _is_seen("tracked_flights", icao):
                continue
            _mark_seen("tracked_flights", icao)
            callsign = f.get("callsign") or icao
            lat = f.get("lat")
            lng = f.get("lng")
            alt = f.get("alt") or f.get("altitude") or 0
            _emit(
                layer="tracked_flights",
                severity="high",
                title=f"Tracked flight detected: {callsign}",
                detail=f"ICAO: {icao} | Alt: {alt}ft",
                icon="✈️",
                lat=float(lat) if lat is not None else None,
                lng=float(lng) if lng is not None else None,
                entity_id=icao,
            )
        except Exception as exc:
            logger.debug("tracked_flights ingest error: %s", exc)


def _ingest_military_flights(flights: list[dict]) -> None:
    for f in flights:
        try:
            icao = str(f.get("icao") or f.get("hex") or "")
            if not icao:
                continue
            if _is_seen("military_flights", icao):
                continue
            _mark_seen("military_flights", icao)
            callsign = f.get("callsign") or icao
            lat = f.get("lat")
            lng = f.get("lng")
            category = f.get("category") or f.get("type") or "Military"
            _emit(
                layer="military_flights",
                severity="medium",
                title=f"Military flight detected: {callsign}",
                detail=f"Type: {category} | ICAO: {icao}",
                icon="🛩️",
                lat=float(lat) if lat is not None else None,
                lng=float(lng) if lng is not None else None,
                entity_id=icao,
            )
        except Exception as exc:
            logger.debug("military_flights ingest error: %s", exc)


def _ingest_gps_jamming(zones: list[dict]) -> None:
    for z in zones:
        try:
            lat = z.get("lat")
            lng = z.get("lng")
            if lat is None or lng is None:
                continue
            entity_id = f"{round(float(lat), 2)},{round(float(lng), 2)}"
            if _is_seen("gps_jamming", entity_id):
                continue
            _mark_seen("gps_jamming", entity_id)
            radius = z.get("radius") or "unknown"
            _emit(
                layer="gps_jamming",
                severity="high",
                title="GPS jamming zone detected",
                detail=f"Location: {float(lat):.2f}, {float(lng):.2f} | Radius: {radius}km",
                icon="📡",
                lat=float(lat),
                lng=float(lng),
                entity_id=entity_id,
            )
        except Exception as exc:
            logger.debug("gps_jamming ingest error: %s", exc)


def _ingest_firms_fires(fires: list[dict]) -> None:
    for f in fires:
        try:
            brightness = float(f.get("brightness") or 0)
            if brightness < 350:
                continue
            lat = f.get("lat")
            lng = f.get("lng")
            if lat is None or lng is None:
                continue
            entity_id = f"{round(float(lat), 2)},{round(float(lng), 2)}"
            if _is_seen("firms_fires", entity_id):
                continue
            _mark_seen("firms_fires", entity_id)
            acq_date = f.get("acq_date") or "unknown date"
            _emit(
                layer="firms_fires",
                severity="medium",
                title=f"Fire hotspot detected (brightness {brightness:.0f}K)",
                detail=f"Location: {float(lat):.2f}, {float(lng):.2f} | Date: {acq_date}",
                icon="🔥",
                lat=float(lat),
                lng=float(lng),
                entity_id=entity_id,
            )
        except Exception as exc:
            logger.debug("firms_fires ingest error: %s", exc)


def _ingest_internet_outages(outages: list[dict]) -> None:
    for o in outages:
        try:
            outage_id = str(o.get("id") or o.get("asn") or "")
            if not outage_id:
                lat = o.get("lat")
                lng = o.get("lng")
                if lat is None or lng is None:
                    continue
                outage_id = f"{round(float(lat), 2)},{round(float(lng), 2)}"
            if _is_seen("internet_outages", outage_id):
                continue
            _mark_seen("internet_outages", outage_id)
            location = o.get("location") or o.get("country") or o.get("city") or "unknown"
            provider = o.get("provider") or o.get("asn_name") or "unknown provider"
            lat = o.get("lat")
            lng = o.get("lng")
            _emit(
                layer="internet_outages",
                severity="medium",
                title=f"Internet outage detected: {provider}",
                detail=f"Location: {location}",
                icon="🌐",
                lat=float(lat) if lat is not None else None,
                lng=float(lng) if lng is not None else None,
                entity_id=outage_id,
            )
        except Exception as exc:
            logger.debug("internet_outages ingest error: %s", exc)


def _ingest_space_weather(sw_data: Any) -> None:
    global _prev_kp_index
    try:
        if not sw_data:
            return
        if isinstance(sw_data, list):
            sw_data = sw_data[0] if sw_data else {}
        kp_raw = sw_data.get("kp_index") or sw_data.get("kp")
        if kp_raw is None:
            return
        kp = float(kp_raw)
        if kp < 5.0:
            _prev_kp_index = kp
            return
        if _prev_kp_index is not None and abs(_prev_kp_index - kp) < 0.01:
            return
        _prev_kp_index = kp
        entity_id = f"kp_{kp:.1f}"
        if _is_seen("space_weather", entity_id):
            return
        _mark_seen("space_weather", entity_id)
        _emit(
            layer="space_weather",
            severity="high",
            title=f"High geomagnetic activity: Kp={kp:.1f}",
            detail=f"Kp-index {kp:.1f} — potential radio disruption / aurora visible at lower latitudes",
            icon="☀️",
            entity_id=entity_id,
        )
    except Exception as exc:
        logger.debug("space_weather ingest error: %s", exc)


def _ingest_uavs(uavs: list[dict]) -> None:
    for u in uavs:
        try:
            icao = str(u.get("icao") or u.get("hex") or "")
            if not icao:
                continue
            if _is_seen("uavs", icao):
                continue
            _mark_seen("uavs", icao)
            callsign = u.get("callsign") or icao
            lat = u.get("lat")
            lng = u.get("lng")
            _emit(
                layer="uavs",
                severity="medium",
                title=f"UAV/Drone detected: {callsign}",
                detail=f"ICAO: {icao}",
                icon="🚁",
                lat=float(lat) if lat is not None else None,
                lng=float(lng) if lng is not None else None,
                entity_id=icao,
            )
        except Exception as exc:
            logger.debug("uavs ingest error: %s", exc)


def _ingest_ships(ships: list[dict]) -> None:
    for s in ships:
        try:
            ship_type = str(s.get("type") or s.get("ship_type") or "")
            if "tanker" not in ship_type.lower() and "military" not in ship_type.lower():
                continue
            mmsi = str(s.get("mmsi") or "")
            if not mmsi:
                continue
            if _is_seen("ships", mmsi):
                continue
            _mark_seen("ships", mmsi)
            name = s.get("name") or mmsi
            lat = s.get("lat")
            lng = s.get("lng")
            _emit(
                layer="ships",
                severity="low",
                title=f"Notable vessel detected: {name}",
                detail=f"Type: {ship_type} | MMSI: {mmsi}",
                icon="🚢",
                lat=float(lat) if lat is not None else None,
                lng=float(lng) if lng is not None else None,
                entity_id=mmsi,
            )
        except Exception as exc:
            logger.debug("ships ingest error: %s", exc)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def ingest_events(live_data: dict) -> None:
    """Diff new live_data against previously seen state; emit timeline events for new entities.

    This function is called after each data refresh cycle. It is thread-safe and
    will never raise — any parsing errors are logged at DEBUG level.
    """
    if not live_data or not isinstance(live_data, dict):
        return
    try:
        _ingest_earthquakes(live_data.get("earthquakes") or [])
    except Exception as exc:
        logger.debug("ingest earthquakes error: %s", exc)
    try:
        _ingest_tracked_flights(live_data.get("tracked_flights") or [])
    except Exception as exc:
        logger.debug("ingest tracked_flights error: %s", exc)
    try:
        _ingest_military_flights(live_data.get("military_flights") or [])
    except Exception as exc:
        logger.debug("ingest military_flights error: %s", exc)
    try:
        _ingest_gps_jamming(live_data.get("gps_jamming") or [])
    except Exception as exc:
        logger.debug("ingest gps_jamming error: %s", exc)
    try:
        _ingest_firms_fires(live_data.get("firms_fires") or [])
    except Exception as exc:
        logger.debug("ingest firms_fires error: %s", exc)
    try:
        _ingest_internet_outages(live_data.get("internet_outages") or [])
    except Exception as exc:
        logger.debug("ingest internet_outages error: %s", exc)
    try:
        _ingest_space_weather(live_data.get("space_weather"))
    except Exception as exc:
        logger.debug("ingest space_weather error: %s", exc)
    try:
        _ingest_uavs(live_data.get("uavs") or [])
    except Exception as exc:
        logger.debug("ingest uavs error: %s", exc)
    try:
        _ingest_ships(live_data.get("ships") or [])
    except Exception as exc:
        logger.debug("ingest ships error: %s", exc)


def get_recent_events(
    limit: int = 100,
    layer: Optional[str] = None,
    severity: Optional[str] = None,
) -> list[dict]:
    """Return recent timeline events, optionally filtered by layer and/or severity."""
    with _lock:
        events = list(_events)
    if layer:
        events = [e for e in events if e.get("layer") == layer]
    if severity:
        events = [e for e in events if e.get("severity") == severity]
    return events[:limit]


def get_event_stats() -> dict:
    """Return event counts per layer and per severity for the last 1h/6h/24h."""
    now = datetime.now(timezone.utc)
    windows = {
        "1h": now - timedelta(hours=1),
        "6h": now - timedelta(hours=6),
        "24h": now - timedelta(hours=24),
    }
    with _lock:
        events = list(_events)

    result: dict[str, Any] = {}
    for window_name, cutoff in windows.items():
        window_events = []
        for e in events:
            try:
                ts = datetime.strptime(e["timestamp"], "%Y-%m-%dT%H:%M:%SZ").replace(
                    tzinfo=timezone.utc
                )
                if ts >= cutoff:
                    window_events.append(e)
            except Exception:
                pass

        by_layer: dict[str, int] = {}
        by_severity: dict[str, int] = {"high": 0, "medium": 0, "low": 0}
        for e in window_events:
            lyr = e.get("layer", "unknown")
            by_layer[lyr] = by_layer.get(lyr, 0) + 1
            sev = e.get("severity", "low")
            by_severity[sev] = by_severity.get(sev, 0) + 1

        result[window_name] = {
            "total": len(window_events),
            "by_layer": by_layer,
            "by_severity": by_severity,
        }

    return result
