#!/usr/bin/env python3
"""Regression tests for the pre-code scope gate verifier."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts import verify_scope_gate as verifier


class ScopeGateVerifierTest(unittest.TestCase):
    def test_parse_gate_accepts_one_known_marker(self) -> None:
        gate, errors = verifier.parse_gate("사전 코드 게이트: `F0_ONLY`\n")

        self.assertEqual(gate, "F0_ONLY")
        self.assertEqual(errors, [])

    def test_parse_gate_fails_closed_for_missing_or_duplicate_marker(self) -> None:
        for text in ("# no marker\n", "사전 코드 게이트: `CLOSED`\n" * 2):
            with self.subTest(text=text):
                gate, errors = verifier.parse_gate(text)
                self.assertIsNone(gate)
                self.assertEqual(len(errors), 1)

    def test_closed_gate_rejects_scaffold_and_product_files(self) -> None:
        paths = [
            "docs/PLAN.md",
            "scripts/verify_docs.py",
            ".github/workflows/verify.yml",
            "package.json",
            "Dockerfile",
            ".node-version",
            "src/app/page.tsx",
        ]

        errors = verifier.check_scope("CLOSED", paths)

        self.assertEqual(len(errors), 5)
        self.assertTrue(all("gate is CLOSED" in error for error in errors))

    def test_f0_only_gate_allows_scaffold_but_rejects_product_layers(self) -> None:
        paths = [
            "package.json",
            "src/app/page.tsx",
            "src/modules/progress/service.ts",
            "src/db/schema.ts",
            "drizzle.config.ts",
            "migrations/0001.sql",
        ]

        errors = verifier.check_scope("F0_ONLY", paths)

        self.assertEqual(len(errors), 4)
        self.assertTrue(all("gate is F0_ONLY" in error for error in errors))

    def test_product_allowed_gate_does_not_restrict_files(self) -> None:
        self.assertEqual(
            verifier.check_scope(
                "PRODUCT_ALLOWED", ["src/modules/progress/service.ts", "migrations/1.sql"]
            ),
            [],
        )

    def test_open_gate_requires_evidence_and_iso_8601_start(self) -> None:
        missing = (
            "사전 코드 게이트: `F0_ONLY`\n"
            "게이트 근거: 미기록\n"
            "허용 시작 시각: 미기록\n"
        )
        recorded = (
            "사전 코드 게이트: `PRODUCT_ALLOWED`\n"
            "게이트 근거: 2026-11-22 주최 측 공개 답변 요약\n"
            "허용 시작 시각: 2026-11-22T09:00:00+09:00\n"
        )

        self.assertEqual(
            len(verifier.check_open_gate_metadata("F0_ONLY", missing)), 2
        )
        self.assertEqual(
            verifier.check_open_gate_metadata("PRODUCT_ALLOWED", recorded), []
        )

    def test_closed_gate_still_requires_single_metadata_fields(self) -> None:
        text = (
            "사전 코드 게이트: `CLOSED`\n"
            "게이트 근거: 미기록\n"
            "허용 시작 시각: 미기록\n"
        )

        self.assertEqual(verifier.check_open_gate_metadata("CLOSED", text), [])
        self.assertEqual(
            len(verifier.check_open_gate_metadata("CLOSED", "게이트 근거: 미기록\n")),
            1,
        )

    def test_candidate_files_includes_nonignored_untracked_file(self) -> None:
        with tempfile.TemporaryDirectory(
            dir=verifier.ROOT, prefix="scope-gate-probe-"
        ) as directory:
            probe = Path(directory) / "unexpected.ts"
            probe.write_text("export {};\n", encoding="utf-8")
            relative = probe.relative_to(verifier.ROOT).as_posix()

            self.assertIn(relative, verifier.candidate_files())
            self.assertTrue(verifier.is_closed_forbidden(relative))


if __name__ == "__main__":
    unittest.main()
