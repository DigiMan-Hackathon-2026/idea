#!/usr/bin/env python3
"""Find Korean/Japanese pairs whose numbers or weekdays disagree.

Usage:
    python3 scripts/check_ko_ja_consistency.py

Uses the same rows as the Japanese review sheet (app quests, visit guides, UI
strings, option labels, quest drafts) and compares the numbers (times, prices,
exits, counts, years) and weekdays on both sides. Station cards are checked
against the Seoul Metro original instead: every number the Japanese title or
story writes in digits must appear in the original, unless the card's factChecksKo records the
correction or the number spells out a two-digit year from the original
("98." -> 1998).

Differences made only of the number 1 are ignored, because "한 권" or "一つ"
often appears on one side only as wording. Prints one block per mismatch and exits 1 when any are found. A mismatch is a
lead to check, not proof of an error.
"""

from __future__ import annotations

import collections
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts import build_japanese_review_sheet as sheet  # noqa: E402

KO_NATIVE = {
    "한": 1, "하나": 1, "두": 2, "둘": 2, "세": 3, "셋": 3, "네": 4, "넷": 4, "다섯": 5,
    "여섯": 6, "일곱": 7, "여덟": 8, "아홉": 9, "열": 10,
}
KO_COUNTERS = "명|개|장|그릇|잔|권|사람|곳|가지|번|분|병|접시|마리|그루|벌|켤레|송이|줄|인분"
KO_NATIVE_COUNT = re.compile(
    rf"(?<![가-힣\d])({'|'.join(sorted(KO_NATIVE, key=len, reverse=True))})\s*(?=(?:{KO_COUNTERS}))"
)
# 두·세 and larger native numerals are numbers before any noun ("두 향", "세 마을");
# 한, 네 and 열 also mean "a", "yes" and "open", so they need a counter.
KO_NATIVE_NOUN = re.compile(r"(?<![가-힣\d])(두|세|다섯|여섯|일곱|여덟|아홉)\s+(?=[가-힣])")
KO_GROUP = re.compile(r"(?<![가-힣])(둘|셋|넷)(?=이(?![가-힣])|서)")
KO_STANDALONE_ONE = re.compile(r"(?<![가-힣])(?:하나|혼자)(?=(?:[를가는도만]|서)?(?![가-힣]))|(?<![가-힣])일\s*년")

JA_KANJI = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
JA_COUNTERS = "つ|体|点|人|杯|冊|枚|個|度|品|皿|本|名|軒|回|か所|ヶ所|種類|匹|着|足|束|株"
JA_KANJI_COUNT = re.compile(rf"([一二三四五六七八九十])(?=(?:{JA_COUNTERS}))")
JA_BOTH = re.compile(r"両(?=[日名人])")
JA_KANA_COUNT = {"ひとつ": 1, "ひとり": 1, "ふたつ": 2, "ふたり": 2}

KO_DAYS = "월화수목금토일"
JA_DAYS = "月火水木金土日"


def _normalize_man(text: str, man: str, thousand: str) -> str:
    def repl(match: re.Match[str]) -> str:
        value = int(match.group(1)) * 10000
        if match.group(2):
            value += int(match.group(2)) * 1000
        return str(value)

    return re.sub(rf"(\d+)\s*{man}(?:\s*(\d+)\s*{thousand})?", repl, text)


def numbers(text: str, lang: str, counted_kanji: bool = True) -> collections.Counter[str]:
    """Numbers in the text, with counted native or kanji numerals turned into digits.

    With counted_kanji=False, Japanese kanji counts such as 三つ are left out, so
    only numbers written in digits are compared.
    """
    t = re.sub(r"https?://\S+", " ", text)
    t = re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "", t)
    if lang == "ko":
        t = _normalize_man(t, "만", "천")
        t = KO_NATIVE_COUNT.sub(lambda m: f" {KO_NATIVE[m.group(1)]} ", t)
        t = KO_NATIVE_NOUN.sub(lambda m: f" {KO_NATIVE[m.group(1)]} ", t)
        t = KO_GROUP.sub(lambda m: f" {KO_NATIVE[m.group(1)]} ", t)
        t = KO_STANDALONE_ONE.sub(" 1 ", t)
    else:
        t = _normalize_man(t, "万", "千")
        if counted_kanji:
            t = JA_KANJI_COUNT.sub(lambda m: f" {JA_KANJI[m.group(1)]} ", t)
            t = JA_BOTH.sub(" 2 ", t)
            for word, value in JA_KANA_COUNT.items():
                t = t.replace(word, f" {value} ")
    t = re.sub(r"(?<!\d)0(\d):", r"\1:", t)
    found = re.findall(r"\d+(?::\d{2})?", t)
    return collections.Counter(n for n in found if len(n) <= 8)


def weekdays(text: str, lang: str) -> set[str]:
    """Weekdays written as 수요일 / 水曜, as a run like 수·금·일 / 水・金・日曜 or 화~일, or as (수) / （水）."""
    days, suffix, word = (KO_DAYS, "요", "가-힣") if lang == "ko" else (JA_DAYS, "曜", "一-鿿")
    hits = set(re.findall(rf"([{days}]){suffix}", text))
    run = re.compile(rf"(?<![{word}])[{days}](?:\s*[·・,、~〜]\s*[{days}])+(?={suffix}|[^{word}]|$)")
    for match in run.finditer(text):
        hits.update(re.findall(rf"[{days}]", match.group(0)))
    hits.update(re.findall(rf"[(（]([{days}])[)）]", text))
    return {str(days.index(h)) for h in hits}


def pair_issues(rows: list[dict[str, str]]) -> list[dict[str, object]]:
    issues = []
    for item in rows:
        ko, ja = item["ko"], item["ja"]
        if not ko.strip():
            continue
        nk, nj = numbers(ko, "ko"), numbers(ja, "ja")
        # "책 한 권 찾기" / "本を見つける": a lone "one" is wording, not information.
        if set((nk - nj) + (nj - nk)) - {"1"}:
            issues.append({"kind": "숫자", "row": item, "only_ko": sorted((nk - nj).elements()), "only_ja": sorted((nj - nk).elements())})
        dk, dj = weekdays(ko, "ko"), weekdays(ja, "ja")
        if dk != dj:
            issues.append({
                "kind": "요일", "row": item,
                "only_ko": [KO_DAYS[int(d)] for d in sorted(dk - dj)],
                "only_ja": [JA_DAYS[int(d)] for d in sorted(dj - dk)],
            })
    return issues


def card_issues(cards: list[dict]) -> list[dict[str, object]]:
    issues = []
    for card in cards:
        source = card.get("officialOriginKo") or ""
        if not source:
            continue
        allowed = set(numbers(source, "ko")) | set(numbers(" ".join(card.get("factChecksKo") or []), "ko"))
        two_digit_years = set(re.findall(r"(?<!\d)(\d{2})(?=\s*[.년]|\s+[가-힣])", source))
        for field in ("titleJa", "storyJa"):
            extra = [
                n for n in numbers(card[field], "ja", counted_kanji=False)
                if n not in allowed and not (len(n) == 4 and n[:2] in ("19", "20") and n[2:] in two_digit_years)
            ]
            if extra:
                item = {
                    "group": "역 카드", "file": sheet.rel(sheet.CARDS), "locator": f"{card['stationKey']}.{field}",
                    "context": "원문에 없는 숫자", "ko": source, "ja": card[field],
                }
                issues.append({"kind": "숫자", "row": item, "only_ko": [], "only_ja": extra})
    return issues


def collect() -> list[dict[str, object]]:
    rows = (
        sheet.app_content_rows() + sheet.ui_rows() + sheet.label_rows()
        + sheet.module_rows() + sheet.draft_rows()
    )
    cards = json.loads(sheet.CARDS.read_text(encoding="utf-8"))["cards"]
    return pair_issues(rows) + card_issues(cards)


def main() -> int:
    issues = collect()
    for issue in issues:
        item = issue["row"]
        print(f"[{issue['kind']}] {item['group']} {item['file']} {item['locator']} ({item['context']})")
        print(f"  한국어에만: {issue['only_ko']}  일본어에만: {issue['only_ja']}")
        print(f"  KO: {item['ko'][:200]}")
        print(f"  JA: {item['ja'][:200]}")
    print(f"{len(issues)} mismatches")
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
