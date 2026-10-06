#!/usr/bin/env python3
"""Validate docs/features feature tracking structure.

Standalone copy for installed Codex skills. The repository CLI has the same
validation behavior plus init/add/install commands.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse


FEATURE_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LINK_RE = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$", re.MULTILINE)

REQUIRED_SECTION_GROUPS = [
    ("current status",),
    ("source of truth",),
    ("current behavior", "existing features", "existing functionality"),
    ("decisions", "known risks", "current attention", "notes"),
    ("changelog", "change log"),
]

SECTION_HEADING_ALIASES = {
    "当前状态": "current status",
    "当前行为": "current behavior",
    "已有功能": "existing features",
    "已有功能列表": "existing features",
    "当前功能": "existing functionality",
    "当前决策": "decisions",
    "决策": "decisions",
    "已知风险": "known risks",
    "当前注意点": "current attention",
    "注意点": "notes",
    "开放问题": "notes",
    "变更记录": "changelog",
    "更新记录": "changelog",
    "修改记录": "change log",
}


def normalize_heading(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value.strip().lower())
    return SECTION_HEADING_ALIASES.get(normalized, normalized)


def extract_links(markdown: str) -> list[str]:
    return [match.group(1).strip() for match in LINK_RE.finditer(markdown)]


def strip_link_target(raw: str) -> str:
    raw = raw.strip()
    if " " in raw and not raw.startswith("<"):
        raw = raw.split(" ", 1)[0]
    if raw.startswith("<") and raw.endswith(">"):
        raw = raw[1:-1]
    return raw


def is_external_or_anchor(target: str) -> bool:
    parsed = urlparse(target)
    return bool(parsed.scheme or target.startswith("#") or target.startswith("mailto:"))


def local_link_path(base_file: Path, target: str) -> Path | None:
    target = strip_link_target(target)
    if is_external_or_anchor(target):
        return None
    target = target.split("#", 1)[0]
    if not target:
        return None
    return (base_file.parent / unquote(target)).resolve()


def check_broken_links(file_path: Path, markdown: str) -> list[str]:
    errors: list[str] = []
    for raw_link in extract_links(markdown):
        path = local_link_path(file_path, raw_link)
        if path is not None and not path.exists():
            errors.append(f"{file_path}: broken link `{raw_link}` -> {path}")
    return errors


def feature_id_from_track(features_dir: Path, track: Path) -> str:
    return track.parent.relative_to(features_dir).as_posix()


def validate(root: Path, *, ci: bool = False) -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    errors: list[str] = []

    features_dir = root / "docs" / "features"
    index_path = features_dir / "README.md"

    if not features_dir.exists():
        errors.append(f"Missing feature directory: {features_dir}")
        return warnings, errors
    if not index_path.exists():
        errors.append(f"Missing feature index: {index_path}")
        return warnings, errors

    index_text = index_path.read_text(encoding="utf-8")
    errors.extend(check_broken_links(index_path, index_text))

    if ci:
        for heading in ("Feature", "Status", "Track", "Source Of Truth", "Updated"):
            if heading not in index_text:
                errors.append(f"{index_path}: CI mode requires `{heading}` in the index table")

    indexed_track_paths: set[Path] = set()
    for link in extract_links(index_text):
        path = local_link_path(index_path, link)
        if path is not None and path.name.lower() == "readme.md" and features_dir in path.parents:
            indexed_track_paths.add(path.resolve())

    track_paths = sorted(
        path for path in features_dir.glob("*/README.md") if path.resolve() != index_path.resolve()
    )

    if not track_paths:
        message = f"No feature tracks found under {features_dir}"
        if ci:
            errors.append(message)
        else:
            warnings.append(message)

    for track_path in track_paths:
        track_text = track_path.read_text(encoding="utf-8")
        headings = {normalize_heading(h) for h in HEADING_RE.findall(track_text)}
        feature_id = feature_id_from_track(features_dir, track_path)

        if ci and not FEATURE_ID_RE.match(feature_id):
            errors.append(f"{track_path}: CI mode requires lowercase hyphen-case feature id `{feature_id}`")

        if track_path.resolve() not in indexed_track_paths:
            errors.append(f"{track_path}: feature `{feature_id}` is not linked from {index_path}")

        for group in REQUIRED_SECTION_GROUPS:
            if any(section in headings for section in group):
                continue
            if group == ("current behavior", "existing features", "existing functionality"):
                has_status = "current status" in headings
                has_context = bool({"decisions", "known risks", "current attention", "notes"} & headings)
                if has_status and has_context:
                    continue
            options = " or ".join(f"`{section}`" for section in group)
            errors.append(f"{track_path}: missing section {options}")

        errors.extend(check_broken_links(track_path, track_text))

    for indexed_path in indexed_track_paths:
        if not indexed_path.exists():
            errors.append(f"{index_path}: indexed feature track does not exist: {indexed_path}")

    return warnings, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate docs/features feature tracking docs.")
    parser.add_argument("--root", default=".", help="Project root. Defaults to current directory.")
    parser.add_argument("--ci", action="store_true", help="Enable stricter CI checks.")
    args = parser.parse_args()

    warnings, errors = validate(Path(args.root).resolve(), ci=args.ci)

    for warning in warnings:
        print(f"WARN: {warning}")
    for error in errors:
        print(f"ERROR: {error}")

    if errors:
        print(f"Feature Track validation failed: {len(errors)} error(s), {len(warnings)} warning(s).")
        return 1

    print(f"Feature Track validation passed: {len(warnings)} warning(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
