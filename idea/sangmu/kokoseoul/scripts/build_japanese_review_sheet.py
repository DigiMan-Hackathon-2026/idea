#!/usr/bin/env python3
"""Build the Japanese native-speaker review sheet from app content, UI strings,
quest drafts and station cards.

Usage:
    python3 scripts/build_japanese_review_sheet.py

Writes research/desk/japanese-review/japanese-review-sheet.csv. Rows are ordered
by how directly users will read them: app quest content first, then app UI
strings, then quest drafts that are not in the app yet, then station cards.
Re-run after content changes; the review columns start empty.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research" / "desk" / "japanese-review" / "japanese-review-sheet.csv"
CONTENT = ROOT / "src" / "modules" / "content"
DRAFTS = ROOT / "research" / "desk" / "quest-drafts"
CARDS = ROOT / "research" / "desk" / "substamp" / "station-cards.draft.json"

# Drafts whose quest already ships in the app; review the app text instead.
DRAFTS_IN_APP = {
    "changdeokgung-japanese-tour.md",
    "city-hall-seoul-library-first-loan.md",
    "sinchon-digiman-hackathon.md",
    "gwanghwamun-kyobo-find-book.md",
    "gwanghwamun-seoul-museum-city-model.md",
    "gwangjang-solo-meal.md",
    "yongsan-museum-room-of-quiet-contemplation.md",
    "myeongdong-kyoja-solo-kalguksu.md",
    "seongsu-oliveyoung-saved-product.md",
    "seongsu-oliveyoung-skin-consulting.md",
    "seongsu-somugwan-solo-gukbap.md",
    "yeouido-irotomo-first-meetup.md",
}

CONTEXT = {
    "titleJa": "퀘스트 제목",
    "summaryJa": "퀘스트 요약(목록·상세)",
    "bodyJa": "퀘스트 상세 본문",
    "scheduleJa": "일정 표시",
    "place.nameJa": "장소 이름",
    "titleJa@step": "단계 제목",
    "bodyJa@step": "단계 안내",
    "completionLabelJa@step": "단계 완료 버튼",
    "phraseJa@step": "직원에게 보여 줄 문장의 일본어 뜻",
}

FIELDS = [
    "id", "priority", "group", "file", "locator", "context", "ko", "ja",
    "review", "suggested_ja", "reviewer_code", "note",
]

KANA = re.compile(r"[぀-ゟ゠-ヿ]")
HANGUL = re.compile(r"[가-힣]")


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def app_content_rows() -> list[dict[str, str]]:
    rows = []
    for path in sorted(CONTENT.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for key in ("titleJa", "summaryJa", "bodyJa", "scheduleJa"):
            if isinstance(data.get(key), str):
                rows.append(row(1, "앱 퀘스트", path, key, CONTEXT[key], data.get(key[:-2] + "Ko", ""), data[key]))
        place = data.get("place") or {}
        if isinstance(place.get("nameJa"), str):
            rows.append(row(1, "앱 퀘스트", path, "place.nameJa", CONTEXT["place.nameJa"], place.get("nameKo", ""), place["nameJa"]))
        for index, step in enumerate(data.get("steps") or []):
            for key in ("titleJa", "bodyJa", "completionLabelJa", "phraseJa"):
                if isinstance(step.get(key), str):
                    rows.append(row(
                        1, "앱 퀘스트", path, f"steps[{index}].{key}", CONTEXT[key + "@step"],
                        step.get(key[:-2] + "Ko", ""), step[key],
                    ))
    return rows


PICK = re.compile(
    r'pickLocale\(\s*\w+\s*,\s*(["`])((?:\\.|(?!\1).)*)\1\s*,\s*(["`])((?:\\.|(?!\3).)*)\3\s*\)',
    re.S,
)


def ui_rows() -> list[dict[str, str]]:
    rows = []
    for path in sorted((ROOT / "src").rglob("*.ts*")):
        if ".test." in path.name:
            continue
        text = path.read_text(encoding="utf-8")
        for match in PICK.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            group = "앱 퀘스트 목록" if path.name == "page.tsx" and path.parent.name == "quests" else "앱 화면"
            priority = 1 if group == "앱 퀘스트 목록" else 2
            rows.append(row(priority, group, path, f"line {line}", "화면 문구", match.group(4), match.group(2)))
    return rows


def draft_rows() -> list[dict[str, str]]:
    rows = []
    for path in sorted(DRAFTS.glob("*.md")):
        if path.name in DRAFTS_IN_APP or path.name == "README.md":
            continue
        lines = path.read_text(encoding="utf-8").splitlines()
        previous_ko = ""
        for number, line in enumerate(lines, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            heading = re.match(r"^#{2,4}\s+(?:\d+\.\s*)?(.+?)\s+·\s+(.+)$", stripped)
            if heading and KANA.search(heading.group(2)):
                rows.append(row(3, "퀘스트 초안", path, f"line {number}", "단계·섹션 제목", heading.group(1), heading.group(2)))
                continue
            if stripped.startswith("日本語の意味："):
                rows.append(row(3, "퀘스트 초안", path, f"line {number}", "요청 문장의 일본어 뜻", previous_ko, stripped.removeprefix("日本語の意味：")))
                continue
            if stripped.startswith("> "):
                previous_ko = stripped[2:]
                continue
            if len(KANA.findall(stripped)) >= 3 and not stripped.startswith(("|", "[")):
                rows.append(row(3, "퀘스트 초안", path, f"line {number}", "단계 안내", previous_ko, stripped))
                continue
            if HANGUL.search(stripped) and not stripped.startswith(("|", "#", "-")):
                previous_ko = stripped
    return rows


def station_rows() -> list[dict[str, str]]:
    rows = []
    cards = json.loads(CARDS.read_text(encoding="utf-8"))["cards"]
    for card in cards:
        key = card["stationKey"]
        label = f"{key} {card.get('hanja') or ''}".strip()
        origin = (card.get("officialOriginKo") or "").strip()
        ko = f"{label} | {origin[:160]}" if origin else label
        rows.append(row(4, "역 카드", CARDS, f"{key}.titleJa", "카드 제목", label, card["titleJa"]))
        rows.append(row(4, "역 카드", CARDS, f"{key}.readingKoKana", "한국어 발음 가타카나", label, card["readingKoKana"]))
        rows.append(row(4, "역 카드", CARDS, f"{key}.kanjiNoteJa", "한자 풀이", label, card["kanjiNoteJa"]))
        rows.append(row(4, "역 카드", CARDS, f"{key}.storyJa", "유래 이야기", ko, card["storyJa"]))
        for index, item in enumerate(card.get("supplementJa") or []):
            rows.append(row(4, "역 카드", CARDS, f"{key}.supplementJa[{index}]", "보충 설명", label, item["text"]))
    return rows


def row(priority: int, group: str, path: Path, locator: str, context: str, ko: str, ja: str) -> dict[str, str]:
    return {
        "priority": str(priority), "group": group, "file": rel(path), "locator": locator,
        "context": context, "ko": ko or "", "ja": ja,
        "review": "", "suggested_ja": "", "reviewer_code": "", "note": "",
    }


def main() -> int:
    rows = app_content_rows() + ui_rows() + draft_rows() + station_rows()
    rows.sort(key=lambda item: int(item["priority"]))
    for number, item in enumerate(rows, start=1):
        item["id"] = f"J{number:04d}"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    counts: dict[str, int] = {}
    for item in rows:
        counts[item["group"]] = counts.get(item["group"], 0) + 1
    print(f"wrote {len(rows)} rows to {rel(OUT)}: {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
