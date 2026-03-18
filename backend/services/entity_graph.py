"""
Entity Relationship Graph Service
Curated OSINT database mapping assets (jets, yachts, ships) to their known
owners, operators, and corporate networks.
"""

from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Static ownership database — expandable OSINT data
# Keys: tail numbers, yacht names, MMSI, or callsigns (normalised to UPPER)
# ---------------------------------------------------------------------------
KNOWN_ENTITIES: dict[str, dict[str, Any]] = {
    # ── Private jets ────────────────────────────────────────────────────────
    "N628TS": {
        "name": "Elon Musk's Gulfstream G650ER",
        "owner": "Elon Musk",
        "owner_type": "individual",
        "affiliation": "Tesla / SpaceX / xAI",
        "nationality": "USA",
        "asset_type": "private_jet",
        "related": ["SpaceX", "Tesla", "xAI", "X Corp"],
        "notes": "Tail N628TS, frequently tracked by ElonJet",
        "sanctioned": False,
    },
    "N757AF": {
        "name": "Donald Trump's Boeing 757",
        "owner": "Donald Trump",
        "owner_type": "individual",
        "affiliation": "Trump Organization",
        "nationality": "USA",
        "asset_type": "private_jet",
        "related": ["Trump Organization", "Mar-a-Lago"],
        "notes": "Trump Force One",
        "sanctioned": False,
    },
    "N442SR": {
        "name": "Jeff Bezos's Gulfstream G650ER",
        "owner": "Jeff Bezos",
        "owner_type": "individual",
        "affiliation": "Amazon / Blue Origin",
        "nationality": "USA",
        "asset_type": "private_jet",
        "related": ["Amazon", "Blue Origin", "Washington Post"],
        "notes": "",
        "sanctioned": False,
    },
    "M-YFLY": {
        "name": "Roman Abramovich jet",
        "owner": "Roman Abramovich",
        "owner_type": "individual",
        "affiliation": "Evraz / Nornickel",
        "nationality": "Russia/Israel",
        "asset_type": "private_jet",
        "related": ["Evraz", "Chelsea FC (former)"],
        "notes": "Sanctioned individual",
        "sanctioned": True,
    },
    "N887WM": {
        "name": "Bill Gates's Gulfstream G650ER",
        "owner": "Bill Gates",
        "owner_type": "individual",
        "affiliation": "Bill & Melinda Gates Foundation / Microsoft",
        "nationality": "USA",
        "asset_type": "private_jet",
        "related": ["Microsoft", "Bill & Melinda Gates Foundation"],
        "notes": "Tail N887WM",
        "sanctioned": False,
    },
    "N808MS": {
        "name": "Larry Ellison's Gulfstream G650",
        "owner": "Larry Ellison",
        "owner_type": "individual",
        "affiliation": "Oracle",
        "nationality": "USA",
        "asset_type": "private_jet",
        "related": ["Oracle Corporation"],
        "notes": "Oracle co-founder",
        "sanctioned": False,
    },
    "F-GVSG": {
        "name": "Bernard Arnault's Falcon 7X",
        "owner": "Bernard Arnault",
        "owner_type": "individual",
        "affiliation": "LVMH",
        "nationality": "France",
        "asset_type": "private_jet",
        "related": ["LVMH", "Louis Vuitton", "Moet Hennessy"],
        "notes": "World's richest person (as of 2023)",
        "sanctioned": False,
    },
    "HZ-MS5B": {
        "name": "Saudi Royal Family Boeing 747",
        "owner": "Saudi Royal Family",
        "owner_type": "government",
        "affiliation": "Kingdom of Saudi Arabia",
        "nationality": "Saudi Arabia",
        "asset_type": "private_jet",
        "related": ["Saudi Aramco", "PIF (Public Investment Fund)"],
        "notes": "One of several VIP transport aircraft in the Saudi royal fleet",
        "sanctioned": False,
    },
    "RA-96024": {
        "name": "Russian Presidential Aircraft Il-96",
        "owner": "Russian Federation",
        "owner_type": "government",
        "affiliation": "Kremlin / FSO",
        "nationality": "Russia",
        "asset_type": "private_jet",
        "related": ["Vladimir Putin", "Kremlin"],
        "notes": "Ilyushin Il-96-300PU — Russia's Air Force One",
        "sanctioned": False,
    },
    "M-ABEL": {
        "name": "Mikhail Fridman jet",
        "owner": "Mikhail Fridman",
        "owner_type": "individual",
        "affiliation": "Alfa Group / LetterOne",
        "nationality": "Russia/Israel",
        "asset_type": "private_jet",
        "related": ["Alfa Group", "LetterOne"],
        "notes": "Sanctioned Russian oligarch",
        "sanctioned": True,
    },
    "M-VITO": {
        "name": "Viktor Vekselberg jet",
        "owner": "Viktor Vekselberg",
        "owner_type": "individual",
        "affiliation": "Renova Group",
        "nationality": "Russia",
        "asset_type": "private_jet",
        "related": ["Renova Group"],
        "notes": "Sanctioned oligarch — Tango superyacht also seized",
        "sanctioned": True,
    },
    # ── Superyachts ─────────────────────────────────────────────────────────
    "Eclipse": {
        "name": "Eclipse (superyacht)",
        "owner": "Roman Abramovich",
        "owner_type": "individual",
        "affiliation": "Sanctioned",
        "nationality": "Russia/Israel",
        "asset_type": "superyacht",
        "related": ["Garnet Inc"],
        "notes": "One of the world's largest superyachts, 162 m",
        "sanctioned": True,
    },
    "Amadea": {
        "name": "Amadea (superyacht)",
        "owner": "Suleiman Kerimov",
        "owner_type": "individual",
        "affiliation": "Nafta Moskva",
        "nationality": "Russia",
        "asset_type": "superyacht",
        "related": ["Nafta Moskva"],
        "notes": "Seized by US authorities 2022",
        "sanctioned": True,
    },
    "Tango": {
        "name": "Tango (superyacht)",
        "owner": "Viktor Vekselberg",
        "owner_type": "individual",
        "affiliation": "Renova Group",
        "nationality": "Russia",
        "asset_type": "superyacht",
        "related": ["Renova Group"],
        "notes": "Seized in Spain 2022",
        "sanctioned": True,
    },
    "Dilbar": {
        "name": "Dilbar (superyacht)",
        "owner": "Alisher Usmanov",
        "owner_type": "individual",
        "affiliation": "USM Holdings",
        "nationality": "Russia/Uzbekistan",
        "asset_type": "superyacht",
        "related": ["USM Holdings", "Metalloinvest", "MegaFon"],
        "notes": "Largest superyacht by volume, 156 m — seized in Hamburg 2022",
        "sanctioned": True,
    },
    "Scheherazade": {
        "name": "Scheherazade (superyacht)",
        "owner": "Unknown (suspected Putin link)",
        "owner_type": "individual",
        "affiliation": "Unknown",
        "nationality": "Russia",
        "asset_type": "superyacht",
        "related": [],
        "notes": "140 m yacht with suspected Kremlin connections — crew members linked to FSO",
        "sanctioned": False,
    },
    "Solaris": {
        "name": "Solaris (superyacht)",
        "owner": "Roman Abramovich",
        "owner_type": "individual",
        "affiliation": "Sanctioned",
        "nationality": "Russia/Israel",
        "asset_type": "superyacht",
        "related": [],
        "notes": "140 m — fled EU waters in Feb 2022",
        "sanctioned": True,
    },
    "Lady Anastasia": {
        "name": "Lady Anastasia (superyacht)",
        "owner": "Alexander Mikheyev",
        "owner_type": "individual",
        "affiliation": "Rosoboronexport",
        "nationality": "Russia",
        "asset_type": "superyacht",
        "related": ["Rosoboronexport"],
        "notes": "Seized in Spain 2022; owner is CEO of Russian state arms exporter",
        "sanctioned": True,
    },
    "Kibo": {
        "name": "Kibo (superyacht)",
        "owner": "Gennady Timchenko",
        "owner_type": "individual",
        "affiliation": "Volga Group / Novatek",
        "nationality": "Russia/Finland",
        "asset_type": "superyacht",
        "related": ["Volga Group", "Novatek", "Gunvor"],
        "notes": "Sanctioned oligarch — close Putin ally",
        "sanctioned": True,
    },
    # ── Additional private jets ──────────────────────────────────────────────
    "N318AJ": {
        "name": "George Soros's Gulfstream G550",
        "owner": "George Soros",
        "owner_type": "individual",
        "affiliation": "Soros Fund Management / Open Society Foundations",
        "nationality": "USA/Hungary",
        "asset_type": "private_jet",
        "related": ["Soros Fund Management", "Open Society Foundations"],
        "notes": "",
        "sanctioned": False,
    },
    "N979RR": {
        "name": "Mark Zuckerberg's Gulfstream G600",
        "owner": "Mark Zuckerberg",
        "owner_type": "individual",
        "affiliation": "Meta Platforms",
        "nationality": "USA",
        "asset_type": "private_jet",
        "related": ["Meta", "Facebook", "Instagram", "WhatsApp"],
        "notes": "Tail N979RR",
        "sanctioned": False,
    },
    "N77WL": {
        "name": "Warren Buffett's NetJets Falcon 7X",
        "owner": "Warren Buffett",
        "owner_type": "individual",
        "affiliation": "Berkshire Hathaway / NetJets",
        "nationality": "USA",
        "asset_type": "private_jet",
        "related": ["Berkshire Hathaway", "NetJets"],
        "notes": "Self-described 'The Indefensible' — ironic given his past anti-private-jet stance",
        "sanctioned": False,
    },
    "VP-CLG": {
        "name": "Vagit Alekperov jet",
        "owner": "Vagit Alekperov",
        "owner_type": "individual",
        "affiliation": "Lukoil",
        "nationality": "Russia",
        "asset_type": "private_jet",
        "related": ["Lukoil"],
        "notes": "Sanctioned oligarch — former Lukoil president",
        "sanctioned": True,
    },
}

# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------

def get_entity_info(identifier: str) -> dict[str, Any] | None:
    """Look up an asset by exact key or case-insensitive partial match."""
    upper = identifier.strip().upper()
    # Exact match first (tail numbers are uppercase)
    if upper in KNOWN_ENTITIES:
        return {"id": upper, **KNOWN_ENTITIES[upper]}
    # Case-insensitive full key match
    for key, val in KNOWN_ENTITIES.items():
        if key.upper() == upper:
            return {"id": key, **val}
    # Partial match on key, name, or owner
    lower = identifier.strip().lower()
    for key, val in KNOWN_ENTITIES.items():
        if (
            lower in key.lower()
            or lower in val.get("name", "").lower()
            or lower in val.get("owner", "").lower()
        ):
            return {"id": key, **val}
    return None


def search_entities(query: str) -> list[dict[str, Any]]:
    """Full-text search across all known entities."""
    lower = query.strip().lower()
    if not lower:
        return get_all_entities()
    results: list[dict[str, Any]] = []
    for key, val in KNOWN_ENTITIES.items():
        haystack = " ".join([
            key,
            val.get("name", ""),
            val.get("owner", ""),
            val.get("affiliation", ""),
            val.get("nationality", ""),
            val.get("asset_type", ""),
            val.get("notes", ""),
            " ".join(val.get("related", [])),
        ]).lower()
        if lower in haystack:
            results.append({"id": key, **val})
    return results


def get_all_entities() -> list[dict[str, Any]]:
    """Return all known entity entries (for the UI catalogue)."""
    return [{"id": key, **val} for key, val in KNOWN_ENTITIES.items()]


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def _asset_type_from_live(layer: str) -> str:
    """Map live-data layer name → asset_type string."""
    mapping = {
        "private_jets": "private_jet",
        "tracked_flights": "tracked_flight",
        "ships": "ship",
        "military_flights": "military_flight",
    }
    return mapping.get(layer, layer)


def build_graph(live_data: dict[str, Any]) -> dict[str, Any]:
    """
    Scan all live tracked layers, match against KNOWN_ENTITIES, and return a
    force-directed graph structure with nodes and edges.
    """
    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, str]] = []

    # Collect live-asset positions keyed by identifier (tail / name / callsign)
    live_positions: dict[str, dict[str, Any]] = {}
    layers_to_scan = {
        "private_jets": live_data.get("private_jets") or [],
        "tracked_flights": live_data.get("tracked_flights") or [],
        "ships": live_data.get("ships") or [],
        "military_flights": live_data.get("military_flights") or [],
    }
    for layer_name, items in layers_to_scan.items():
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            # Try various identifier fields
            identifiers: list[str] = []
            for field in ("tail", "registration", "icao24", "callsign", "name",
                          "vessel_name", "mmsi", "shipname"):
                val = item.get(field)
                if val and isinstance(val, str) and val.strip():
                    identifiers.append(val.strip())
            lat = item.get("lat") or item.get("latitude") or item.get("lat_dd")
            lng = item.get("lon") or item.get("longitude") or item.get("lon_dd") or item.get("lng")
            for ident in identifiers:
                live_positions[ident.upper()] = {
                    "lat": lat,
                    "lng": lng,
                    "layer": layer_name,
                    "raw": item,
                }

    active_asset_count = 0
    known_owners: set[str] = set()

    # Build nodes & edges for every known entity, annotating live status
    for asset_id, info in KNOWN_ENTITIES.items():
        upper_id = asset_id.upper()
        is_active = upper_id in live_positions
        pos = live_positions.get(upper_id, {})

        # Asset node
        asset_node: dict[str, Any] = {
            "id": asset_id,
            "label": info.get("name", asset_id),
            "type": info.get("asset_type", "asset"),
            "owner": info.get("owner", ""),
            "active": is_active,
            "sanctioned": info.get("sanctioned", False),
        }
        if is_active:
            asset_node["lat"] = pos.get("lat")
            asset_node["lng"] = pos.get("lng")
            active_asset_count += 1

        nodes[asset_id] = asset_node

        # Owner node
        owner = info.get("owner", "")
        if owner:
            known_owners.add(owner)
            if owner not in nodes:
                nodes[owner] = {
                    "id": owner,
                    "label": owner,
                    "type": info.get("owner_type", "individual"),
                    "nationality": info.get("nationality", ""),
                    "active": False,
                    "sanctioned": info.get("sanctioned", False),
                }
            # Edge: asset → owner
            edges.append({"source": asset_id, "target": owner, "relation": "owned_by"})

        # Related company/org nodes
        for related in info.get("related", []):
            if related not in nodes:
                nodes[related] = {
                    "id": related,
                    "label": related,
                    "type": "company",
                    "active": False,
                    "sanctioned": False,
                }
            if owner:
                edge_key = f"{owner}→{related}"
                if not any(
                    e["source"] == owner and e["target"] == related for e in edges
                ):
                    edges.append({"source": owner, "target": related, "relation": "controls"})

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes),
            "active_assets": active_asset_count,
            "known_owners": len(known_owners),
            "total_edges": len(edges),
        },
    }
