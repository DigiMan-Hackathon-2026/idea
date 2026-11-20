#!/usr/bin/env python3
"""Regression tests for the pre-code scope gate verifier."""

from __future__ import annotations

import unittest

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
            "src/app/page.tsx",
        ]

        errors = verifier.check_scope("CLOSED", paths)

        self.assertEqual(len(errors), 3)
        self.assertTrue(all("gate is CLOSED" in error for error in errors))

    def test_f0_only_gate_allows_scaffold_but_rejects_product_layers(self) -> None:
        paths = [
            "package.json",
            "src/app/page.tsx",
            "src/modules/progress/service.ts",
            "src/db/schema.ts",
            "migrations/0001.sql",
        ]

        errors = verifier.check_scope("F0_ONLY", paths)

        self.assertEqual(len(errors), 3)
        self.assertTrue(all("gate is F0_ONLY" in error for error in errors))

    def test_product_allowed_gate_does_not_restrict_files(self) -> None:
        self.assertEqual(
            verifier.check_scope(
                "PRODUCT_ALLOWED", ["src/modules/progress/service.ts", "migrations/1.sql"]
            ),
            [],
        )


if __name__ == "__main__":
    unittest.main()
