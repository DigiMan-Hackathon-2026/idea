#!/usr/bin/env python3
"""Validate repository documentation without third-party dependencies."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_AC = {f"AC{number:02d}" for number in range(1, 21)}
EXPECTED_DECISIONS = {f"D{number:02d}" for number in range(1, 14)}
EXPECTED_ERROR_CODES = {
    "VALIDATION_ERROR",
    "SESSION_REQUIRED",
    "ORIGIN_FORBIDDEN",
    "ADMIN_FORBIDDEN",
    "QUEST_UNAVAILABLE",
    "STEP_ORDER_CONFLICT",
    "VERSION_CONFLICT",
    "REQUEST_CONFLICT",
    "RUN_NOT_COMPLETED",
    "NOT_FOUND",
    "RATE_LIMITED",
    "SERVICE_UNAVAILABLE",
}
API_EXAMPLE_FILES = (
    ROOT / "docs" / "API_EXAMPLES_B2C_v0.1.md",
    ROOT / "docs" / "API_EXAMPLES_ADMIN_v0.1.md",
)
API_CONTRACT_INDEX = ROOT / "docs" / "API_CONTRACT_INDEX_v0.1.md"
PAGINATION_CONTRACT = ROOT / "docs" / "PAGINATION_CURSOR_v0.1.md"
PAGINATED_ENDPOINTS = {
    "GET /quests",
    "GET /me/runs",
    "GET /admin/quests",
    "GET /admin/reports",
}
PAGINATION_SORT_TUPLES = {
    "firstPublishedAt DESC, questId ASC",
    "startedAt DESC, runId ASC",
    "createdAt DESC, questId ASC",
    "createdAt DESC, reportId ASC",
}
PAGINATION_REFERENCE_FILES = (
    ROOT / "docs" / "API_CONTRACT_INDEX_v0.1.md",
    ROOT / "docs" / "B2C_SPEC_v0.1.md",
    ROOT / "docs" / "INPUT_VALIDATION_v0.1.md",
    ROOT / "docs" / "TEST_PLAN_v0.1.md",
)
HTTP_METHODS = "GET|POST|PUT|PATCH|DELETE"
UUID_PATH_SEGMENT = re.compile(
    r"/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
    r"(?=/|$)",
    re.IGNORECASE,
)
NAMED_PATH_SEGMENT = re.compile(r"/:[A-Za-z][A-Za-z0-9]*(?=/|$)")
ISO_DATE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
H1 = re.compile(r"^#\s+\S.+$", re.MULTILINE)
FENCED_BLOCK = re.compile(r"^```[^\n]*\n.*?^```[ \t]*$", re.MULTILINE | re.DOTALL)


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
            resolved = (path.parent / target).resolve()
            if not resolved.is_relative_to(ROOT):
                errors.append(
                    f"{path.relative_to(ROOT)}: local link leaves repository {target}"
                )
            elif not resolved.exists():
                errors.append(f"{path.relative_to(ROOT)}: missing link target {target}")
    return errors


def check_markdown_structure(files: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        headings = H1.findall(FENCED_BLOCK.sub("", text))
        if not headings or not text.startswith("# "):
            errors.append(
                f"{path.relative_to(ROOT)}: expected an H1 on the first line"
            )
        if len(headings) != len(set(headings)):
            errors.append(f"{path.relative_to(ROOT)}: duplicate H1 heading")
        if not text.endswith("\n"):
            errors.append(f"{path.relative_to(ROOT)}: missing final newline")

        if path.parent == ROOT / "docs":
            preamble = "\n".join(text.splitlines()[:5])
            if not ISO_DATE.search(preamble):
                errors.append(
                    f"{path.relative_to(ROOT)}: no ISO date in first five lines"
                )
    return errors


def check_markdown_reachability(files: list[Path]) -> list[str]:
    known = {path.resolve(): path for path in files}
    graph: dict[Path, set[Path]] = {path: set() for path in known}
    for resolved, path in known.items():
        text = path.read_text(encoding="utf-8")
        for target in local_link_targets(text):
            linked = (path.parent / target).resolve()
            if linked in known:
                graph[resolved].add(linked)

    start = (ROOT / "README.md").resolve()
    visited: set[Path] = set()
    pending = [start]
    while pending:
        current = pending.pop()
        if current in visited:
            continue
        visited.add(current)
        pending.extend(graph.get(current, set()) - visited)

    return [
        f"{known[path].relative_to(ROOT)}: Markdown file is unreachable from README.md"
        for path in sorted(known.keys() - visited)
    ]


def json_blocks(path: Path) -> list[str]:
    return re.findall(
        r"^```json[ \t]*\n(.*?)^```[ \t]*$",
        path.read_text(encoding="utf-8"),
        re.MULTILINE | re.DOTALL,
    )


def check_json_blocks(files: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in files:
        blocks = json_blocks(path)
        if path in API_EXAMPLE_FILES and not blocks:
            errors.append(f"{path.relative_to(ROOT)}: no JSON blocks found")
        for index, block in enumerate(blocks, start=1):
            try:
                json.loads(block)
            except json.JSONDecodeError as exc:
                errors.append(
                    f"{path.relative_to(ROOT)}: JSON block {index}: "
                    f"line {exc.lineno}, column {exc.colno}: {exc.msg}"
                )
    return errors


def check_fenced_blocks(files: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in files:
        fence_count = sum(
            1
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.startswith("```")
        )
        if fence_count % 2:
            errors.append(
                f"{path.relative_to(ROOT)}: unbalanced fenced code blocks"
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


def check_error_code_coverage() -> list[str]:
    errors: list[str] = []
    paths = (
        ROOT / "docs" / "B2C_SPEC_v0.1.md",
        API_CONTRACT_INDEX,
    )
    for path in paths:
        text = path.read_text(encoding="utf-8")
        missing = sorted(code for code in EXPECTED_ERROR_CODES if code not in text)
        if missing:
            errors.append(
                f"{path.relative_to(ROOT)}: missing error codes {', '.join(missing)}"
            )
    return errors


def check_decision_queue() -> list[str]:
    path = ROOT / "docs" / "DECISION_QUEUE.md"
    actual = set(re.findall(r"\bD\d{2}\b", path.read_text(encoding="utf-8")))
    missing = sorted(EXPECTED_DECISIONS - actual)
    unexpected = sorted(actual - EXPECTED_DECISIONS)
    errors: list[str] = []
    if missing:
        errors.append(f"{path.relative_to(ROOT)}: missing {', '.join(missing)}")
    if unexpected:
        errors.append(f"{path.relative_to(ROOT)}: unexpected {', '.join(unexpected)}")
    return errors


def check_readme_index() -> list[str]:
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    targets = local_link_targets(text)
    linked = set(targets)
    expected = {
        str(path.relative_to(ROOT)) for path in sorted((ROOT / "docs").glob("*.md"))
    }
    missing = sorted(expected - linked)
    errors = [f"README.md: missing document index link {path}" for path in missing]
    for target in sorted(expected):
        count = targets.count(target)
        if count > 1:
            errors.append(f"README.md: document index link appears {count} times {target}")
    return errors


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


def resolved_link_targets(path: Path) -> set[Path]:
    return {
        (path.parent / target).resolve()
        for target in local_link_targets(path.read_text(encoding="utf-8"))
    }


def check_pagination_contract() -> list[str]:
    errors: list[str] = []
    text = PAGINATION_CONTRACT.read_text(encoding="utf-8")
    request_line = re.compile(rf"`({HTTP_METHODS})\s+(/api/v1/[^`\s]+)`")
    endpoints = {
        canonical_endpoint(method, endpoint)
        for method, endpoint in request_line.findall(text)
    }
    missing_endpoints = sorted(PAGINATED_ENDPOINTS - endpoints)
    unexpected_endpoints = sorted(endpoints - PAGINATED_ENDPOINTS)
    if missing_endpoints:
        errors.append(
            f"{PAGINATION_CONTRACT.relative_to(ROOT)}: missing paginated endpoints "
            f"{', '.join(missing_endpoints)}"
        )
    if unexpected_endpoints:
        errors.append(
            f"{PAGINATION_CONTRACT.relative_to(ROOT)}: unexpected paginated endpoints "
            f"{', '.join(unexpected_endpoints)}"
        )

    missing_sorts = sorted(value for value in PAGINATION_SORT_TUPLES if value not in text)
    if missing_sorts:
        errors.append(
            f"{PAGINATION_CONTRACT.relative_to(ROOT)}: missing stable sort tuples "
            f"{', '.join(missing_sorts)}"
        )

    for path in PAGINATION_REFERENCE_FILES:
        if PAGINATION_CONTRACT.resolve() not in resolved_link_targets(path):
            errors.append(
                f"{path.relative_to(ROOT)}: missing pagination contract reference"
            )

    config_text = (ROOT / "docs" / "CONFIGURATION_SECRETS_v0.1.md").read_text(
        encoding="utf-8"
    )
    for variable in ("CURSOR_SIGNING_KEYS", "CURSOR_SIGNING_ACTIVE_VERSION"):
        if variable not in config_text:
            errors.append(
                "docs/CONFIGURATION_SECRETS_v0.1.md: "
                f"missing cursor configuration {variable}"
            )

    data_text = (ROOT / "docs" / "DATA_CONSTRAINTS_v0.1.md").read_text(
        encoding="utf-8"
    )
    for field in ("first_published_at", "created_at desc", "started_at desc"):
        if field not in data_text:
            errors.append(
                f"docs/DATA_CONSTRAINTS_v0.1.md: missing pagination field/index {field}"
            )
    return errors


def main() -> int:
    files = markdown_files()
    checks = (
        check_links(files),
        check_markdown_structure(files),
        check_markdown_reachability(files),
        check_json_blocks(files),
        check_fenced_blocks(files),
        check_acceptance_coverage(),
        check_error_code_coverage(),
        check_decision_queue(),
        check_readme_index(),
        check_api_contract_index(),
        check_pagination_contract(),
    )
    errors = [error for group in checks for error in group]
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Documentation verification failed with {len(errors)} error(s).")
        return 1

    json_block_count = sum(len(json_blocks(path)) for path in files)
    print(
        f"Documentation verification passed: {len(files)} Markdown files, "
        f"{json_block_count} JSON blocks, {len(example_endpoints())} API endpoints, "
        f"{len(EXPECTED_ERROR_CODES)} error codes, reachable Markdown graph, "
        "canonical H1/date metadata, balanced fences, pagination invariants, "
        "AC01-AC20 and D01-D13 covered."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
