#!/usr/bin/env python3
"""Regression tests for the Korean/Japanese consistency check."""

from __future__ import annotations

import unittest

from scripts import check_ko_ja_consistency as check


def pair(ko: str, ja: str) -> dict[str, str]:
    return {"group": "앱 퀘스트", "file": "x.json", "locator": "bodyJa", "context": "", "ko": ko, "ja": ja}


def card(origin: str, story: str, fact_checks: list[str] | None = None) -> dict:
    return {
        "stationKey": "테스트", "officialOriginKo": origin, "titleJa": "題名",
        "storyJa": story, "factChecksKo": fact_checks or [],
    }


class PairTest(unittest.TestCase):
    def test_matching_times_prices_and_days_pass(self) -> None:
        issues = check.pair_issues([pair(
            "일본어 해설은 수·금·일 11시에 시작하고 약 50분 걸려요. 입장료는 3,000원, 체험은 20만 원이에요. 8번 출구로 나와요.",
            "日本語ガイドは水・金・日曜の11時から約50分です。入場料は3000ウォン、体験は20万ウォンです。8番出口を出ます。",
        )])
        self.assertEqual(issues, [])

    def test_changed_time_is_reported(self) -> None:
        issues = check.pair_issues([pair("11시에 시작해요.", "10時に始まります。")])
        self.assertEqual([(i["kind"], i["only_ko"], i["only_ja"]) for i in issues], [("숫자", ["11"], ["10"])])

    def test_changed_weekday_is_reported(self) -> None:
        issues = check.pair_issues([pair("화~일 9:00~18:00에 열어요.", "火〜土曜の9:00〜18:00に開いています。")])
        self.assertEqual([(i["kind"], i["only_ko"], i["only_ja"]) for i in issues], [("요일", ["일"], ["土"])])

    def test_counted_native_numerals_match_digits(self) -> None:
        issues = check.pair_issues([
            pair("외국인과 동행하는 한국인은 두 명까지 함께할 수 있어요.", "同行する韓国籍の方は2人まで参加できます。"),
            pair("공예 소품 두 개를 비교해 선물 하나를 골라요.", "工芸小物を二つ見比べて、贈り物を一つ選びます。"),
            pair("둘이", "二人"),
            pair("반가사유상 두 점, 만 19~64세 기준", "二体の半跏思惟像、19〜64歳"),
            pair("두 날짜 모두 참석해야 하는지", "両日出席が必要か"),
            pair("이 두 향을 비교해 보고 싶어요.", "この二つの香りを比べたいです。"),
            pair("네, 문을 열 수 있어요.", "はい、開けられます。"),
            pair("세계자료실에 두고 가요. 둘 다 어렵다면", "世界資料室に置いていきます。どちらも難しければ"),
        ])
        self.assertEqual(issues, [])

    def test_words_that_contain_weekday_kanji_are_not_weekdays(self) -> None:
        issues = check.pair_issues([pair(
            "오늘 요금과 대기 시간을 물어봐요. 게시일 2026-08-24.",
            "今日の料金と待ち時間を聞きます。公開日 2026-08-24。",
        )])
        self.assertEqual(issues, [])

    def test_lone_one_is_wording(self) -> None:
        issues = check.pair_issues([pair("원하는 책 한 권 찾기", "探している本を見つける")])
        self.assertEqual(issues, [])

    def test_link_urls_are_ignored(self) -> None:
        issues = check.pair_issues([pair(
            "[지도](https://map.naver.com/p/search/%ED%98%9C%ED%99%94%EB%AC%B8) 혜화문",
            "恵化門",
        )])
        self.assertEqual(issues, [])


class CardTest(unittest.TestCase):
    def test_year_missing_from_original_is_reported(self) -> None:
        issues = check.card_issues([card("영조 15년(1736년)에 중수했다.", "英祖15年（1739年）に修復された。")])
        self.assertEqual([i["only_ja"] for i in issues], [["1739"]])

    def test_documented_correction_passes(self) -> None:
        issues = check.card_issues([card(
            "영조 15년(1736년)에 중수했다.", "英祖15年（1739年）に修復された。",
            ["원문의 1736년은 영조실록에 따라 1739년으로 정정"],
        )])
        self.assertEqual(issues, [])

    def test_two_digit_year_and_native_numerals_pass(self) -> None:
        issues = check.card_issues([card(
            "\"98. 10.1 개칭. 아홉명의 노인이 살았고 자연부락 7,8개 마을이 있었다.",
            "1998年に改称した。9人の老人が住み、7、8の村があった。",
        )])
        self.assertEqual(issues, [])

    def test_kanji_counts_in_titles_are_not_compared(self) -> None:
        issues = check.card_issues([card("세마을을 합하여 지은 이름이다.", "三つの村が合わさった町")])
        self.assertEqual(issues, [])


if __name__ == "__main__":
    unittest.main()
