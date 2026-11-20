#!/usr/bin/env python3
"""Regression tests for the pre-code scope gate verifier."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts import verify_scope_gate as verifier
from scripts import verify_all


class ScopeGateVerifierTest(unittest.TestCase):
    def test_parse_gate_accepts_one_known_marker(self) -> None:
        gate, errors = verifier.parse_gate("사전 코드 게이트: `F0_ONLY`\n")

        self.assertEqual(gate, "F0_ONLY")
        self.assertEqual(errors, [])

    def test_parse_gate_fails_closed_for_missing_or_duplicate_marker(self) -> None:
        for text in ("# no marker\n", "사전 코드 게이트: `UNRESTRICTED`\n" * 2):
            with self.subTest(text=text):
                gate, errors = verifier.parse_gate(text)
                self.assertIsNone(gate)
                self.assertEqual(len(errors), 1)

    def test_unrestricted_gate_allows_code_files_without_warning(self) -> None:
        paths = [
            "docs/PLAN.md",
            "scripts/verify_docs.py",
            ".github/workflows/verify.yml",
            "package.json",
            "Dockerfile",
            ".node-version",
            "index.js",
            "styles.css",
            "src/app/page.tsx",
        ]

        errors = verifier.check_scope("UNRESTRICTED", paths)

        self.assertEqual(errors, [])

    def test_f0_only_label_does_not_restrict_product_layers(self) -> None:
        paths = [
            "package.json",
            "src/app/page.tsx",
            "src/modules/progress/service.ts",
            "src/db/schema.ts",
            "drizzle.config.ts",
            "migrations/0001.sql",
        ]

        errors = verifier.check_scope("F0_ONLY", paths)

        self.assertEqual(errors, [])

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
            "게이트 근거: D01 @ abc1234\n"
            "허용 시작 시각: 2026-11-22T09:00:00+09:00\n"
        )
        impossible = (
            "사전 코드 게이트: `PRODUCT_ALLOWED`\n"
            "게이트 근거: D01 @ abc1234\n"
            "허용 시작 시각: 2026-02-30T25:00:00+09:00\n"
        )

        self.assertEqual(
            len(verifier.check_open_gate_metadata("F0_ONLY", missing)), 2
        )
        self.assertEqual(
            verifier.check_open_gate_metadata("PRODUCT_ALLOWED", recorded), []
        )
        self.assertEqual(
            len(verifier.check_open_gate_metadata("PRODUCT_ALLOWED", impossible)), 1
        )
        with mock.patch.object(verifier.subprocess, "run") as git_run:
            git_run.return_value.returncode = 1
            commit_errors = verifier.check_open_gate_commit(
                "PRODUCT_ALLOWED", recorded
            )
        self.assertEqual(len(commit_errors), 1)
        self.assertIn("must exist", commit_errors[0])

    def test_unrestricted_gate_still_requires_single_metadata_fields(self) -> None:
        text = (
            "사전 코드 게이트: `UNRESTRICTED`\n"
            "게이트 근거: 미기록\n"
            "허용 시작 시각: 미기록\n"
        )

        self.assertEqual(verifier.check_open_gate_metadata("UNRESTRICTED", text), [])
        self.assertEqual(
            len(
                verifier.check_open_gate_metadata(
                    "UNRESTRICTED", "게이트 근거: 미기록\n"
                )
            ),
            1,
        )

    def test_candidate_files_includes_nonignored_untracked_file(self) -> None:
        with tempfile.TemporaryDirectory(
            dir=verifier.ROOT, prefix="scope-gate-probe-"
        ) as directory:
            probe = Path(directory) / "unexpected.ts"
            probe.write_text("export {};\n", encoding="utf-8")
            relative = probe.relative_to(verifier.ROOT).as_posix()
            secret_probe = Path(directory) / "notes.txt"
            secret_probe.write_text(
                "AKIA"
                + "A" * 16
                + "\n"
                + "AIza"
                + "A" * 35
                + "\n/Users/"
                + "private-name"
                + "/project\n",
                encoding="utf-8",
            )
            secret_relative = secret_probe.relative_to(verifier.ROOT).as_posix()

            candidates = verifier.candidate_files()
            self.assertIn(relative, candidates)
            self.assertIn(secret_relative, candidates)
            secret_errors = verifier.check_secret_patterns(candidates)
            self.assertEqual(len(secret_errors), 3)
            self.assertTrue(any("possible AWS access key" in error for error in secret_errors))
            self.assertTrue(any("possible Google API key" in error for error in secret_errors))
            self.assertTrue(
                any("possible local macOS user path" in error for error in secret_errors)
            )

    def test_contribution_templates_keep_scope_gate_contract(self) -> None:
        self.assertEqual(verifier.check_contribution_templates(), [])

    def test_readiness_reports_the_same_scope_gate(self) -> None:
        text = verifier.RULES_PATH.read_text(encoding="utf-8")
        gate, errors = verifier.parse_gate(text)

        self.assertEqual(errors, [])
        self.assertIsNotNone(gate)
        self.assertEqual(verifier.check_readiness_alignment(gate), [])

    def test_handoff_and_readiness_report_current_test_count(self) -> None:
        count = verifier.test_method_count()

        self.assertGreater(count, 0)
        self.assertEqual(verifier.check_reported_test_count(count), [])

    def test_unified_verifier_discovers_every_test_module(self) -> None:
        self.assertEqual(
            verify_all.COMMANDS[0][1:],
            ("-m", "unittest", "discover", "-s", "scripts", "-p", "test_*.py"),
        )


if __name__ == "__main__":
    unittest.main()
