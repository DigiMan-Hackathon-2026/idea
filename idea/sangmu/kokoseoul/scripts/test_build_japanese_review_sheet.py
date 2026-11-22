#!/usr/bin/env python3
"""Regression tests for the Japanese review sheet generator."""

from __future__ import annotations

import tempfile
import unittest
import unittest.mock
from pathlib import Path

from scripts import build_japanese_review_sheet as sheet


class PairRowsTest(unittest.TestCase):
    def test_reads_objects_in_either_order_and_tuples(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            (root / "src" / "guide.tsx").write_text(
                'const a = { ja: "乗る前", ko: "타기 전" };\n'
                'const b = { ko: "소나무", ja: "松" };\n'
                'const c = ["位置情報を許可してください。", "위치 접근을 허용해 주세요."];\n'
                'const d = { ja: "same", ko: "같음" };\n',
                encoding="utf-8",
            )
            with unittest.mock.patch.object(sheet, "ROOT", root):
                rows = sheet.pair_rows(set())
        self.assertEqual(
            [(item["locator"], item["ja"], item["ko"]) for item in rows],
            [("line 1", "乗る前", "타기 전"), ("line 2", "松", "소나무"),
             ("line 3", "位置情報を許可してください。", "위치 접근을 허용해 주세요.")],
        )

    def test_skips_strings_already_in_the_sheet(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            (root / "src" / "page.tsx").write_text('x = { ja: "開く", ko: "열기" };\n', encoding="utf-8")
            with unittest.mock.patch.object(sheet, "ROOT", root):
                rows = sheet.pair_rows({("src/page.tsx", "開く")})
        self.assertEqual(rows, [])


class UiRowsTest(unittest.TestCase):
    def test_reads_multiline_calls_with_a_trailing_comma(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            (root / "src" / "card.tsx").write_text(
                'pickLocale(locale, "開く", "열기");\n'
                "pickLocale(\n  locale,\n  `約${n} mです。`,\n  `약 ${n} m예요.`,\n);\n",
                encoding="utf-8",
            )
            with unittest.mock.patch.object(sheet, "ROOT", root):
                rows = sheet.ui_rows()
        self.assertEqual(
            [(item["locator"], item["ja"], item["ko"]) for item in rows],
            [("line 1", "開く", "열기"), ("line 2", "約${n} mです。", "약 ${n} m예요.")],
        )


class StationNameRowsTest(unittest.TestCase):
    def test_every_app_station_has_one_row(self) -> None:
        rows = sheet.station_name_rows()
        locators = [item["locator"] for item in rows]
        self.assertEqual(len(locators), len(set(locators)))
        self.assertIn(("2호선 201", "시청", "市庁"), [(item["locator"], item["ko"], item["ja"]) for item in rows])
        self.assertTrue(all(item["ko"] and item["ja"] for item in rows))


class FirstPassTest(unittest.TestCase):
    def row(self, group: str, file: str, locator: str) -> dict[str, str]:
        return {"group": group, "file": file, "locator": locator}

    def test_selects_titles_summaries_and_staff_phrases(self) -> None:
        quest = "src/modules/content/visit-guides/food.json"
        self.assertTrue(sheet.is_first_pass(self.row("앱 퀘스트", quest, "[0:seochon].titleJa")))
        self.assertTrue(sheet.is_first_pass(self.row("앱 퀘스트", quest, "[0:seochon].steps[1].phraseJa")))
        self.assertFalse(sheet.is_first_pass(self.row("앱 퀘스트", quest, "[0:seochon].steps[0].titleJa")))
        self.assertFalse(sheet.is_first_pass(self.row("앱 퀘스트", quest, "[0:seochon].bodyJa")))

    def test_selects_core_screens_only(self) -> None:
        self.assertTrue(sheet.is_first_pass(self.row("앱 화면", "src/components/subway-direction-guide.tsx", "line 1")))
        self.assertFalse(sheet.is_first_pass(self.row("앱 화면", "src/components/report-button.tsx", "line 1")))
        self.assertFalse(sheet.is_first_pass(self.row("지하철 역명", "src/modules/transit/line-two.ts", "2호선 201")))


if __name__ == "__main__":
    unittest.main()
