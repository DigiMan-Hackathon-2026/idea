#!/usr/bin/env python3
"""Regression tests for the station-origin refresh script."""

from __future__ import annotations

import tempfile
import unittest
import unittest.mock
from pathlib import Path

from scripts import refresh_station_origins as refresh


def row(subway_id: str, name: str, line: str, origin: str) -> dict[str, str]:
    return {"SUBW_ID": subway_id, "STTN": name, "SBWY_ROUT_LN": line, "STTN_ORGN": origin}


class BuildStationsTest(unittest.TestCase):
    def test_groups_lines_and_keeps_longest_text(self) -> None:
        stations = refresh.build_stations(
            [
                row("2541", "왕십리", "05호선", "왕십리(往十里)라 전해오고 있다."),
                row("0208", "왕십리", "02호선", "왕십리(往十里)라 전해오고 있다. 추가"),
            ]
        )

        self.assertEqual(len(stations), 1)
        station = stations[0]
        self.assertEqual([line["subwayId"] for line in station["lines"]], ["0208", "2541"])
        self.assertTrue(station["originKo"].endswith("추가"))
        self.assertEqual(station["textVariants"], 2)
        self.assertTrue(station["hasHanja"])
        self.assertTrue(station["legendMarker"])

    def test_equal_length_variants_pick_the_same_text_every_time(self) -> None:
        rows = [row("0212", "건대입구", "02호선", "예 정자"), row("2729", "건대입구", "07호선", "옛 정자")]

        picks = {refresh.build_stations(order)[0]["originKo"] for order in (rows, rows[::-1])}

        self.assertEqual(picks, {"옛 정자"})


class DiffTest(unittest.TestCase):
    def setUp(self) -> None:
        self.old = refresh.build_stations(
            [row("1", "가", "01호선", "옛 원문"), row("2", "나", "02호선", "그대로")]
        )
        self.new = refresh.build_stations(
            [row("1", "가", "01호선", "새 원문"), row("3", "다", "03호선", "신설")]
        )

    def test_reports_added_removed_and_changed(self) -> None:
        changes = refresh.diff_stations(self.old, self.new)

        self.assertEqual(changes["added"], ["다"])
        self.assertEqual(changes["removed"], ["나"])
        self.assertEqual(changes["originChanged"], ["가"])

    def test_flags_only_cards_whose_source_changed(self) -> None:
        cards = [
            {"stationKey": "가", "officialOriginKo": "옛 원문", "review": {"facts": "official_text_only"}},
            {"stationKey": "다", "officialOriginKo": "신설", "review": {}},
        ]

        self.assertEqual(refresh.cards_needing_review(cards, self.new), ["가"])
        self.assertEqual(refresh.apply_to_cards(cards, self.new), ["가"])
        self.assertEqual(cards[0]["officialOriginKo"], "새 원문")
        self.assertEqual(cards[0]["review"]["facts"], "origin_changed")
        self.assertEqual(cards[1]["review"], {})


class KeyHandlingTest(unittest.TestCase):
    def test_reads_key_from_env_file_without_quotes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env"
            env_file.write_text("OTHER=1\nSEOUL_OPEN_API_KEY='abc123'\n", encoding="utf-8")
            with unittest.mock.patch.dict("os.environ", {}, clear=True):
                self.assertEqual(refresh.read_key(env_file), "abc123")

    def test_redacts_key_in_error_text(self) -> None:
        self.assertEqual(
            refresh.redact("failed http://host/abc123/json", "abc123"),
            "failed http://host/***/json",
        )


if __name__ == "__main__":
    unittest.main()
