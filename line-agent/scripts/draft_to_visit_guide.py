#!/usr/bin/env python3
"""Turn a quest draft into a visit-guide JSON skeleton.

    python3 scripts/draft_to_visit_guide.py research/desk/quest-drafts/<slug>.md \\
        --purpose rest --area jamsil --minutes 60

The draft's steps (`### N. 한국어 · 日本語` with a Korean and a Japanese paragraph)
and its phrase (`> 한국어` followed by `日本語の意味：…`) are copied. Fields a draft
does not carry, such as the Japanese title or completion labels, are filled with
"TODO" so the content rules test fails until someone writes them. New UUIDs are
generated for every id. The result goes to stdout; paste it into
src/modules/content/visit-guides/<purpose>.json after review.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from datetime import date
from pathlib import Path

TODO = "TODO"
STEP = re.compile(r"^###\s+\d+\.\s*(.+?)\s+·\s+(.+?)\s*$")
SECTION = re.compile(r"^##\s+")
HANGUL = re.compile(r"[가-힣]")
KANA = re.compile(r"[ぁ-んァ-ヶ]")
MAP_LINK = re.compile(r"\(https://map\.naver\.com/[^)]+\)")
SOURCE_LINK = re.compile(r"\((https://[^)\s]+)\)")


def parse_draft(text: str) -> dict:
    lines = text.splitlines()
    title = next((line[2:].strip() for line in lines if line.startswith("# ")), TODO)
    lead = ""
    for line in lines[1:]:
        stripped = line.strip()
        if stripped.startswith("## "):
            break
        if stripped and not stripped.startswith("작성일") and HANGUL.search(stripped):
            lead = stripped
            break

    steps: list[dict] = []
    phrase: tuple[str, str] | None = None
    sources: list[str] = []
    current: dict | None = None
    section = ""
    pending_ko = ""
    for line in lines:
        stripped = line.strip()
        step = STEP.match(stripped)
        if step:
            current = {"titleKo": step.group(1), "titleJa": step.group(2), "bodyKo": "", "bodyJa": ""}
            steps.append(current)
            continue
        if SECTION.match(stripped):
            current = None
            section = stripped
            continue
        if stripped.startswith("> "):
            pending_ko = stripped[2:].strip()
            continue
        if stripped.startswith("日本語の意味：") and pending_ko and phrase is None:
            phrase = (pending_ko, stripped.removeprefix("日本語の意味："))
            continue
        if section.startswith("## 출처"):
            sources.extend(SOURCE_LINK.findall(stripped))
            continue
        if current is None or not stripped or MAP_LINK.search(stripped) or stripped.startswith("지도가 열리지"):
            continue
        if KANA.search(stripped) and not current["bodyJa"]:
            current["bodyJa"] = stripped
        elif HANGUL.search(stripped) and not current["bodyKo"]:
            current["bodyKo"] = stripped
    return {"title": title, "lead": lead, "steps": steps, "phrase": phrase, "sources": sources}


def build_guide(slug: str, draft: dict, purpose: str, area: str, minutes: int, checked: str) -> dict:
    steps = []
    for index, step in enumerate(draft["steps"]):
        entry = {
            "id": str(uuid.uuid4()),
            "titleKo": step["titleKo"],
            "titleJa": step["titleJa"],
            "bodyKo": step["bodyKo"] or TODO,
            "bodyJa": step["bodyJa"] or TODO,
            "completionLabelKo": TODO,
            "completionLabelJa": TODO,
        }
        if index == 0:
            entry["showsPlace"] = True
        steps.append(entry)
    if draft["phrase"] and steps:
        # The phrase usually belongs to the step where visitors ask for help; check it.
        target = steps[1] if len(steps) > 1 else steps[0]
        target["phraseKo"], target["phraseJa"] = draft["phrase"]
    source = draft["sources"][0] if draft["sources"] else TODO
    return {
        "id": str(uuid.uuid4()),
        "versionId": str(uuid.uuid4()),
        "slug": slug,
        "areaCode": area,
        "purpose": purpose,
        "titleKo": draft["title"],
        "titleJa": TODO,
        "summaryKo": draft["lead"] or TODO,
        "summaryJa": TODO,
        "bodyKo": TODO,
        "bodyJa": TODO,
        "detailKo": TODO,
        "detailJa": TODO,
        "durationMinutes": minutes,
        "place": {
            "id": str(uuid.uuid4()),
            "nameKo": TODO,
            "nameJa": TODO,
            "addressKo": TODO,
            "guideUrlKo": source,
            "guideUrlJa": source,
            "verifiedAt": f"{checked}T00:00:00+09:00",
        },
        "steps": steps,
        "seed": {"supplierId": str(uuid.uuid4()), "editorId": str(uuid.uuid4()), "requestId": str(uuid.uuid4())},
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("draft", type=Path)
    parser.add_argument("--purpose", required=True, choices=["food", "culture", "shopping", "beauty", "rest", "discovery"])
    parser.add_argument("--area", required=True)
    parser.add_argument("--minutes", type=int, required=True)
    parser.add_argument("--checked", default=date.today().isoformat(), help="date the official sources were checked")
    args = parser.parse_args(argv)
    draft = parse_draft(args.draft.read_text(encoding="utf-8"))
    if not 3 <= len(draft["steps"]) <= 5:
        print(f"{args.draft}: expected 3 to 5 steps, found {len(draft['steps'])}", file=sys.stderr)
        return 1
    guide = build_guide(args.draft.stem, draft, args.purpose, args.area, args.minutes, args.checked)
    json.dump(guide, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
