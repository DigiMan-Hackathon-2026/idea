#!/usr/bin/env python3
"""Validate tracked user-research artifacts without reading ignored private files."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "research"
BLOCKED_DIRECTORIES = {"private", "recordings", "raw-media"}
BLOCKED_SUFFIXES = {
    ".aac",
    ".gif",
    ".heic",
    ".jpeg",
    ".jpg",
    ".m4a",
    ".mov",
    ".mp3",
    ".mp4",
    ".ogg",
    ".png",
    ".wav",
    ".webm",
    ".webp",
}
PARTICIPANT_FILE = re.compile(r"P\d{2}\.md")
SYNTHESIS_FILE = re.compile(r"\d{4}-\d{2}-round-\d{2}\.md")
PARTICIPANT_CODE = re.compile(r"^- 참여자 코드:\s*(P\d{2})\s*$", re.MULTILINE)
INTERVIEW_EVIDENCE = re.compile(r"\b[EO]-(P\d{2})-\d{2}\b")
EMAIL = re.compile(r"(?<![\w.+-])[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])")
PHONE = re.compile(
    r"(?<![\d+])(?:"
    r"01[016789][ -]?\d{3,4}[ -]?\d{4}|"
    r"0[789]0[ -]?\d{4}[ -]?\d{4}|"
    r"0(?:2|[3-6][1-5])[ -]?\d{3,4}[ -]?\d{4}|"
    r"\+82[ -]?1[016789][ -]?\d{3,4}[ -]?\d{4}|"
    r"\+81[ -]?[789]0[ -]?\d{4}[ -]?\d{4}"
    r")(?!\d)"
)
SENSITIVE_FIELD = re.compile(
    r"^-\s*(?:"
    r"이름|실명|연락처|이메일|전화번호|휴대폰|카카오톡|숙소|정확한\s+주소|"
    r"名前|氏名|連絡先|メール(?:アドレス)?|電話番号|携帯(?:電話)?|住所|宿泊先|"
    r"name|full\s+name|contact|email|phone|mobile|address|accommodation|"
    r"LINE(?:\s+ID)?|SNS(?:\s+ID)?"
    r")\s*:\s*\S.+$",
    re.IGNORECASE | re.MULTILINE,
)


def tracked_research_files() -> tuple[list[Path], list[str]]:
    result = subprocess.run(
        ["git", "ls-files", "-z", "--", "research"],
        cwd=ROOT,
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", errors="replace").strip()
        return [], [f"git ls-files failed: {message or 'unknown error'}"]
    paths = [
        ROOT / item.decode("utf-8")
        for item in result.stdout.split(b"\0")
        if item
    ]
    return sorted(paths), []


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def require_sections(path: Path, text: str, sections: tuple[str, ...]) -> list[str]:
    return [
        f"{relative(path)}: missing required section {section}"
        for section in sections
        if section not in text
    ]


def check_tracked_safety(paths: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in paths:
        rel = path.relative_to(RESEARCH)
        if BLOCKED_DIRECTORIES.intersection(rel.parts):
            errors.append(f"{relative(path)}: tracked file is in a private/raw directory")
        if path.suffix.lower() in BLOCKED_SUFFIXES:
            errors.append(f"{relative(path)}: tracked media file is not allowed")
        if path.name.lower().startswith("contacts."):
            errors.append(f"{relative(path)}: tracked contacts file is not allowed")
        if not path.exists():
            errors.append(f"{relative(path)}: tracked path is missing from worktree")
    return errors


def check_sensitive_text(paths: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in paths:
        if path.suffix.lower() != ".md" or path.name == "TEMPLATE.md":
            continue
        text = path.read_text(encoding="utf-8")
        if EMAIL.search(text):
            errors.append(f"{relative(path)}: possible email address in research artifact")
        if PHONE.search(text):
            errors.append(f"{relative(path)}: possible phone number in research artifact")
        if SENSITIVE_FIELD.search(text):
            errors.append(f"{relative(path)}: populated sensitive identity field")
    return errors


def check_interviews(paths: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in paths:
        if path.parent != RESEARCH / "interviews" or path.name == "TEMPLATE.md":
            continue
        if not PARTICIPANT_FILE.fullmatch(path.name):
            errors.append(
                f"{relative(path)}: interview filename must match P01.md"
            )
            continue
        text = path.read_text(encoding="utf-8")
        expected_code = path.stem
        match = PARTICIPANT_CODE.search(text)
        if not match:
            errors.append(f"{relative(path)}: missing participant code field")
        elif match.group(1) != expected_code:
            errors.append(
                f"{relative(path)}: participant code {match.group(1)} does not match filename"
            )
        evidence_codes = INTERVIEW_EVIDENCE.findall(text)
        if not evidence_codes:
            errors.append(f"{relative(path)}: interview does not define an E/O evidence ID")
        for evidence_code in evidence_codes:
            if evidence_code != expected_code:
                errors.append(
                    f"{relative(path)}: evidence participant {evidence_code} "
                    f"does not match filename {expected_code}"
                )
        if not re.search(r"^- 메모 동의:\s*예\s*$", text, re.MULTILINE):
            errors.append(f"{relative(path)}: committed notes require explicit memo consent")
        errors.extend(
            require_sections(
                path,
                text,
                (
                    "## 최근 실제 사건",
                    "## 안내 예시 관찰",
                    "## 근거와 해석 분리",
                    "### 반대 증거",
                    "### 아직 모르는 점",
                ),
            )
        )
    return errors


def check_syntheses(paths: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in paths:
        if path.parent != RESEARCH / "synthesis" or path.name == "TEMPLATE.md":
            continue
        if not SYNTHESIS_FILE.fullmatch(path.name):
            errors.append(
                f"{relative(path)}: synthesis filename must match YYYY-MM-round-01.md"
            )
        text = path.read_text(encoding="utf-8")
        errors.extend(
            require_sections(
                path,
                text,
                (
                    "## 사례 목록",
                    "## 반복된 문제와 반대 사례",
                    "## 안내 예시 관찰",
                    "## 지역 후보 평가",
                    "## 결정",
                    "## 스펙 변경",
                ),
            )
        )
        if "evidence ID" not in text:
            errors.append(f"{relative(path)}: synthesis does not link evidence IDs")
    return errors


def check_candidates(paths: list[Path]) -> list[str]:
    errors: list[str] = []
    required = {
        RESEARCH / "region-candidates": (
            "## hard gate",
            "## 점수",
            "## 연결 사건",
            "## 현장·공식 사실",
            "## 반대 근거·위험",
            "## 결정",
        ),
        RESEARCH / "quest-candidates": (
            "## 후보 hard gate",
            "## 후보 점수",
            "## 사용자가 시작 전에 알아야 할 정보",
            "## 사실 정보 출처",
            "## 단계",
            "## 공개 전 확인",
            "## 선택 판단",
        ),
    }
    for path in paths:
        sections = required.get(path.parent)
        if sections is None or path.name == "TEMPLATE.md":
            continue
        if path.suffix != ".md":
            errors.append(f"{relative(path)}: candidate must be a Markdown file")
            continue
        text = path.read_text(encoding="utf-8")
        errors.extend(require_sections(path, text, sections))
        if "evidence ID" not in text:
            errors.append(f"{relative(path)}: candidate does not link evidence IDs")
    return errors


def main() -> int:
    paths, errors = tracked_research_files()
    checks = (
        check_tracked_safety(paths),
        check_sensitive_text(paths),
        check_interviews(paths),
        check_syntheses(paths),
        check_candidates(paths),
    )
    errors.extend(error for group in checks for error in group)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Research verification failed with {len(errors)} error(s).")
        return 1

    markdown_count = sum(path.suffix.lower() == ".md" for path in paths)
    interview_count = sum(
        path.parent == RESEARCH / "interviews" and path.name != "TEMPLATE.md"
        for path in paths
    )
    candidate_count = sum(
        path.parent in {RESEARCH / "region-candidates", RESEARCH / "quest-candidates"}
        and path.name != "TEMPLATE.md"
        for path in paths
    )
    print(
        f"Research verification passed: {markdown_count} tracked Markdown files, "
        f"{interview_count} interviews, {candidate_count} candidates; "
        "no tracked private paths, blocked media, or obvious contact fields."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
