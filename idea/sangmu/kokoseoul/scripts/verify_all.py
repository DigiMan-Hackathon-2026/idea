#!/usr/bin/env python3
"""Run every repository documentation and research check without dependencies."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMMANDS = (
    (
        sys.executable,
        "-m",
        "unittest",
        "scripts/test_verify_docs.py",
        "scripts/test_verify_research.py",
        "scripts/test_verify_scope_gate.py",
    ),
    (sys.executable, "scripts/verify_docs.py"),
    (sys.executable, "scripts/verify_research.py"),
    (sys.executable, "scripts/verify_scope_gate.py"),
)


def main() -> int:
    for command in COMMANDS:
        result = subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode != 0:
            failed = " ".join(command[1:])
            print(f"Repository verification stopped after: {failed}", file=sys.stderr)
            return result.returncode

    print(
        "Repository verification passed: tests, documentation, research, and scope checks."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
