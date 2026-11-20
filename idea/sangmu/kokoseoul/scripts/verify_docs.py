#!/usr/bin/env python3
"""Validate repository documentation without third-party dependencies."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_AC = {f"AC{number:02d}" for number in range(1, 21)}
API_EXAMPLE_FILES = (
    ROOT / "docs" / "API_EXAMPLES_B2C_v0.1.md",
    ROOT / "docs" / "API_EXAMPLES_ADMIN_v0.1.md",
)
API_CONTRACT_INDEX = ROOT / "docs" / "API_CONTRACT_INDEX_v0.1.md"
HTTP_METHODS = "GET|POST|PUT|PATCH|DELETE"
UUID_PATH_SEGMENT = re.compile(
    r"/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
    r"(?=/|$)",
    re.IGNORECASE,
)
NAMED_PATH_SEGMENT = re.compile(r"/:[A-Za-z][A-Za-z0-9]*(?=/|$)")


def markdown_files() -> list[Path]:
    files = [ROOT / "README.md"]
    files.extend(sorted((ROOT / "docs").glob("*.md")))
    files.extend(sorted((ROOT / "research").rglob("*.md")))
    return files


def local_link_targets(text: str) -> list[str]:
    targets = re.findall(r"\[[^\]]+\]\(([^)]+)\)", text)
    return [
        target.split("#", 1)[0]
        for target in targets
        if target
        and not target.startswith(("http://", "https://", "mailto:", "#"))
    ]


def check_links(files: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in files:
        for target in local_link_targets(path.read_text(encoding="utf-8")):
            if not (path.parent / target).resolve().exists():
                errors.append(f"{path.relative_to(ROOT)}: missing link target {target}")
    return errors


def check_json_blocks() -> list[str]:
    errors: list[str] = []
    for path in API_EXAMPLE_FILES:
        text = path.read_text(encoding="utf-8")
        blocks = re.findall(r"```json\n(.*?)\n```", text, re.DOTALL)
        if not blocks:
            errors.append(f"{path.relative_to(ROOT)}: no JSON blocks found")
            continue
        for index, block in enumerate(blocks, start=1):
            try:
                json.loads(block)
            except json.JSONDecodeError as exc:
                errors.append(
                    f"{path.relative_to(ROOT)}: JSON block {index}: "
                    f"line {exc.lineno}, column {exc.colno}: {exc.msg}"
                )
    return errors


def ac_ids(path: Path) -> set[str]:
    return set(re.findall(r"\bAC\d{2}\b", path.read_text(encoding="utf-8")))


def check_acceptance_coverage() -> list[str]:
    errors: list[str] = []
    paths = (
        ROOT / "docs" / "B2C_SPEC_v0.1.md",
        ROOT / "docs" / "TEST_PLAN_v0.1.md",
    )
    for path in paths:
        actual = ac_ids(path)
        missing = sorted(EXPECTED_AC - actual)
        unexpected = sorted(actual - EXPECTED_AC)
        if missing:
            errors.append(f"{path.relative_to(ROOT)}: missing {', '.join(missing)}")
        if unexpected:
            errors.append(f"{path.relative_to(ROOT)}: unexpected {', '.join(unexpected)}")
    return errors


def check_readme_index() -> list[str]:
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    linked = set(local_link_targets(text))
    expected = {
        str(path.relative_to(ROOT)) for path in sorted((ROOT / "docs").glob("*.md"))
    }
    missing = sorted(expected - linked)
    return [f"README.md: missing document index link {path}" for path in missing]


def canonical_endpoint(method: str, path: str) -> str:
    path = path.split("?", 1)[0]
    if path.startswith("/api/v1"):
        path = path.removeprefix("/api/v1")
    path = UUID_PATH_SEGMENT.sub("/:param", path)
    path = NAMED_PATH_SEGMENT.sub("/:param", path)
    return f"{method} {path or '/'}"


def example_endpoints() -> set[str]:
    endpoints: set[str] = set()
    request_line = re.compile(
        rf"^({HTTP_METHODS})\s+([^\s]+)\s+HTTP/1\.1$", re.MULTILINE
    )
    for path in API_EXAMPLE_FILES:
        text = path.read_text(encoding="utf-8")
        endpoints.update(
            canonical_endpoint(method, endpoint)
            for method, endpoint in request_line.findall(text)
        )
    return endpoints


def indexed_endpoints() -> set[str]:
    text = API_CONTRACT_INDEX.read_text(encoding="utf-8")
    inline_endpoint = re.compile(rf"`({HTTP_METHODS})\s+(/[^`\s]+)`")
    return {
        canonical_endpoint(method, endpoint)
        for method, endpoint in inline_endpoint.findall(text)
    }


def check_api_contract_index() -> list[str]:
    examples = example_endpoints()
    indexed = indexed_endpoints()
    errors = [
        f"{API_CONTRACT_INDEX.relative_to(ROOT)}: missing endpoint {endpoint}"
        for endpoint in sorted(examples - indexed)
    ]
    errors.extend(
        f"{API_CONTRACT_INDEX.relative_to(ROOT)}: endpoint has no request example {endpoint}"
        for endpoint in sorted(indexed - examples)
    )
    if not examples:
        errors.append("API example documents: no HTTP request lines found")
    return errors


def main() -> int:
    files = markdown_files()
    checks = (
        check_links(files),
        check_json_blocks(),
        check_acceptance_coverage(),
        check_readme_index(),
        check_api_contract_index(),
    )
    errors = [error for group in checks for error in group]
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Documentation verification failed with {len(errors)} error(s).")
        return 1

    json_blocks = sum(
        len(re.findall(r"```json\n(.*?)\n```", path.read_text(), re.DOTALL))
        for path in API_EXAMPLE_FILES
    )
    print(
        f"Documentation verification passed: {len(files)} Markdown files, "
        f"{json_blocks} JSON blocks, {len(example_endpoints())} API endpoints, "
        "AC01-AC20 covered."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
