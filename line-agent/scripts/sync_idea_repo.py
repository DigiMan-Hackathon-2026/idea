#!/usr/bin/env python3
"""Copy a KokoSeoul commit into the team's public idea repository.

The team repository keeps each member's demo under `idea/<name>/`. This replaces
`idea/sangmu/kokoseoul` with the files of one commit (no git history), checks the
copy for credentials, local paths and e-mail addresses, and commits it under the
GitHub user's noreply address.

Dry run by default: it prints what would change. Pass `--push` to publish.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.verify_scope_gate import SECRET_PATTERNS  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
IDEA_REPO = "DigiMan-Hackathon-2026/idea"
IDEA_BRANCH = "main"
TARGET = "idea/sangmu/kokoseoul"

EMAIL_PATTERN = re.compile(rb"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
# Placeholder and reserved (RFC 2606/6761) domains, plus GitHub's noreply addresses.
ALLOWED_EMAIL_DOMAINS = (
    b"users.noreply.github.com", b"example.com", b"example.org", b"example.net",
    b"test", b"invalid", b"example", b"localhost",
)
ALLOWED_ENV_FILES = {".env.example"}


def run(*command: str, cwd: Path | None = None, capture: bool = True, stdin: bytes | None = None) -> str:
    result = subprocess.run(command, cwd=cwd, input=stdin, capture_output=capture, check=False)
    if result.returncode != 0:
        detail = result.stderr.decode(errors="replace").strip() if capture else ""
        raise RuntimeError(f"{' '.join(command[:3])} failed: {detail}")
    return result.stdout.decode().rstrip() if capture else ""


def is_allowed_domain(domain: bytes) -> bool:
    domain = domain.lower()
    return any(domain == allowed or domain.endswith(b"." + allowed) for allowed in ALLOWED_EMAIL_DOMAINS)


def is_text(content: bytes) -> bool:
    return b"\0" not in content[:8192]


def scan_snapshot(root: Path) -> list[str]:
    """Problems that must keep a snapshot out of a public repository."""
    errors: list[str] = []
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        relative = path.relative_to(root).as_posix()
        if path.name.startswith(".env") and path.name not in ALLOWED_ENV_FILES:
            errors.append(f"{relative}: environment file")
        content = path.read_bytes()
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(content):
                errors.append(f"{relative}: possible {label}")
        if is_text(content):
            for match in EMAIL_PATTERN.finditer(content):
                if not is_allowed_domain(match.group().rsplit(b"@", 1)[1]):
                    errors.append(f"{relative}: e-mail address")
                    break
    return errors


def unexpected_paths(status: str, prefix: str = TARGET) -> list[str]:
    """Paths in `git status --porcelain` output outside the member folder."""
    paths = [line[3:].split(" -> ")[-1].strip('"') for line in status.splitlines() if line]
    return [path for path in paths if path != prefix and not path.startswith(prefix + "/")]


def noreply_email(user_id: int, login: str) -> str:
    return f"{user_id}+{login}@users.noreply.github.com"


def commit_message(short_sha: str) -> str:
    return (
        f"Update sangmu's KokoSeoul code to {short_sha}\n\n"
        f"A snapshot of the KokoSeoul app at {short_sha}, without its git history."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--ref", default="origin/main", help="KokoSeoul commit to copy (default: origin/main)")
    parser.add_argument("--push", action="store_true", help="commit and push to the idea repository")
    args = parser.parse_args(argv)

    if args.ref.startswith("origin/"):
        run("git", "fetch", "-q", "origin", args.ref.removeprefix("origin/"), cwd=ROOT)
    sha = run("git", "rev-parse", "--verify", f"{args.ref}^{{commit}}", cwd=ROOT)
    short = sha[:7]

    workdir = Path(tempfile.mkdtemp(prefix="idea-sync-"))
    try:
        clone = workdir / "idea"
        run("gh", "repo", "clone", IDEA_REPO, str(clone), "--", "-q", "--depth", "1", "--branch", IDEA_BRANCH)
        target = clone / TARGET
        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True)
        archive = subprocess.run(("git", "archive", sha), cwd=ROOT, capture_output=True, check=True).stdout
        run("tar", "-x", "-C", str(target), stdin=archive)

        problems = scan_snapshot(target)
        if problems:
            print(f"Stopped: the snapshot of {short} is not safe to publish.", file=sys.stderr)
            for problem in problems:
                print(f"  {problem}", file=sys.stderr)
            return 1

        outside = unexpected_paths(run("git", "status", "--porcelain", cwd=clone))
        if outside:
            print(f"Stopped: changes outside {TARGET}: {', '.join(outside)}", file=sys.stderr)
            return 1

        run("git", "add", "-A", TARGET, cwd=clone)
        changes = run("git", "diff", "--cached", "--name-status", cwd=clone).splitlines()
        if not changes:
            print(f"{IDEA_REPO}/{TARGET} already matches {short}.")
            return 0
        counts = {kind: sum(1 for line in changes if line.startswith(kind)) for kind in "AMD"}
        print(f"{IDEA_REPO}/{TARGET} ← KokoSeoul {short}: "
              f"{counts['A']} added, {counts['M']} changed, {counts['D']} removed.")

        if not args.push:
            print("Dry run. Rerun with --push to commit and push.")
            return 0

        user = run("gh", "api", "user", "--jq", '"\\(.id) \\(.login)"').split()
        author = ("-c", f"user.name={user[1]}", "-c", f"user.email={noreply_email(int(user[0]), user[1])}")
        run("git", *author, "commit", "-q", "-m", commit_message(short), cwd=clone)
        run("git", "push", "-q", "origin", f"HEAD:{IDEA_BRANCH}", cwd=clone)
        pushed = run("git", "rev-parse", "HEAD", cwd=clone)
        print(f"Pushed https://github.com/{IDEA_REPO}/commit/{pushed}")
        return 0
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
