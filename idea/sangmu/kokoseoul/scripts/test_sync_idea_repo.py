from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts import sync_idea_repo as sync


def git(repo: Path, *args: str) -> str:
    return subprocess.run(("git", *args), cwd=repo, capture_output=True, check=True, text=True).stdout.strip()


class SyncIdeaRepoTest(unittest.TestCase):
    def test_flags_credentials_env_files_addresses_paths_and_phones(self) -> None:
        self.assertEqual(sync.problems_in("src/ok.ts", b'"react@18.3.1" bot@users.noreply.github.com me@example.com postgres://u:p@db.example.test/app'), [])
        self.assertEqual(sync.problems_in(".env.example", b"TMAP_APP_KEY=\n"), [])
        self.assertEqual(sync.problems_in(".env.local", b"TMAP_APP_KEY=x\n"), [".env.local: environment file"])
        self.assertEqual(sync.problems_in("key.txt", b"AKIA" + b"A" * 16), ["key.txt: possible AWS access key"])
        self.assertEqual(sync.problems_in("notes.md", b"contact: alice" + b"@gmail.com"), ["notes.md: e-mail address"])
        self.assertEqual(sync.problems_in("image.bin", b"\0someone" + b"@gmail.com"), [])
        self.assertEqual(sync.problems_in("a.md", b"open /Users/" + b"alice/dev/app"), ["a.md: possible local macOS user path"])
        self.assertEqual(sync.problems_in("a.md", b"open /home/" + b"alice/dev/app"), ["a.md: possible local Linux user path"])
        self.assertEqual(sync.problems_in("a.json", b'"https://www.nfm.go.kr/home/1428/page.do"'), [])
        # Built from parts so this file itself holds no phone-shaped number.
        self.assertEqual(sync.problems_in("a.ts", b'"+82 10 2468 ' + b'1357"'), ["a.ts: phone number"])
        self.assertEqual(sync.problems_in("a.ts", b"010-2468-" + b"1357"), ["a.ts: phone number"])
        # Test numbers and digit runs that are IDs elsewhere pass.
        self.assertEqual(sync.problems_in("a.ts", b"+821012345678 010-9876-5432 010-0000-0000 +821000000002 id 01160010005"), [])

    def test_lookalike_domains_are_not_placeholders(self) -> None:
        self.assertTrue(sync.is_allowed_domain(b"preview.example.invalid"))
        self.assertFalse(sync.is_allowed_domain(b"notexample.com"))
        self.assertFalse(sync.is_allowed_domain(b"gmail.com"))

    def test_only_the_member_folder_may_change(self) -> None:
        changed = ["idea/sangmu/kokoseoul/package.json", "README.md", "idea/sangmu/kokoseoul-copy/a.ts"]
        self.assertEqual(sync.outside_paths(changed, "idea/sangmu/kokoseoul"), ["README.md", "idea/sangmu/kokoseoul-copy/a.ts"])

    def test_publishes_only_the_members_own_commits(self) -> None:
        self.assertEqual(sync.other_authors(["me@mail.test", "noreply@github.com", ""], "me@mail.test"), set())
        self.assertEqual(sync.other_authors(["me@mail.test", "friend@mail.test"], "me@mail.test"), {"friend@mail.test"})
        self.assertTrue(sync.merge_message("kokoseoul", "abc1234", 3, False).startswith("Update sangmu's kokoseoul to abc1234\n\n3 new commits"))

    def test_scans_every_version_and_message_in_history(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            git(repo, "init", "-q")
            git(repo, "config", "user.email", "me@example.com")
            git(repo, "config", "user.name", "me")
            (repo / "notes.md").write_text("call 010-2468-" + "1357\n", encoding="utf-8")
            git(repo, "add", ".")
            git(repo, "commit", "-qm", "first")
            # Removing the number later does not hide it from the history.
            (repo / "notes.md").write_text("no number\n", encoding="utf-8")
            git(repo, "commit", "-qam", "see /Users/" + "alice/dev")
            problems = sync.scan_history(repo, "HEAD")
            self.assertIn("notes.md: phone number", problems)
            self.assertTrue(any(problem.endswith("message: possible local macOS user path") for problem in problems))


if __name__ == "__main__":
    unittest.main()
