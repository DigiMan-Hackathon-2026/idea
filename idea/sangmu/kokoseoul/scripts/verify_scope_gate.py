#!/usr/bin/env python3
"""Fail closed when repository files exceed the recorded pre-code permission."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RULES_PATH = ROOT / "docs" / "EVENT_RULES_CHECKLIST.md"
GATE_PATTERN = re.compile(
    r"^사전 코드 게이트: `(CLOSED|F0_ONLY|PRODUCT_ALLOWED)`$", re.MULTILINE
)
EVIDENCE_PATTERN = re.compile(r"^게이트 근거: (.+)$", re.MULTILINE)
START_PATTERN = re.compile(r"^허용 시작 시각: (.+)$", re.MULTILINE)
ISO_8601_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$"
)

CLOSED_EXACT = {
    ".env.example",
    ".node-version",
    ".npmrc",
    ".nvmrc",
    "bun.lock",
    "bun.lockb",
    "components.json",
    "compose.yaml",
    "compose.yml",
    "docker-compose.yaml",
    "docker-compose.yml",
    "next-env.d.ts",
    "package-lock.json",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "turbo.json",
    "vercel.json",
    "yarn.lock",
}
CLOSED_PREFIXES = (
    ".github/workflows/",
    "app/",
    "components/",
    "drizzle/",
    "lib/",
    "migrations/",
    "public/",
    "src/",
    "tests/",
)
CLOSED_CONFIG_PREFIXES = (
    "Dockerfile",
    "eslint.config.",
    "next.config.",
    "playwright.config.",
    "postcss.config.",
    "tailwind.config.",
    "vitest.config.",
)
CLOSED_SUFFIXES = (".sql", ".ts", ".tsx")

F0_ONLY_PREFIXES = (
    "app/api/",
    "drizzle/",
    "migrations/",
    "src/app/api/",
    "src/db/",
    "src/modules/",
    "tests/integration/",
)
F0_ONLY_SUFFIXES = (".sql",)
F0_ONLY_CONFIG_PREFIXES = ("drizzle.config.",)


def parse_gate(text: str) -> tuple[str | None, list[str]]:
    matches = GATE_PATTERN.findall(text)
    if len(matches) != 1:
        return None, [
            "docs/EVENT_RULES_CHECKLIST.md: expected exactly one pre-code gate marker"
        ]
    return matches[0], []


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
    if errors or gate == "CLOSED":
        return errors
    if evidence[0].strip() == "미기록":
        errors.append(
            "docs/EVENT_RULES_CHECKLIST.md: an open gate requires recorded evidence"
        )
    if not ISO_8601_PATTERN.fullmatch(starts[0].strip()):
        errors.append(
            "docs/EVENT_RULES_CHECKLIST.md: an open gate requires an ISO 8601 start time"
        )
    return errors


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


def is_closed_forbidden(path: str) -> bool:
    name = Path(path).name
    return (
        path in CLOSED_EXACT
        or path.startswith(CLOSED_PREFIXES)
        or name.startswith(CLOSED_CONFIG_PREFIXES)
        or path.endswith(CLOSED_SUFFIXES)
    )


def is_f0_only_forbidden(path: str) -> bool:
    name = Path(path).name
    return (
        path.startswith(F0_ONLY_PREFIXES)
        or name.startswith(F0_ONLY_CONFIG_PREFIXES)
        or path.endswith(F0_ONLY_SUFFIXES)
    )


def check_scope(gate: str, paths: list[str]) -> list[str]:
    if gate == "PRODUCT_ALLOWED":
        return []
    predicate = is_closed_forbidden if gate == "CLOSED" else is_f0_only_forbidden
    return [
        f"{path}: forbidden while pre-code gate is {gate}"
        for path in paths
        if predicate(path)
    ]


def main() -> int:
    rules_text = RULES_PATH.read_text(encoding="utf-8")
    gate, errors = parse_gate(rules_text)
    if not errors and gate is not None:
        errors.extend(check_open_gate_metadata(gate, rules_text))
    if not errors and gate is not None:
        try:
            errors.extend(check_scope(gate, candidate_files()))
        except RuntimeError as error:
            errors.append(str(error))

    if errors:
        print("Pre-code scope verification failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Pre-code scope verification passed: gate is {gate}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
