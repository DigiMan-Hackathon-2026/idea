#!/usr/bin/env python3
"""Regression tests for the draft to visit-guide converter."""

from __future__ import annotations

import unittest

from scripts import draft_to_visit_guide as converter

DRAFT = """# 역 이름 퀘스트

작성일: 2026-11-23 · 상태: 데스크 초안

역 이름의 주인공을 찾아간다.

## 한·일 안내 초안

### 1. 역에서 내리기 · 駅で降りる

1호선 역에서 내려요.

1号線の駅（역）で降ります。

### 2. 입구 찾기 · 入口を探す

정문으로 들어가요.

正門から入ります。

[네이버 지도에서 찾기 · NAVERマップで探す](https://map.naver.com/p/search/x)

### 3. 둘러보기 · 見て回る

천천히 봐요.

ゆっくり見ます。

## 길을 물을 때 · 道を聞くとき

> 입구가 어디예요?

日本語の意味：入口はどこですか。

## 출처

- [공식 안내](https://example.go.kr/info)
"""


class DraftToVisitGuideTest(unittest.TestCase):
    def test_copies_steps_phrase_and_source(self) -> None:
        draft = converter.parse_draft(DRAFT)
        self.assertEqual(draft["title"], "역 이름 퀘스트")
        self.assertEqual(draft["lead"], "역 이름의 주인공을 찾아간다.")
        self.assertEqual(
            [(step["titleKo"], step["titleJa"], step["bodyKo"], step["bodyJa"]) for step in draft["steps"]],
            [("역에서 내리기", "駅で降りる", "1호선 역에서 내려요.", "1号線の駅（역）で降ります。"),
             ("입구 찾기", "入口を探す", "정문으로 들어가요.", "正門から入ります。"),
             ("둘러보기", "見て回る", "천천히 봐요.", "ゆっくり見ます。")],
        )
        self.assertEqual(draft["phrase"], ("입구가 어디예요?", "入口はどこですか。"))
        self.assertEqual(draft["sources"], ["https://example.go.kr/info"])

    def test_builds_a_skeleton_with_fresh_ids_and_todos(self) -> None:
        guide = converter.build_guide("sample", converter.parse_draft(DRAFT), "culture", "jongno", 45, "2026-11-23")
        ids = [guide["id"], guide["versionId"], guide["place"]["id"], *[step["id"] for step in guide["steps"]]]
        self.assertEqual(len(set(ids)), len(ids))
        self.assertEqual(guide["titleJa"], converter.TODO)
        self.assertEqual(guide["steps"][1]["phraseKo"], "입구가 어디예요?")
        self.assertTrue(guide["steps"][0]["showsPlace"])
        self.assertEqual(guide["place"]["guideUrlKo"], "https://example.go.kr/info")
        self.assertEqual(guide["place"]["verifiedAt"], "2026-11-23T00:00:00+09:00")


if __name__ == "__main__":
    unittest.main()
