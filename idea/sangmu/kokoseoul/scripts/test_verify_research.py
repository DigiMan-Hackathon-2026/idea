#!/usr/bin/env python3
"""Regression tests for tracked user-research artifact validation."""

from __future__ import annotations

import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from subprocess import CompletedProcess
from unittest import mock

from scripts import verify_research as verifier


@contextmanager
def isolated_research_tree():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        research = root / "research"
        research.mkdir()
        with (
            mock.patch.object(verifier, "ROOT", root),
            mock.patch.object(verifier, "RESEARCH", research),
        ):
            yield root, research


class ResearchSafetyTest(unittest.TestCase):
    def test_current_tracked_research_tree_is_safe(self) -> None:
        paths, errors = verifier.tracked_research_files()

        self.assertEqual(errors, [])
        self.assertEqual(verifier.check_tracked_safety(paths), [])
        self.assertEqual(verifier.check_sensitive_text(paths), [])

    def test_nonignored_untracked_research_fails_without_printing_path(self) -> None:
        tracked = CompletedProcess(
            args=["git"], returncode=0, stdout=b"research/README.md\0", stderr=b""
        )
        untracked = CompletedProcess(
            args=["git"],
            returncode=0,
            stdout=b"research/interviews/private-person-name.md\0",
            stderr=b"",
        )
        with mock.patch.object(
            verifier.subprocess, "run", side_effect=[tracked, untracked]
        ):
            paths, errors = verifier.tracked_research_files()

        self.assertEqual(paths, [verifier.ROOT / "research/README.md"])
        self.assertEqual(len(errors), 1)
        self.assertIn("1 non-ignored untracked file", errors[0])
        self.assertNotIn("private-person-name", errors[0])

    def test_private_directory_and_media_are_rejected(self) -> None:
        with isolated_research_tree() as (_, research):
            private = research / "private" / "notes.md"
            media = research / "recordings" / "session.m4a"
            private.parent.mkdir()
            media.parent.mkdir()
            private.write_text("# Private\n", encoding="utf-8")
            media.write_bytes(b"not-real-media")

            errors = verifier.check_tracked_safety([private, media])

            self.assertTrue(any("private/raw directory" in error for error in errors))
            self.assertTrue(any("tracked media file" in error for error in errors))

    def test_email_phone_and_populated_identity_field_are_rejected(self) -> None:
        with isolated_research_tree() as (_, research):
            path = research / "notes.md"
            path.write_text(
                "# Notes\n\n"
                "- 이름: 실제이름\n"
                "- contact: person@example.com\n"
                "- call: 010-1234-5678\n",
                encoding="utf-8",
            )

            errors = verifier.check_sensitive_text([path])

            self.assertTrue(any("email address" in error for error in errors))
            self.assertTrue(any("phone number" in error for error in errors))
            self.assertTrue(any("sensitive identity field" in error for error in errors))

    def test_japanese_and_international_contact_data_are_rejected(self) -> None:
        with isolated_research_tree() as (_, research):
            path = research / "participant.md"
            path.write_text(
                "# Participant\n\n"
                "- 氏名: 実名\n"
                "- 電話番号: 090-1234-5678\n"
                "- contact: +81 80 1234 5678\n",
                encoding="utf-8",
            )

            errors = verifier.check_sensitive_text([path])

            self.assertTrue(any("phone number" in error for error in errors))
            self.assertTrue(any("sensitive identity field" in error for error in errors))

    def test_template_is_not_scanned_as_participant_data(self) -> None:
        with isolated_research_tree() as (_, research):
            path = research / "TEMPLATE.md"
            path.write_text("# Template\n\nexample@example.com\n", encoding="utf-8")

            self.assertEqual(verifier.check_sensitive_text([path]), [])


class ResearchArtifactShapeTest(unittest.TestCase):
    def test_current_research_execution_gate_matches_readiness(self) -> None:
        paths, errors = verifier.tracked_research_files()

        self.assertEqual(errors, [])
        self.assertEqual(
            verifier.check_execution_gate(
                paths, verifier.RESEARCH_README.read_text(encoding="utf-8")
            ),
            [],
        )

    def test_draft_gate_rejects_interview_and_open_gate_needs_evidence(self) -> None:
        with isolated_research_tree() as (_, research):
            interviews = research / "interviews"
            interviews.mkdir()
            interview = interviews / "P01.md"
            interview.write_text("# Interview\n", encoding="utf-8")
            draft = (
                "조사 실행 게이트: `DRAFT_ONLY`\n"
                "일본어 검수 근거: 미기록\n"
            )
            open_without_evidence = (
                "조사 실행 게이트: `INTERVIEWS_ALLOWED`\n"
                "일본어 검수 근거: 미기록\n"
            )

            draft_errors = verifier.check_execution_gate([interview], draft)
            gate, open_errors = verifier.parse_execution_gate(open_without_evidence)

            self.assertEqual(gate, "INTERVIEWS_ALLOWED")
            self.assertTrue(any("gate is DRAFT_ONLY" in error for error in draft_errors))
            self.assertTrue(any("requires Japanese review" in error for error in open_errors))

    def test_valid_interview_has_matching_code_consent_and_sections(self) -> None:
        with isolated_research_tree() as (_, research):
            interviews = research / "interviews"
            interviews.mkdir()
            path = interviews / "P01.md"
            path.write_text(
                "# Interview P01\n\n"
                "- 참여자 코드: P01\n"
                "- 메모 동의: 예\n\n"
                "## 최근 실제 사건\n- evidence ID: E-P01-01\n"
                "## 안내 예시 관찰\n- evidence ID: O-P01-01\n"
                "## 근거와 해석 분리\n"
                "### 반대 증거\n"
                "### 아직 모르는 점\n",
                encoding="utf-8",
            )

            self.assertEqual(verifier.check_interviews([path]), [])

    def test_interview_rejects_mismatched_code_and_missing_consent(self) -> None:
        with isolated_research_tree() as (_, research):
            interviews = research / "interviews"
            interviews.mkdir()
            path = interviews / "P01.md"
            path.write_text(
                "# Interview\n\n- 참여자 코드: P02\n- 메모 동의: 아니오\n",
                encoding="utf-8",
            )

            errors = verifier.check_interviews([path])

            self.assertTrue(any("does not match filename" in error for error in errors))
            self.assertTrue(any("explicit memo consent" in error for error in errors))
            self.assertTrue(any("missing required section" in error for error in errors))

    def test_interview_rejects_evidence_for_another_participant(self) -> None:
        with isolated_research_tree() as (_, research):
            interviews = research / "interviews"
            interviews.mkdir()
            path = interviews / "P01.md"
            path.write_text(
                "# Interview P01\n\n"
                "- 참여자 코드: P01\n"
                "- 메모 동의: 예\n"
                "- evidence ID: E-P02-01\n"
                "## 최근 실제 사건\n"
                "## 안내 예시 관찰\n"
                "## 근거와 해석 분리\n"
                "### 반대 증거\n"
                "### 아직 모르는 점\n",
                encoding="utf-8",
            )

            errors = verifier.check_interviews([path])

            self.assertTrue(any("evidence participant P02" in error for error in errors))

    def test_interview_rejects_duplicate_evidence_definitions(self) -> None:
        with isolated_research_tree() as (_, research):
            interviews = research / "interviews"
            interviews.mkdir()
            path = interviews / "P01.md"
            path.write_text(
                "# Interview P01\n\n"
                "- 참여자 코드: P01\n"
                "- 메모 동의: 예\n"
                "- evidence ID: E-P01-01\n"
                "- evidence ID: E-P01-01\n"
                "## 최근 실제 사건\n"
                "## 안내 예시 관찰\n"
                "## 근거와 해석 분리\n"
                "### 반대 증거\n"
                "### 아직 모르는 점\n",
                encoding="utf-8",
            )

            errors = verifier.check_interviews([path])

            self.assertTrue(any("is defined 2 times" in error for error in errors))

    def test_synthesis_reference_must_resolve_to_interview_definition(self) -> None:
        with isolated_research_tree() as (_, research):
            interviews = research / "interviews"
            synthesis = research / "synthesis"
            interviews.mkdir()
            synthesis.mkdir()
            interview = interviews / "P01.md"
            interview.write_text(
                "# Interview\n\n- evidence ID: E-P01-01\n",
                encoding="utf-8",
            )
            result = synthesis / "2026-11-round-01.md"
            result.write_text(
                "# Synthesis\n\nE-P01-01\nE-P02-01\n",
                encoding="utf-8",
            )

            errors = verifier.check_evidence_references([interview, result])

            self.assertEqual(len(errors), 1)
            self.assertIn("E-P02-01", errors[0])
            self.assertIn("not defined", errors[0])

    def test_synthesis_requires_filename_sections_and_evidence_ids(self) -> None:
        with isolated_research_tree() as (_, research):
            synthesis = research / "synthesis"
            synthesis.mkdir()
            path = synthesis / "round-one.md"
            path.write_text("# Synthesis\n\n## 사례 목록\n", encoding="utf-8")

            errors = verifier.check_syntheses([path])

            self.assertTrue(any("filename must match" in error for error in errors))
            self.assertTrue(any("missing required section" in error for error in errors))
            self.assertTrue(any("does not link evidence IDs" in error for error in errors))

    def test_candidate_requires_markdown_sections_and_evidence_ids(self) -> None:
        with isolated_research_tree() as (_, research):
            candidates = research / "region-candidates"
            candidates.mkdir()
            path = candidates / "candidate.md"
            path.write_text("# Candidate\n\n## hard gate\n", encoding="utf-8")

            errors = verifier.check_candidates([path])

            self.assertTrue(any("missing required section" in error for error in errors))
            self.assertTrue(any("does not link evidence IDs" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
