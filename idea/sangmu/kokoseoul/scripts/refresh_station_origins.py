#!/usr/bin/env python3
"""Refresh the Seoul Metro station-origin snapshot and report what changed.

The official dataset (서울교통공사_역명의 유래, OA-12036) is updated daily, while
the Japanese station cards are reviewed, fixed content. This script fetches the
current dataset, compares it with the committed snapshot, and lists the cards
whose source text changed so they can be reviewed again.

Usage:
    SEOUL_OPEN_API_KEY=... python3 scripts/refresh_station_origins.py
    python3 scripts/refresh_station_origins.py --env-file .env.local --write
    python3 scripts/refresh_station_origins.py --check   # exit 1 on changes

The key is read from the environment or an env file and is never printed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "research" / "desk" / "substamp"
ORIGINS_PATH = DATA_DIR / "station-origins.json"
CARDS_PATH = DATA_DIR / "station-cards.draft.json"
SERVICE = "TbSeoulmetroStOrigin"
API_URL = "http://openapi.seoul.go.kr:8088/{key}/json/{service}/{start}/{end}/"
PAGE_SIZE = 1000
KEY_NAME = "SEOUL_OPEN_API_KEY"

HANJA = re.compile(r"[㐀-鿿豈-﫿]")
LEGEND = re.compile(r"전해|구전|전설|일설|설화|전래|설이 있|설과")


def build_stations(rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group API rows by station name, keeping every line and the longest text."""
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(str(row["STTN"]).strip(), []).append(row)
    stations = []
    for name in sorted(grouped):
        records = sorted(grouped[name], key=lambda row: str(row["SUBW_ID"]))
        texts = {(row.get("STTN_ORGN") or "").strip() for row in records}
        # Longest text wins; ties break on the text itself so reruns are stable.
        origin = max(texts, key=lambda text: (len(text), text))
        stations.append(
            {
                "stationKey": name,
                "nameKo": name,
                "lines": [
                    {"subwayId": str(row["SUBW_ID"]), "line": str(row["SBWY_ROUT_LN"])}
                    for row in records
                ],
                "originKo": origin,
                "textVariants": len(texts),
                "hasHanja": bool(HANJA.search(origin)),
                "legendMarker": bool(LEGEND.search(origin)),
            }
        )
    return stations


def diff_stations(
    old: list[dict[str, Any]], new: list[dict[str, Any]]
) -> dict[str, list[str]]:
    """Return station keys that were added, removed, or changed."""
    old_by_key = {station["stationKey"]: station for station in old}
    new_by_key = {station["stationKey"]: station for station in new}
    return {
        "added": sorted(new_by_key.keys() - old_by_key.keys()),
        "removed": sorted(old_by_key.keys() - new_by_key.keys()),
        "originChanged": sorted(
            key
            for key in old_by_key.keys() & new_by_key.keys()
            if old_by_key[key]["originKo"] != new_by_key[key]["originKo"]
        ),
        "linesChanged": sorted(
            key
            for key in old_by_key.keys() & new_by_key.keys()
            if old_by_key[key]["lines"] != new_by_key[key]["lines"]
        ),
    }


def cards_needing_review(
    cards: list[dict[str, Any]], new: list[dict[str, Any]]
) -> list[str]:
    """Cards whose source text differs from the current official text."""
    new_by_key = {station["stationKey"]: station for station in new}
    return sorted(
        card["stationKey"]
        for card in cards
        if card["stationKey"] in new_by_key
        and card.get("officialOriginKo") != new_by_key[card["stationKey"]]["originKo"]
    )


def apply_to_cards(
    cards: list[dict[str, Any]], new: list[dict[str, Any]]
) -> list[str]:
    """Update source text and lines on cards; flag changed ones for review."""
    new_by_key = {station["stationKey"]: station for station in new}
    flagged = []
    for card in cards:
        station = new_by_key.get(card["stationKey"])
        if station is None:
            continue
        card["lines"] = station["lines"]
        if card.get("officialOriginKo") != station["originKo"]:
            card["officialOriginKo"] = station["originKo"]
            card.setdefault("review", {})["facts"] = "origin_changed"
            flagged.append(card["stationKey"])
    return sorted(flagged)


def redact(text: str, key: str) -> str:
    return text.replace(key, "***") if key else text


def read_key(env_file: Path | None) -> str:
    key = os.environ.get(KEY_NAME, "").strip()
    if key or env_file is None:
        return key
    for line in env_file.read_text(encoding="utf-8").splitlines():
        name, sep, value = line.partition("=")
        if sep and name.strip() == KEY_NAME:
            return value.strip().strip("'\"")
    return ""


def fetch_rows(key: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 1
    while True:
        url = API_URL.format(key=key, service=SERVICE, start=start, end=start + PAGE_SIZE - 1)
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                payload = json.load(response)
        except (urllib.error.URLError, TimeoutError) as error:
            raise RuntimeError(redact(f"request failed: {error}", key)) from None
        body = payload.get(SERVICE)
        if not body:
            result = payload.get("RESULT", {})
            raise RuntimeError(f"API error: {result.get('CODE')} {result.get('MESSAGE')}")
        rows.extend(body.get("row", []))
        if len(rows) >= int(body.get("list_total_count", 0)) or not body.get("row"):
            return rows
        start += PAGE_SIZE


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--env-file", type=Path, help=f"file that defines {KEY_NAME}")
    parser.add_argument("--write", action="store_true", help="update the snapshot and cards")
    parser.add_argument("--check", action="store_true", help="exit 1 when anything changed")
    args = parser.parse_args(argv)

    key = read_key(args.env_file)
    if not key:
        print(f"{KEY_NAME} is not set (environment or --env-file).", file=sys.stderr)
        return 2

    snapshot = json.loads(ORIGINS_PATH.read_text(encoding="utf-8"))
    card_doc = json.loads(CARDS_PATH.read_text(encoding="utf-8"))
    try:
        rows = fetch_rows(key)
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return 2

    new = build_stations(rows)
    changes = diff_stations(snapshot["stations"], new)
    review = cards_needing_review(card_doc["cards"], new)
    without_cards = sorted({s["stationKey"] for s in new} - {c["stationKey"] for c in card_doc["cards"]})

    print(f"records: {len(rows)}, stations: {len(new)}")
    for label, keys in (
        ("added stations", changes["added"]),
        ("removed stations", changes["removed"]),
        ("origin text changed", changes["originChanged"]),
        ("lines changed", changes["linesChanged"]),
        ("cards needing review", review),
        ("stations without cards", without_cards),
    ):
        print(f"{label}: {len(keys)}" + (f" -> {', '.join(keys)}" if keys else ""))

    changed = any(changes.values()) or bool(review)
    if args.write and changed:
        snapshot["stations"] = new
        snapshot["source"]["fetchedAt"] = dt.date.today().isoformat()
        snapshot["source"]["records"] = len(rows)
        write_json(ORIGINS_PATH, snapshot)
        flagged = apply_to_cards(card_doc["cards"], new)
        write_json(CARDS_PATH, card_doc)
        print(f"wrote snapshot; flagged {len(flagged)} card(s) with review.facts=origin_changed")
    return 1 if args.check and changed else 0


if __name__ == "__main__":
    raise SystemExit(main())
