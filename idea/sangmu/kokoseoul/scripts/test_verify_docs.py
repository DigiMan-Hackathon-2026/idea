#!/usr/bin/env python3
"""Regression tests for the dependency-free documentation verifier."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts import verify_docs as verifier


class DocumentationVerifierHelpersTest(unittest.TestCase):
    def test_canonical_endpoint_normalizes_api_prefix_query_and_uuid(self) -> None:
        endpoint = (
            "/api/v1/quests/11111111-1111-4111-8111-111111111111?preview=false"
        )

        self.assertEqual(
            verifier.canonical_endpoint("GET", endpoint),
            "GET /quests/:param",
        )

    def test_canonical_endpoint_normalizes_named_parameters(self) -> None:
        self.assertEqual(
            verifier.canonical_endpoint(
                "PUT", "/api/v1/runs/:runId/steps/:stepId"
            ),
            "PUT /runs/:param/steps/:param",
        )

    def test_local_links_exclude_external_mail_and_fragments(self) -> None:
        text = (
            "[local](docs/ONE.md) [section](#part) "
            "[web](https://example.test) [mail](mailto:test@example.test)"
        )

        self.assertEqual(verifier.local_link_targets(text), ["docs/ONE.md"])

    def test_json_blocks_extract_and_validate_all_markdown_json(self) -> None:
        with tempfile.TemporaryDirectory(dir=verifier.ROOT) as directory:
            path = Path(directory) / "sample.md"
            path.write_text(
                '# Sample\n\n```json\n{"ok": true}\n```\n',
                encoding="utf-8",
            )

            self.assertEqual(verifier.json_blocks(path), ['{"ok": true}\n'])
            self.assertEqual(verifier.check_json_blocks([path]), [])

    def test_invalid_json_reports_file_and_block(self) -> None:
        with tempfile.TemporaryDirectory(dir=verifier.ROOT) as directory:
            path = Path(directory) / "invalid.md"
            path.write_text(
                "# Invalid\n\n```json\n{not-json}\n```\n",
                encoding="utf-8",
            )

            errors = verifier.check_json_blocks([path])

            self.assertEqual(len(errors), 1)
            self.assertIn("JSON block 1", errors[0])

    def test_unbalanced_fence_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(dir=verifier.ROOT) as directory:
            path = Path(directory) / "unbalanced.md"
            path.write_text("# Unbalanced\n\n```text\nopen\n", encoding="utf-8")

            errors = verifier.check_fenced_blocks([path])

            self.assertEqual(len(errors), 1)
            self.assertIn("unbalanced fenced code blocks", errors[0])


class DocumentationContractsTest(unittest.TestCase):
    def test_reported_verification_counts_match_repository(self) -> None:
        self.assertEqual(
            verifier.check_reported_verification_counts(verifier.markdown_files()), []
        )

    def test_api_examples_and_index_have_the_same_endpoints(self) -> None:
        self.assertEqual(verifier.example_endpoints(), verifier.indexed_endpoints())
        self.assertEqual(len(verifier.example_endpoints()), 22)

    def test_error_catalog_matches_expected_contract(self) -> None:
        self.assertEqual(verifier.check_error_code_coverage(), [])
        self.assertEqual(verifier.check_error_catalog(), [])
        self.assertEqual(len(verifier.EXPECTED_ERROR_CONTRACT), 14)

    def test_cross_document_invariants_are_current(self) -> None:
        checks = (
            verifier.check_pagination_contract,
            verifier.check_visitor_session_contract,
            verifier.check_background_jobs_contract,
            verifier.check_module_boundaries_contract,
        )

        for check in checks:
            with self.subTest(check=check.__name__):
                self.assertEqual(check(), [])


if __name__ == "__main__":
    unittest.main()
