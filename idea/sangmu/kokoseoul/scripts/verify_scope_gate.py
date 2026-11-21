#!/usr/bin/env python3
"""Validate repository safety metadata without restricting product code."""

from __future__ import annotations

import ast
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RULES_PATH = ROOT / "docs" / "EVENT_RULES_CHECKLIST.md"
PR_TEMPLATE_PATH = ROOT / ".github" / "PULL_REQUEST_TEMPLATE.md"
FEATURE_TEMPLATE_PATH = ROOT / ".github" / "ISSUE_TEMPLATE" / "feature.yml"
READINESS_PATH = ROOT / "docs" / "READINESS_STATUS.md"
GATE_PATTERN = re.compile(
    r"^사전 코드 게이트: `(UNRESTRICTED|F0_ONLY|PRODUCT_ALLOWED)`$", re.MULTILINE
)
EVIDENCE_PATTERN = re.compile(r"^게이트 근거: (.+)$", re.MULTILINE)
OPEN_GATE_EVIDENCE = re.compile(r"^D01 @ [0-9a-f]{7,40}$")
START_PATTERN = re.compile(r"^허용 시작 시각: (.+)$", re.MULTILINE)
ISO_8601_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$"
)

SECRET_PATTERNS = (
    ("AWS access key", re.compile(rb"\bAKIA[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(rb"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("Google API key", re.compile(rb"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("OpenAI API key", re.compile(rb"\bsk-[0-9A-Za-z_-]{20,}\b")),
    (
        "PEM private key",
        re.compile(rb"-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----"),
    ),
    ("local macOS user path", re.compile(rb"/" + rb"Users/[^/\s]+/")),
    (
        "local Linux user path",
        # An absolute local path starts at a boundary, unlike /home inside a URL.
        re.compile(rb"(?<![A-Za-z0-9./_%\]-])/" + rb"home/[^/\s]+/"),
    ),
    (
        "local Windows user path",
        re.compile(rb"\b[A-Za-z]:\\Users\\[^\\\s]+\\"),
    ),
)

REQUIRED_PR_TEMPLATE_TOKENS = (
    "python3 scripts/verify_all.py",
    "코드 범위 상태",
    "docs/EVENT_RULES_CHECKLIST.md",
    "제품 AC·build·E2E",
    "조사 실행 게이트 전/후",
    "INTERVIEWS_ALLOWED",
)
REQUIRED_FEATURE_TEMPLATE_TOKENS = (
    "Code scope는 UNRESTRICTED",
    "제출 전 위험",
)


def parse_gate(text: str) -> tuple[str | None, list[str]]:
    matches = GATE_PATTERN.findall(text)
    if len(matches) != 1:
        return None, [
            "docs/EVENT_RULES_CHECKLIST.md: expected exactly one pre-code gate marker"
        ]
    return matches[0], []


def valid_iso_8601_start(value: str) -> bool:
    if not ISO_8601_PATTERN.fullmatch(value):
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None and parsed.utcoffset() is not None


def check_open_gate_metadata(gate: str, text: str) -> list[str]:
    evidence = EVIDENCE_PATTERN.findall(text)
    starts = START_PATTERN.findall(text)
    errors: list[str] = []
    if len(evidence) != 1:
        errors.append(
            "docs/EVENT_RULES_CHECKLIST.md: expected exactly one gate evidence field"
        )
    if len(starts) != 1:
        errors.append(
            "docs/EVENT_RULES_CHECKLIST.md: expected exactly one allowed start field"
        )
    if errors or gate == "UNRESTRICTED":
        return errors
    if not OPEN_GATE_EVIDENCE.fullmatch(evidence[0].strip()):
        errors.append(
            "docs/EVENT_RULES_CHECKLIST.md: an open gate requires evidence like "
            "'D01 @ abc1234'"
        )
    if not valid_iso_8601_start(starts[0].strip()):
        errors.append(
            "docs/EVENT_RULES_CHECKLIST.md: an open gate requires an ISO 8601 start time"
        )
    return errors


def check_open_gate_commit(gate: str, text: str) -> list[str]:
    if gate == "UNRESTRICTED":
        return []
    evidence = EVIDENCE_PATTERN.findall(text)
    if len(evidence) != 1 or not OPEN_GATE_EVIDENCE.fullmatch(evidence[0].strip()):
        return []
    commit = evidence[0].strip().rsplit(" ", 1)[1]
    result = subprocess.run(
        ("git", "merge-base", "--is-ancestor", commit, "HEAD"),
        cwd=ROOT,
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        return [
            "docs/EVENT_RULES_CHECKLIST.md: D01 evidence commit must exist "
            "and precede the gate commit"
        ]
    return []


def candidate_files() -> list[str]:
    result = subprocess.run(
        ("git", "ls-files", "--cached", "--others", "--exclude-standard"),
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError("git ls-files failed while checking the pre-code gate")
    return sorted(path for path in result.stdout.splitlines() if path)


def check_scope(gate: str, paths: list[str]) -> list[str]:
    """Code scope is informational and never rejects repository files."""
    return []


def check_secret_patterns(paths: list[str]) -> list[str]:
    errors: list[str] = []
    for relative_path in paths:
        path = ROOT / relative_path
        if not path.is_file():
            continue
        try:
            content = path.read_bytes()
        except OSError:
            errors.append(f"{relative_path}: could not read file for secret scan")
            continue
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(content):
                errors.append(f"{relative_path}: possible {label}")
    return errors


def check_contribution_templates() -> list[str]:
    errors: list[str] = []
    for path, tokens in (
        (PR_TEMPLATE_PATH, REQUIRED_PR_TEMPLATE_TOKENS),
        (FEATURE_TEMPLATE_PATH, REQUIRED_FEATURE_TEMPLATE_TOKENS),
    ):
        text = path.read_text(encoding="utf-8")
        for token in tokens:
            if token not in text:
                errors.append(
                    f"{path.relative_to(ROOT)}: missing scope gate token {token!r}"
                )
    return errors


def check_readiness_alignment(gate: str) -> list[str]:
    text = READINESS_PATH.read_text(encoding="utf-8")
    marker = f"현재 사전 코드 게이트는 `{gate}`다."
    if marker not in text:
        return [
            f"{READINESS_PATH.relative_to(ROOT)}: missing current gate marker {gate}"
        ]
    return []


def test_method_count() -> int:
    count = 0
    for path in sorted((ROOT / "scripts").glob("test_*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        count += sum(
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and node.name.startswith("test_")
            for node in ast.walk(tree)
        )
    return count


def check_reported_test_count(count: int) -> list[str]:
    expected = (
        (ROOT / "docs" / "HANDOFF.md", f"{count}개 tooling 회귀 테스트"),
        (READINESS_PATH, f"{count}개 회귀 테스트"),
    )
    errors: list[str] = []
    for path, marker in expected:
        if marker not in path.read_text(encoding="utf-8"):
            errors.append(
                f"{path.relative_to(ROOT)}: expected current test count marker {marker!r}"
            )
    return errors


def main() -> int:
    rules_text = RULES_PATH.read_text(encoding="utf-8")
    gate, errors = parse_gate(rules_text)
    if not errors and gate is not None:
        errors.extend(check_open_gate_metadata(gate, rules_text))
        errors.extend(check_open_gate_commit(gate, rules_text))
    if not errors and gate is not None:
        try:
            paths = candidate_files()
            errors.extend(check_secret_patterns(paths))
        except RuntimeError as error:
            errors.append(str(error))
    if gate is not None:
        errors.extend(check_readiness_alignment(gate))
    errors.extend(check_reported_test_count(test_method_count()))
    errors.extend(check_contribution_templates())

    if errors:
        print("Pre-code scope verification failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Pre-code scope verification passed: gate is {gate}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
