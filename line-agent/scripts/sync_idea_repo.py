#!/usr/bin/env python3
"""Publish this repository's git history into the team's public idea repository.

The team repository keeps each member's demo under `idea/<name>/`. This rewrites
a copy of this repository's history so that every file sits in the member folder
and the member's own e-mail becomes their GitHub noreply address. It checks every
file version and commit message for credentials, local paths, e-mail addresses
and phone numbers, then merges the result into the idea repository. Commits keep
their original dates. The rewrite is deterministic, so a later run adds only the
commits made since the last one.

Dry run by default: it prints what would change. Pass `--push` to publish.
Needs git-filter-repo (`pip install git-filter-repo`).
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
DEFAULT_TARGET = "idea/sangmu/line-agent"

EMAIL_PATTERN = re.compile(rb"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
# Placeholder and reserved (RFC 2606/6761) domains, plus GitHub's noreply addresses.
ALLOWED_EMAIL_DOMAINS = (
    b"users.noreply.github.com", b"example.com", b"example.org", b"example.net",
    b"test", b"invalid", b"example", b"localhost",
)
# A made-up address that an early version of this script's own test used as a fixture.
ALLOWED_EMAILS = {b"someone@gmail.com", b"0someone@gmail.com"}
ALLOWED_ENV_FILES = {".env.example"}
# Korean mobile numbers written as numbers (+82 10…, 010-…); bare digit runs are IDs elsewhere.
PHONE_PATTERN = re.compile(rb"(?:\+82[- ]?|\b0)1[016789][- ]\d{3,4}[- ]\d{4}\b|\+82[- ]?1[016789]\d{7,8}\b")


def run(*command: str, cwd: Path | None = None, capture: bool = True, stdin: bytes | None = None) -> str:
    result = subprocess.run(command, cwd=cwd, input=stdin, capture_output=capture, check=False)
    if result.returncode != 0:
        detail = result.stderr.decode(errors="replace").strip() if capture else ""
        raise RuntimeError(f"{' '.join(command[:3])} failed: {detail}")
    return result.stdout.decode().rstrip() if capture else ""


def succeeds(*command: str, cwd: Path | None = None) -> bool:
    return subprocess.run(command, cwd=cwd, capture_output=True, check=False).returncode == 0


def is_allowed_domain(domain: bytes) -> bool:
    domain = domain.lower()
    return any(domain == allowed or domain.endswith(b"." + allowed) for allowed in ALLOWED_EMAIL_DOMAINS)


def is_text(content: bytes) -> bool:
    return b"\0" not in content[:8192]


def is_placeholder_phone(number: bytes) -> bool:
    """010-1234-5678, 010-0000-0000 and +82 10 0000 0001 style test numbers."""
    subscriber = re.sub(rb"\D", b"", number)[-8:]
    return subscriber == b"12345678" or subscriber[:7] == b"0000000"


def problems_in(path: str, content: bytes) -> list[str]:
    """Reasons one file version must stay out of a public repository."""
    found: list[str] = []
    name = path.rsplit("/", 1)[-1]
    if name.startswith(".env") and name not in ALLOWED_ENV_FILES:
        found.append(f"{path}: environment file")
    for label, pattern in SECRET_PATTERNS:
        if pattern.search(content):
            found.append(f"{path}: possible {label}")
    if is_text(content):
        if any(match.group() not in ALLOWED_EMAILS and not is_allowed_domain(match.group().rsplit(b"@", 1)[1]) for match in EMAIL_PATTERN.finditer(content)):
            found.append(f"{path}: e-mail address")
        if any(not is_placeholder_phone(match.group()) for match in PHONE_PATTERN.finditer(content)):
            found.append(f"{path}: phone number")
    return found


def scan_history(repo: Path, ref: str) -> list[str]:
    """Every file version and commit message reachable from `ref`."""
    listing = run("git", "rev-list", "--objects", ref, cwd=repo).splitlines()
    paths: dict[str, str] = {}
    for line in listing:
        sha, _, path = line.partition(" ")
        if path:
            paths.setdefault(sha, path)
    batch = subprocess.run(
        ("git", "cat-file", "--batch"), cwd=repo, input="\n".join(paths).encode() + b"\n", capture_output=True, check=True
    ).stdout
    found: set[str] = set()
    offset = 0
    while offset < len(batch):
        header_end = batch.index(b"\n", offset)
        sha, kind, size = batch[offset:header_end].split(b" ")
        content = batch[header_end + 1 : header_end + 1 + int(size)]
        offset = header_end + 2 + int(size)
        if kind == b"blob":
            found.update(problems_in(paths[sha.decode()], content))
    messages = subprocess.run(("git", "log", "--format=%h%x00%B%x01", ref), cwd=repo, capture_output=True, check=True).stdout
    for entry in messages.split(b"\x01"):
        short, _, body = entry.strip().partition(b"\x00")
        if body:
            found.update(f"commit {short.decode()} message: {problem.split(': ', 1)[1]}" for problem in problems_in("message", body))
    return sorted(found)


def noreply_email(user_id: int, login: str) -> str:
    return f"{user_id}+{login}@users.noreply.github.com"


def mailmap(login: str, noreply: str, own_emails: list[str]) -> str:
    """Maps the member's own addresses (any name) to their GitHub login and noreply address."""
    return "".join(f"{login} <{noreply}> <{email}>\n" for email in sorted(set(own_emails)))


def outside_paths(changed: list[str], prefix: str) -> list[str]:
    return [path for path in changed if path != prefix and not path.startswith(prefix + "/")]


def merge_message(folder: str, short: str, new_commits: int, first_time: bool) -> str:
    if first_time:
        return (
            f"Bring in sangmu's {folder} with its full history\n\n"
            f"All {new_commits} commits of the original repository up to {short}, with their original dates,\n"
            f"moved under idea/sangmu/{folder}. Authors use the GitHub noreply address."
        )
    return f"Update sangmu's {folder} to {short}\n\n{new_commits} new commits from the original repository, with their original dates."


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--ref", default="origin/main", help="commit to publish (default: origin/main)")
    parser.add_argument("--target", default=DEFAULT_TARGET, help=f"folder in the idea repository (default: {DEFAULT_TARGET})")
    parser.add_argument("--push", action="store_true", help="merge and push to the idea repository")
    args = parser.parse_args(argv)
    target = args.target.strip("/")
    folder = target.rsplit("/", 1)[-1]

    if not succeeds("git", "filter-repo", "--version"):
        print("Stopped: git-filter-repo is missing. Install it with `pip install git-filter-repo`.", file=sys.stderr)
        return 1
    if args.ref.startswith("origin/"):
        run("git", "fetch", "-q", "origin", args.ref.removeprefix("origin/"), cwd=ROOT)
    sha = run("git", "rev-parse", "--verify", f"{args.ref}^{{commit}}", cwd=ROOT)
    short = sha[:7]
    login_id, login = run("gh", "api", "user", "--jq", '"\\(.id) \\(.login)"').split()
    noreply = noreply_email(int(login_id), login)
    own_emails = [run("git", "config", "user.email", cwd=ROOT)]

    workdir = Path(tempfile.mkdtemp(prefix="idea-sync-"))
    try:
        source = workdir / "source"
        run("git", "clone", "-q", "--no-local", "--no-checkout", str(ROOT), str(source))
        run("git", "update-ref", "refs/heads/publish", sha, cwd=source)
        (workdir / "mailmap").write_text(mailmap(login, noreply, own_emails), encoding="utf-8")
        run("git", "filter-repo", "--force", "--quiet", "--mailmap", str(workdir / "mailmap"), "--to-subdirectory-filter", target, cwd=source)

        others = {email for email in run("git", "log", "--format=%ae%n%ce", "publish", cwd=source).splitlines() if not email.endswith("@users.noreply.github.com")}
        if others:
            print(f"Stopped: {len(others)} author address(es) other than yours would be published. Ask those authors first.", file=sys.stderr)
            return 1
        problems = scan_history(source, "publish")
        if problems:
            print(f"Stopped: the history up to {short} is not safe to publish.", file=sys.stderr)
            for problem in problems:
                print(f"  {problem}", file=sys.stderr)
            return 1

        clone = workdir / "idea"
        run("gh", "repo", "clone", IDEA_REPO, str(clone), "--", "-q", "--branch", IDEA_BRANCH)
        run("git", "fetch", "-q", str(source), "publish:refs/heads/member-history", cwd=clone)
        if succeeds("git", "merge-base", "--is-ancestor", "member-history", "HEAD", cwd=clone):
            print(f"{IDEA_REPO}/{target} already has {short}.")
            return 0
        first_time = not succeeds("git", "merge-base", "HEAD", "member-history", cwd=clone)
        new_commits = int(run("git", "rev-list", "--count", "HEAD..member-history", cwd=clone))
        snapshot = first_time and succeeds("git", "cat-file", "-e", f"HEAD:{target}", cwd=clone)
        print(
            f"{IDEA_REPO}/{target} ← {short}: {new_commits} commits with their original dates"
            + (" (replacing the copy without history)" if snapshot else "")
            + "."
        )
        if not args.push:
            print("Dry run. Rerun with --push to merge and push.")
            return 0

        before = run("git", "rev-parse", "HEAD", cwd=clone)
        author = ("-c", f"user.name={login}", "-c", f"user.email={noreply}")
        if snapshot:
            run("git", "rm", "-rq", target, cwd=clone)
            run("git", *author, "commit", "-q", "-m", f"Remove the {folder} copy before bringing in its full history", cwd=clone)
        merge = ("git", *author, "merge", "-q", "--no-ff", "-m", merge_message(folder, short, new_commits, first_time))
        run(*merge, *(("--allow-unrelated-histories",) if first_time else ()), "member-history", cwd=clone)

        changed = run("git", "diff", "--name-only", before, "HEAD", cwd=clone).splitlines()
        outside = outside_paths(changed, target)
        if outside or not succeeds("git", "diff", "--quiet", "HEAD", "member-history", "--", target, cwd=clone):
            print(f"Stopped: the merge would change files outside {target} or differ from {short}: {', '.join(outside[:5])}", file=sys.stderr)
            return 1
        run("git", "push", "-q", "origin", f"HEAD:{IDEA_BRANCH}", cwd=clone)
        pushed = run("git", "rev-parse", "HEAD", cwd=clone)
        print(f"Pushed https://github.com/{IDEA_REPO}/commit/{pushed}")
        return 0
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
