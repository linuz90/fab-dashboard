#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: ./workspace-setup.sh init" >&2
}

log() {
  printf '[workspace-setup] %s\n' "$*"
}

script_dir() {
  local source="${BASH_SOURCE[0]}"
  while [ -L "$source" ]; do
    local dir
    dir="$(cd -P "$(dirname "$source")" >/dev/null 2>&1 && pwd)"
    source="$(readlink "$source")"
    [[ "$source" != /* ]] && source="$dir/$source"
  done
  cd -P "$(dirname "$source")" >/dev/null 2>&1 && pwd
}

resolve_target_root() {
  if [ -n "${WORKSPACE_TARGET_PATH:-}" ]; then
    cd "$WORKSPACE_TARGET_PATH" >/dev/null 2>&1 && pwd
    return
  fi

  local git_root
  if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
    printf '%s\n' "$git_root"
    return
  fi

  script_dir
}

candidate_source_from_git_common_dir() {
  local target="$1"
  local common_dir
  common_dir="$(git -C "$target" rev-parse --git-common-dir 2>/dev/null || true)"
  [ -n "$common_dir" ] || return 0

  case "$common_dir" in
    /*) ;;
    *) common_dir="$target/$common_dir" ;;
  esac

  local candidate
  candidate="$(cd "$common_dir/.." >/dev/null 2>&1 && pwd -P || true)"
  [ -n "$candidate" ] && printf '%s\n' "$candidate"
}

find_source_root() {
  local target="$1"
  local candidate
  for candidate in "${WORKSPACE_SOURCE_PATH:-}" "${CODEX_SOURCE_TREE_PATH:-}" "$(candidate_source_from_git_common_dir "$target")"; do
    [ -n "$candidate" ] || continue
    [ -d "$candidate" ] || continue
    candidate="$(cd "$candidate" >/dev/null 2>&1 && pwd -P)"
    [ "$candidate" != "$target" ] || continue
    [ -f "$candidate/.worktreeinclude" ] || continue
    printf '%s\n' "$candidate"
    return
  done
}

copy_worktreeinclude_files() {
  local source="$1"
  local target="$2"
  local include_file="$source/.worktreeinclude"

  [ -f "$include_file" ] || return 0
  git -C "$source" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0

  local copied=0
  while IFS= read -r -d '' rel; do
    [ -n "$rel" ] || continue
    [ -e "$source/$rel" ] || continue
    [ ! -e "$target/$rel" ] || continue

    # Match Codex's managed worktree behavior: do not copy source symlinks.
    [ ! -L "$source/$rel" ] || continue

    mkdir -p "$target/$(dirname "$rel")"
    cp -p "$source/$rel" "$target/$rel"
    copied=$((copied + 1))
  # Only copy files explicitly listed in .worktreeinclude. Adding
  # --exclude-standard here would expand to every ignored path, including
  # node_modules, dist, and local dashboard data.
  done < <(git -C "$source" ls-files -o -i --exclude-from="$include_file" -z)

  if [ "$copied" -gt 0 ]; then
    log "copied $copied ignored local file(s) from source checkout"
  fi
}

init() {
  local target
  target="$(resolve_target_root)"
  [ -d "$target" ] || {
    echo "Target checkout does not exist: $target" >&2
    exit 1
  }

  cd "$target"
  log "target $target"

  local source
  source="$(find_source_root "$target" || true)"
  if [ -n "$source" ]; then
    copy_worktreeinclude_files "$source" "$target"
  fi

  if [ "${WORKSPACE_SETUP_SKIP_INSTALL:-0}" = "1" ]; then
    log "skipping bun install"
    return
  fi

  command -v bun >/dev/null 2>&1 || {
    echo "Bun is required. Install Bun, then rerun ./workspace-setup.sh init." >&2
    exit 1
  }

  log "installing dependencies"
  bun install --frozen-lockfile
}

case "${1:-}" in
  init)
    init
    ;;
  *)
    usage
    exit 2
    ;;
esac
