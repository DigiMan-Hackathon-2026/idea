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
EXPECTED_ERROR_CONTRACT = {
    "VALIDATION_ERROR": (400, False),
    "SESSION_REQUIRED": (401, False),
    "ORIGIN_FORBIDDEN": (403, False),
    "ADMIN_FORBIDDEN": (403, False),
    "NOT_FOUND": (404, False),
    "METHOD_NOT_ALLOWED": (405, False),
    "QUEST_UNAVAILABLE": (409, False),
    "STEP_ORDER_CONFLICT": (409, False),
    "RUN_NOT_COMPLETED": (409, False),
    "VERSION_CONFLICT": (409, False),
    "REQUEST_CONFLICT": (409, False),
    "RATE_LIMITED": (429, True),
    "INTERNAL_ERROR": (500, False),
    "SERVICE_UNAVAILABLE": (503, True),
}
EXPECTED_ERROR_CODES = set(EXPECTED_ERROR_CONTRACT)
API_EXAMPLE_FILES = (
    ROOT / "docs" / "API_EXAMPLES_B2C_v0.1.md",
    ROOT / "docs" / "API_EXAMPLES_ADMIN_v0.1.md",
)
API_CONTRACT_INDEX = ROOT / "docs" / "API_CONTRACT_INDEX_v0.1.md"
API_ERROR_CATALOG = ROOT / "docs" / "API_ERROR_CATALOG_v0.1.md"
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
VISITOR_SESSION_CONTRACT = ROOT / "docs" / "VISITOR_SESSION_LIFECYCLE_v0.1.md"
VISITOR_SESSION_REFERENCE_FILES = (
    ROOT / "docs" / "API_CONTRACT_INDEX_v0.1.md",
    ROOT / "docs" / "B2C_SPEC_v0.1.md",
    ROOT / "docs" / "CONFIGURATION_SECRETS_v0.1.md",
    ROOT / "docs" / "DATA_CONSTRAINTS_v0.1.md",
    ROOT / "docs" / "SECURITY_PRIVACY_v0.1.md",
    ROOT / "docs" / "STATE_MACHINES_v0.1.md",
    ROOT / "docs" / "TEST_PLAN_v0.1.md",
)
BACKGROUND_JOBS_CONTRACT = ROOT / "docs" / "BACKGROUND_JOBS_v0.1.md"
BACKGROUND_JOBS_REFERENCE_FILES = (
    ROOT / "docs" / "ANALYTICS_EVENT_CONTRACT_v0.1.md",
    ROOT / "docs" / "DATA_RETENTION_ERASURE_v0.1.md",
    ROOT / "docs" / "OBSERVABILITY_CONTRACT_v0.1.md",
    ROOT / "docs" / "OPERATIONS_RUNBOOK_v0.1.md",
    ROOT / "docs" / "VISITOR_SESSION_LIFECYCLE_v0.1.md",
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
        API_ERROR_CATALOG,
    )
    for path in paths:
        text = path.read_text(encoding="utf-8")
        missing = sorted(code for code in EXPECTED_ERROR_CODES if code not in text)
        if missing:
            errors.append(
                f"{path.relative_to(ROOT)}: missing error codes {', '.join(missing)}"
            )
    return errors


def check_error_catalog() -> list[str]:
    errors: list[str] = []
    text = API_ERROR_CATALOG.read_text(encoding="utf-8")
    row = re.compile(
        r"^\| `([A-Z][A-Z0-9_]*)` \| (\d{3}) \| (true|false) \|",
        re.MULTILINE,
    )
    rows = row.findall(text)
    actual: dict[str, tuple[int, bool]] = {}
    for code, status, retryable in rows:
        if code in actual:
            errors.append(
                f"{API_ERROR_CATALOG.relative_to(ROOT)}: duplicate code row {code}"
            )
        actual[code] = (int(status), retryable == "true")

    missing = sorted(EXPECTED_ERROR_CODES - set(actual))
    unexpected = sorted(set(actual) - EXPECTED_ERROR_CODES)
    if missing:
        errors.append(
            f"{API_ERROR_CATALOG.relative_to(ROOT)}: missing code rows "
            f"{', '.join(missing)}"
        )
    if unexpected:
        errors.append(
            f"{API_ERROR_CATALOG.relative_to(ROOT)}: unexpected code rows "
            f"{', '.join(unexpected)}"
        )
    for code, expected in EXPECTED_ERROR_CONTRACT.items():
        if code in actual and actual[code] != expected:
            errors.append(
                f"{API_ERROR_CATALOG.relative_to(ROOT)}: {code} expected "
                f"HTTP {expected[0]} retryable={str(expected[1]).lower()}, got "
                f"HTTP {actual[code][0]} retryable={str(actual[code][1]).lower()}"
            )

    index_text = API_CONTRACT_INDEX.read_text(encoding="utf-8")
    index_row = re.compile(r"^\| `([A-Z][A-Z0-9_]*)` \| (\d{3}) \|", re.MULTILINE)
    index_contract = {
        code: int(status) for code, status in index_row.findall(index_text)
    }
    if set(index_contract) != EXPECTED_ERROR_CODES:
        missing_index = sorted(EXPECTED_ERROR_CODES - set(index_contract))
        unexpected_index = sorted(set(index_contract) - EXPECTED_ERROR_CODES)
        if missing_index:
            errors.append(
                f"{API_CONTRACT_INDEX.relative_to(ROOT)}: missing error rows "
                f"{', '.join(missing_index)}"
            )
        if unexpected_index:
            errors.append(
                f"{API_CONTRACT_INDEX.relative_to(ROOT)}: unexpected error rows "
                f"{', '.join(unexpected_index)}"
            )
    for code, (status, _) in EXPECTED_ERROR_CONTRACT.items():
        if code in index_contract and index_contract[code] != status:
            errors.append(
                f"{API_CONTRACT_INDEX.relative_to(ROOT)}: {code} expected HTTP "
                f"{status}, got {index_contract[code]}"
            )

    catalog_json = json_blocks(API_ERROR_CATALOG)
    if not catalog_json:
        errors.append(f"{API_ERROR_CATALOG.relative_to(ROOT)}: missing JSON envelope")
    else:
        envelope = json.loads(catalog_json[0])
        error = envelope.get("error", {})
        required_fields = {
            "code",
            "messageJa",
            "requestId",
            "retryable",
            "details",
        }
        if set(error) != required_fields:
            errors.append(
                f"{API_ERROR_CATALOG.relative_to(ROOT)}: error envelope fields must be "
                f"{', '.join(sorted(required_fields))}"
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


def check_visitor_session_contract() -> list[str]:
    errors: list[str] = []
    text = VISITOR_SESSION_CONTRACT.read_text(encoding="utf-8")
    required_fragments = (
        "32 random bytes",
        "HMAC-SHA-256",
        "2,592,000 seconds",
        "Max-Age=2592000",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Path=/",
        "SESSION_REQUIRED",
    )
    for fragment in required_fragments:
        if fragment not in text:
            errors.append(
                f"{VISITOR_SESSION_CONTRACT.relative_to(ROOT)}: "
                f"missing session invariant {fragment}"
            )

    for path in VISITOR_SESSION_REFERENCE_FILES:
        if VISITOR_SESSION_CONTRACT.resolve() not in resolved_link_targets(path):
            errors.append(
                f"{path.relative_to(ROOT)}: missing visitor session contract reference"
            )

    config_path = ROOT / "docs" / "CONFIGURATION_SECRETS_v0.1.md"
    config_text = config_path.read_text(encoding="utf-8")
    for variable in ("SESSION_TOKEN_PEPPERS", "SESSION_TOKEN_ACTIVE_VERSION"):
        if variable not in config_text:
            errors.append(
                f"{config_path.relative_to(ROOT)}: "
                f"missing visitor session configuration {variable}"
            )

    legacy_name = re.compile(r"\bSESSION_TOKEN_PEPPER\b")
    for path in markdown_files():
        if legacy_name.search(path.read_text(encoding="utf-8")):
            errors.append(
                f"{path.relative_to(ROOT)}: legacy unversioned SESSION_TOKEN_PEPPER"
            )

    data_path = ROOT / "docs" / "DATA_CONSTRAINTS_v0.1.md"
    data_text = data_path.read_text(encoding="utf-8")
    for field in ("token_hash_version", "token_hash", "expires_at > created_at"):
        if field not in data_text:
            errors.append(
                f"{data_path.relative_to(ROOT)}: missing visitor session field {field}"
            )

    examples = API_EXAMPLE_FILES[0].read_text(encoding="utf-8")
    common_cookie_attributes = ("Path=/", "HttpOnly", "Secure", "SameSite=Lax")
    session_cookie_lines = [
        line
        for line in examples.splitlines()
        if line.startswith("Set-Cookie: digiman_visitor=")
    ]
    if not session_cookie_lines:
        errors.append("docs/API_EXAMPLES_B2C_v0.1.md: missing visitor Set-Cookie example")
    create_cookie_count = 0
    delete_cookie_count = 0
    for line in session_cookie_lines:
        is_delete = "Max-Age=0" in line
        create_cookie_count += not is_delete
        delete_cookie_count += is_delete
        missing = [value for value in common_cookie_attributes if value not in line]
        if not is_delete and "Max-Age=2592000" not in line:
            missing.append("Max-Age=2592000")
        if missing:
            errors.append(
                "docs/API_EXAMPLES_B2C_v0.1.md: visitor Set-Cookie missing "
                f"{', '.join(missing)}"
            )
        if "Domain=" in line:
            errors.append(
                "docs/API_EXAMPLES_B2C_v0.1.md: visitor cookie must remain host-only"
            )
    if create_cookie_count != 1:
        errors.append(
            "docs/API_EXAMPLES_B2C_v0.1.md: expected one visitor cookie creation example"
        )
    if delete_cookie_count != 1:
        errors.append(
            "docs/API_EXAMPLES_B2C_v0.1.md: expected one visitor cookie deletion example"
        )
    return errors


def check_background_jobs_contract() -> list[str]:
    errors: list[str] = []
    text = BACKGROUND_JOBS_CONTRACT.read_text(encoding="utf-8")
    required_fragments = (
        "visitor_expiry_cleanup",
        "anonymous_analytics_cleanup",
        "post_restore_privacy_cleanup",
        "FOR UPDATE SKIP LOCKED LIMIT 1",
        "event_name = 'detail_viewed'",
        "visitor_id is null",
        "interval '30 days'",
        "24시간",
        "public traffic을 닫는다",
    )
    for fragment in required_fragments:
        if fragment not in text:
            errors.append(
                f"{BACKGROUND_JOBS_CONTRACT.relative_to(ROOT)}: "
                f"missing background job invariant {fragment}"
            )

    for path in BACKGROUND_JOBS_REFERENCE_FILES:
        if BACKGROUND_JOBS_CONTRACT.resolve() not in resolved_link_targets(path):
            errors.append(
                f"{path.relative_to(ROOT)}: missing background jobs contract reference"
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
        check_error_catalog(),
        check_decision_queue(),
        check_readme_index(),
        check_api_contract_index(),
        check_pagination_contract(),
        check_visitor_session_contract(),
        check_background_jobs_contract(),
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
        "canonical H1/date metadata, balanced fences, "
        "pagination/session/error/job invariants, "
        "AC01-AC20 and D01-D13 covered."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
