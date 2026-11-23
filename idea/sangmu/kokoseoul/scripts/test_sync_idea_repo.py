from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts import sync_idea_repo as sync


class SyncIdeaRepoTest(unittest.TestCase):
    def test_scan_flags_credentials_env_files_and_addresses(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            (root / "src" / "ok.ts").write_text(
                'const a = "react@18.3.1"; // bot@users.noreply.github.com, me@example.com\n'
                'const url = "postgres://u:p@db.example.test/app";\n',
                encoding="utf-8",
            )
            (root / ".env.example").write_text("TMAP_APP_KEY=\n", encoding="utf-8")
            (root / ".env.local").write_text("TMAP_APP_KEY=x\n", encoding="utf-8")
            (root / "notes.md").write_text("contact: someone" + "@gmail.com\n", encoding="utf-8")
            (root / "key.txt").write_text("AKIA" + "A" * 16 + "\n", encoding="utf-8")
            (root / "image.bin").write_bytes(b"\0someone" + b"@gmail.com")

            self.assertEqual(
                sync.scan_snapshot(root),
                [
                    ".env.local: environment file",
                    "key.txt: possible AWS access key",
                    "notes.md: e-mail address",
                ],
            )

    def test_lookalike_domains_are_not_placeholders(self) -> None:
        self.assertTrue(sync.is_allowed_domain(b"preview.example.invalid"))
        self.assertFalse(sync.is_allowed_domain(b"notexample.com"))
        self.assertFalse(sync.is_allowed_domain(b"gmail.com"))

    def test_only_the_member_folder_may_change(self) -> None:
        status = "\n".join(
            [
                " M idea/sangmu/kokoseoul/package.json",
                "D  idea/sangmu/kokoseoul/old.ts",
                "R  idea/sangmu/x.md -> idea/sangmu/kokoseoul/x.md",
                " M README.md",
                "?? idea/sangmu/kokoseoul-copy/a.ts",
            ]
        )
        self.assertEqual(sync.unexpected_paths(status), ["README.md", "idea/sangmu/kokoseoul-copy/a.ts"])
        # The first line keeps its leading status column.
        self.assertEqual(sync.unexpected_paths(" M idea/sangmu/kokoseoul/a.ts"), [])

    def test_commits_under_the_noreply_address(self) -> None:
        self.assertEqual(sync.noreply_email(42, "octo"), "42+octo@users.noreply.github.com")
        self.assertTrue(sync.commit_message("abc1234").startswith("Update sangmu's KokoSeoul code to abc1234\n\n"))


if __name__ == "__main__":
    unittest.main()
