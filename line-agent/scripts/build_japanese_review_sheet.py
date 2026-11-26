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
FIRST_PASS_OUT = OUT.with_name("japanese-review-first-pass.csv")
CONTENT = ROOT / "src" / "modules" / "content"
DRAFTS = ROOT / "research" / "desk" / "quest-drafts"
CARDS = ROOT / "research" / "desk" / "substamp" / "station-cards.draft.json"
VISIT_GUIDES = CONTENT / "visit-guides"
TRANSIT = ROOT / "src" / "modules" / "transit"

# Drafts whose quest already ships in the app; review the app text instead.
# Drafts named like an app quest file or visit-guide slug are skipped automatically,
# so list only drafts whose app file has a different name.
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
    "insadong-ssamziegil-craft-gift.md",
}

CONTEXT = {
    "titleJa": "퀘스트 제목",
    "summaryJa": "퀘스트 요약(목록·상세)",
    "bodyJa": "퀘스트 상세 본문",
    "scheduleJa": "일정 표시",
    "detailJa": "목록 카드 보조 문구",
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
# A Korean sentence followed by its Japanese translation on the same line.
MIXED_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[^\s가-힣]*[぀-ゟ゠-ヿ一-鿿])")


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def app_quests() -> list[tuple[Path, str, dict]]:
    """App quest JSON files plus visit guides (lists of quests), with locator prefixes."""
    quests = []
    for path in sorted(CONTENT.glob("*.json")):
        quests.append((path, "", json.loads(path.read_text(encoding="utf-8"))))
    for path in sorted(VISIT_GUIDES.glob("*.json")) if VISIT_GUIDES.is_dir() else []:
        for index, data in enumerate(json.loads(path.read_text(encoding="utf-8"))):
            quests.append((path, f"[{index}:{data.get('slug', index)}].", data))
    return quests


def drafts_in_app() -> set[str]:
    names = set(DRAFTS_IN_APP)
    for path, prefix, data in app_quests():
        if not prefix:
            names.add(f"{path.stem}.md")
        if data.get("slug"):
            names.add(f"{data['slug']}.md")
    return names


def app_content_rows() -> list[dict[str, str]]:
    rows = []
    for path, prefix, data in app_quests():
        for key in ("titleJa", "summaryJa", "bodyJa", "detailJa", "scheduleJa"):
            if isinstance(data.get(key), str):
                rows.append(row(1, "앱 퀘스트", path, prefix + key, CONTEXT[key], data.get(key[:-2] + "Ko", ""), data[key]))
        place = data.get("place") or {}
        if isinstance(place.get("nameJa"), str):
            rows.append(row(1, "앱 퀘스트", path, prefix + "place.nameJa", CONTEXT["place.nameJa"], place.get("nameKo", ""), place["nameJa"]))
        for index, step in enumerate(data.get("steps") or []):
            for key in ("titleJa", "bodyJa", "completionLabelJa", "phraseJa"):
                if isinstance(step.get(key), str):
                    rows.append(row(
                        1, "앱 퀘스트", path, f"{prefix}steps[{index}].{key}", CONTEXT[key + "@step"],
                        step.get(key[:-2] + "Ko", ""), step[key],
                    ))
    return rows


PICK = re.compile(
    r'pickLocale\(\s*\w+\s*,\s*(["`])((?:\\.|(?!\1).)*)\1\s*,\s*(["`])((?:\\.|(?!\3).)*)\3\s*,?\s*\)',
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


FIELD_JA = re.compile(r'\b(\w*?)Ja\s*:\s*(["`])((?:\\.|(?!\2).)*)\2', re.S)
MAP_JA = re.compile(r'(\w+)\s*:\s*(["`])((?:\\.|(?!\2).)*)\2', re.S)


def nearest_ko(text: str, stem: str, start: int, end: int, reach: int = 600) -> str:
    """The `<stem>Ko` field closest to a `<stem>Ja` field, written before or after it."""
    field = re.compile(rf'\b{re.escape(stem)}Ko\s*:\s*(["`])((?:\\.|(?!\1).)*)\1', re.S)
    after = field.search(text, end, end + reach)
    before = None
    for candidate in field.finditer(text, max(0, start - reach), start):
        before = candidate
    if after and (not before or after.start() - end <= start - before.end()):
        return after.group(2)
    return before.group(2) if before else ""


def module_rows() -> list[dict[str, str]]:
    """Japanese strings stored as `fooJa: "..."` fields in TypeScript modules."""
    rows = []
    for path in sorted((ROOT / "src").rglob("*.ts")):
        if ".test." in path.name or path.name.endswith(".d.ts"):
            continue
        text = path.read_text(encoding="utf-8")
        for match in FIELD_JA.finditer(text):
            value = match.group(3)
            if not KANA.search(value) and not re.search(r"[一-鿿]", value):
                continue
            stem = match.group(1)
            ko = nearest_ko(text, stem, match.start(), match.end())
            line = text.count("\n", 0, match.start()) + 1
            rows.append(row(2, "앱 데모·선택지", path, f"line {line}", f"{stem or 'text'}Ja 필드", ko, value))
    return rows


LABEL_OBJECT = re.compile(r"export const (\w+_LABELS)(_KO)?\b[^=]*=\s*\{(.*?)\n\}(?:\s*as\s+const)?;", re.S)
LABEL_ENTRY = re.compile(r'^\s*"?([\w-]+)"?\s*:\s*"((?:\\.|[^"])*)"', re.M)
LABEL_PAIR = re.compile(r'"?([\w-]+)"?\s*:\s*\{\s*ja\s*:\s*"((?:\\.|[^"])*)"\s*,\s*ko\s*:\s*"((?:\\.|[^"])*)"\s*,?\s*\}', re.S)


def label_rows() -> list[dict[str, str]]:
    """Option labels kept as paired `FOO_LABELS` (Japanese) and `FOO_LABELS_KO` objects."""
    rows = []
    for path in sorted((ROOT / "src").rglob("*.ts")):
        if ".test." in path.name:
            continue
        text = path.read_text(encoding="utf-8")
        objects: dict[str, dict[str, tuple[str, int]]] = {}
        for match in LABEL_OBJECT.finditer(text):
            name = match.group(1) + (match.group(2) or "")
            body_start = match.start(3)
            objects[name] = {
                entry.group(1): (entry.group(2), text.count("\n", 0, body_start + entry.start(1)) + 1)
                for entry in LABEL_ENTRY.finditer(match.group(3))
            }
        for match in LABEL_OBJECT.finditer(text):
            if match.group(2):
                continue
            body_start = match.start(3)
            for pair in LABEL_PAIR.finditer(match.group(3)):
                line = text.count("\n", 0, body_start + pair.start(1)) + 1
                rows.append(row(2, "앱 데모·선택지", path, f"line {line} ({match.group(1)}.{pair.group(1)})", "선택지 라벨", pair.group(3), pair.group(2)))
        for name, entries in objects.items():
            if name.endswith("_KO"):
                continue
            entries = {key: value for key, value in entries.items() if key not in ("ja", "ko")}
            korean = objects.get(name + "_KO", {})
            for key, (value, line) in entries.items():
                if not KANA.search(value) and not re.search(r"[一-鿿]", value):
                    continue
                rows.append(row(2, "앱 데모·선택지", path, f"line {line} ({name}.{key})", "선택지 라벨", korean.get(key, ("", 0))[0], value))
    return rows


def draft_rows() -> list[dict[str, str]]:
    rows = []
    in_app = drafts_in_app()
    for path in sorted(DRAFTS.glob("*.md")):
        if path.name in in_app or path.name == "README.md":
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
                mixed = MIXED_SPLIT.search(stripped) if HANGUL.search(stripped[:20]) else None
                if mixed:
                    rows.append(row(3, "퀘스트 초안", path, f"line {number}", "단계 안내", stripped[:mixed.start()], stripped[mixed.end():]))
                else:
                    rows.append(row(3, "퀘스트 초안", path, f"line {number}", "단계 안내", previous_ko, stripped))
                continue
            if HANGUL.search(stripped) and not stripped.startswith(("|", "#", "-", "[")):
                previous_ko = stripped
    return rows


PAIR_OBJECT = re.compile(
    r'\b(ja|ko)\s*:\s*(["`])((?:\\.|(?!\2).)*)\2\s*,\s*(ja|ko)\s*:\s*(["`])((?:\\.|(?!\5).)*)\5', re.S,
)
PAIR_TUPLE = re.compile(
    r'\[\s*(["`])((?:\\.|(?!\1).)*[぀-ヿ一-鿿](?:\\.|(?!\1).)*)\1\s*,\s*(["`])((?:\\.|(?!\3).)*[가-힣](?:\\.|(?!\3).)*)\3\s*\]',
    re.S,
)


def pair_rows(seen: set[tuple[str, str]]) -> list[dict[str, str]]:
    """Strings kept as `{ ja, ko }` objects (either order) or `[ja, ko]` tuples."""
    rows = []
    for path in sorted((ROOT / "src").rglob("*.ts*")):
        if ".test." in path.name or path.name.endswith(".d.ts"):
            continue
        text = path.read_text(encoding="utf-8")
        found = []
        for match in PAIR_OBJECT.finditer(text):
            if match.group(1) == match.group(4):
                continue
            ja, ko = (match.group(3), match.group(6)) if match.group(1) == "ja" else (match.group(6), match.group(3))
            found.append((match.start(), ja, ko))
        for match in PAIR_TUPLE.finditer(text):
            found.append((match.start(), match.group(2), match.group(4)))
        for start, ja, ko in sorted(found):
            if (rel(path), ja) in seen or not (KANA.search(ja) or re.search(r"[一-鿿]", ja)):
                continue
            seen.add((rel(path), ja))
            line = text.count("\n", 0, start) + 1
            rows.append(row(2, "앱 화면", path, f"line {line}", "화면 문구(ja·ko 쌍)", ko, ja))
    return rows


STATION_CALL = re.compile(r'\b\w*[sS]tation\(\s*"([\w-]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,')


def station_name_rows() -> list[dict[str, str]]:
    """Subway station names shown in the subway guide, by line and station code."""
    names = []
    for path in (TRANSIT / "line-two.ts", TRANSIT / "subway-stations.ts"):
        text = path.read_text(encoding="utf-8")
        line = "2" if path.name == "line-two.ts" else "3"
        for match in STATION_CALL.finditer(text):
            names.append((path, line, match.group(1), match.group(2), match.group(3)))
    path = TRANSIT / "subway-station-names.json"
    for code, ko, ja, _ in json.loads(path.read_text(encoding="utf-8")):
        names.append((path, code.lstrip("P")[0], code, ko, ja))
    names.sort(key=lambda item: (item[1], item[2]))
    return [row(2, "지하철 역명", path, f"{line}호선 {code}", "역 이름", ko, ja) for path, line, code, ko, ja in names]


# First-pass review: what users read before anything else.
FIRST_PASS_FILES = {
    "src/app/page.tsx", "src/app/layout.tsx", "src/app/error.tsx", "src/app/not-found.tsx",
    "src/components/site-header.tsx", "src/components/language-switcher.tsx",
    "src/components/quest-onboarding.tsx", "src/components/filter-form.tsx", "src/components/quest-card.tsx",
    "src/components/quest-results-view.tsx", "src/components/visit-guide-page.tsx",
    "src/app/quests/[questId]/page.tsx", "src/app/quests/[questId]/not-found.tsx",
    "src/app/subway/page.tsx", "src/app/subway/subway-page-content.tsx", "src/app/subway/nearby-station-picker.tsx",
    "src/components/subway-direction-guide.tsx", "src/components/subway-sign-camera.tsx",
    "src/components/subway-transfer-sign-check.tsx", "src/app/quests/nearby/page.tsx",
    "src/app/quests/nearby/station-quests.tsx", "src/components/quest-access-card.tsx",
    "src/app/quests/courses/page.tsx", "src/modules/content/quest-courses.ts",
    "src/components/closed-today-notice.tsx",
    "src/app/station-album/page.tsx", "src/app/station-album/station-album.tsx",
    "src/app/station-album/stamp-image.tsx", "src/app/station-album/album-data.ts",
}
FIRST_PASS_QUEST_FIELDS = re.compile(
    r"^(?:\[[^\]]+\]\.)?(?:titleJa|summaryJa|place\.nameJa)$|\.phraseJa$"
)


def is_first_pass(item: dict[str, str]) -> bool:
    if item["group"] == "앱 퀘스트 목록":
        return True
    if item["group"] == "앱 퀘스트":
        return bool(FIRST_PASS_QUEST_FIELDS.search(item["locator"]))
    return item["group"] == "앱 화면" and item["file"] in FIRST_PASS_FILES


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


def write(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    rows = app_content_rows() + ui_rows() + label_rows() + module_rows()
    rows += pair_rows({(item["file"], item["ja"]) for item in rows})
    rows += station_name_rows() + draft_rows() + station_rows()
    rows.sort(key=lambda item: int(item["priority"]))
    for number, item in enumerate(rows, start=1):
        item["id"] = f"J{number:04d}"
    write(OUT, rows)
    first_pass = [item for item in rows if is_first_pass(item)]
    write(FIRST_PASS_OUT, first_pass)
    counts: dict[str, int] = {}
    for item in rows:
        counts[item["group"]] = counts.get(item["group"], 0) + 1
    print(f"wrote {len(rows)} rows to {rel(OUT)}: {counts}")
    print(f"wrote {len(first_pass)} first-pass rows to {rel(FIRST_PASS_OUT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
