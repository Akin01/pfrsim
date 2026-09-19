#!/usr/bin/env bash
# scripts/collect_release_artifacts.sh
# Collects installer bundles, binaries, and generates SHA-256 checksums for GitHub release.

set -euo pipefail

PLATFORM="${1:-${RUNNER_OS:-unknown}}"
DEST_DIR="release_artifacts"

echo "=== Collecting Release Artifacts for Platform: ${PLATFORM} ==="
mkdir -p "${DEST_DIR}"

# 1. Search and copy all native installer bundles
# Check standard target and src-tauri bundle locations
for search_root in "target/release/bundle" "src-tauri/target/release/bundle"; do
  if [ -d "${search_root}" ]; then
    echo "Scanning bundle directory: ${search_root}"
    find "${search_root}" -type f \( \
      -name "*.msi" -o \
      -name "*.exe" -o \
      -name "*.dmg" -o \
      -name "*.deb" -o \
      -name "*.AppImage" \
    \) -exec cp -v {} "${DEST_DIR}/" \; 2>/dev/null || true
  fi
done

# 2. Copy standalone native binary if available
for bin_candidate in "target/release/pfrsim-desktop.exe" "target/release/pfrsim-desktop"; do
  if [ -f "${bin_candidate}" ]; then
    echo "Found standalone binary: ${bin_candidate}"
    cp -v "${bin_candidate}" "${DEST_DIR}/" || true
  fi
done

# 3. Compute SHA-256 checksums
cd "${DEST_DIR}"
CHECKSUM_FILE="checksums-${PLATFORM}.txt"
rm -f "${CHECKSUM_FILE}"

if [ -n "$(ls -A . 2>/dev/null)" ]; then
  echo "Generating SHA-256 checksums -> ${CHECKSUM_FILE}:"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum * > "${CHECKSUM_FILE}" 2>/dev/null || true
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 * > "${CHECKSUM_FILE}" 2>/dev/null || true
  fi
  cat "${CHECKSUM_FILE}" || true
else
  echo "No release artifacts found to package."
fi
cd ..

echo "=== Successfully Prepared Release Artifacts in ${DEST_DIR}/ ==="
