#!/usr/bin/env python3
"""
scripts/extract_changelog.py

Extracts release notes for a specific version tag from CHANGELOG.md.
Used by GitHub Actions release workflow (.github/workflows/release.yml).
"""

import os
import re
import sys
from pathlib import Path

def extract_release_notes(changelog_path: Path, tag: str) -> str:
    if not changelog_path.exists():
        return f"Release {tag}"

    text = changelog_path.read_text(encoding="utf-8")
    version = tag.lstrip("v").strip()

    # Match section: ## [version] ... up to next ## [ or EOF
    pattern = rf"## \[{re.escape(version)}\][^\n]*\n(.*?)(?=\n## \[|\Z)"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Fallback to Unreleased section if specific tag not found
    unreleased_pattern = r"## \[Unreleased\][^\n]*\n(.*?)(?=\n## \[|\Z)"
    m_unreleased = re.search(unreleased_pattern, text, re.DOTALL)
    if m_unreleased and m_unreleased.group(1).strip():
        return m_unreleased.group(1).strip()

    return f"Release {tag}"

def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TAG", "v0.1.0")
    changelog_file = Path(__file__).resolve().parent.parent / "CHANGELOG.md"

    notes = extract_release_notes(changelog_file, tag)

    out_file = Path("release_notes.md")
    out_file.write_text(notes + "\n", encoding="utf-8")
    print(f"Extracted {len(notes)} bytes of release notes for {tag} -> {out_file}")

    # Set GitHub Actions output if running in CI
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as gh_out:
            gh_out.write("notes<<EOF\n")
            gh_out.write(notes + "\n")
            gh_out.write("EOF\n")

if __name__ == "__main__":
    main()
