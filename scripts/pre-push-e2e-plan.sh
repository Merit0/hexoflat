#!/bin/sh
# Reads git pre-push ref lines on stdin and prints what e2e to run:
#   none            only tests, docs or tooling changed
#   all             run the whole suite
#   <spec> <spec>   run just these specs (paths relative to apps/playwright)
# `--check` verifies scripts/e2e-suites.map against apps/playwright/e2e.

cd "$(dirname "$0")/.." || exit 1
map=scripts/e2e-suites.map
zero=0000000000000000000000000000000000000000

rules() { grep -v '^[[:space:]]*\(#\|$\)' "$map"; }

check_map() {
  status=0
  for spec in $(rules | cut -d' ' -f2- | tr -s ' \t' '\n\n' | sort -u); do
    [ -f "apps/playwright/$spec" ] || { echo "e2e map: $spec does not exist" >&2; status=1; }
  done
  for path in $(cd apps/playwright && find e2e -name '*.spec.ts' | sort); do
    rules | cut -d' ' -f2- | tr -s ' \t' '\n\n' | grep -qx "$path" \
      || { echo "e2e map: $path is in no rule of $map" >&2; status=1; }
  done
  return $status
}

[ "${1:-}" = "--check" ] && { check_map; exit $?; }
check_map || exit 1

specs_for() {
  rules | while read -r pattern owned; do
    # shellcheck disable=SC2254
    case "$1" in $pattern) printf '%s\n' $owned ;; esac
  done
}

# Prints: safe | spec:<path>... | unknown
classify() {
  case "$1" in
    apps/playwright/e2e/*.spec.ts) echo "${1#apps/playwright/}"; return ;;
    *.test.ts | *.test.tsx | *.test.js | *.md) return ;;
    docs/* | .github/* | .husky/* | .vscode/* | .idea/*) return ;;
    apps/playwright/*) echo unknown; return ;;
  esac
  owned=$(specs_for "$1")
  if [ -n "$owned" ]; then echo "$owned"; else echo unknown; fi
}

collected=''
while read -r _local_ref local_sha _remote_ref remote_sha; do
  [ "$local_sha" = "$zero" ] && continue
  if [ "$remote_sha" = "$zero" ]; then
    base=$(git merge-base origin/main "$local_sha" 2>/dev/null || true)
    if [ -z "$base" ]; then
      echo "pre-push: no origin/main to compare with, running the whole suite." >&2
      echo all; exit 0
    fi
  else
    base="$remote_sha"
    git cat-file -e "$base^{commit}" 2>/dev/null || { echo all; exit 0; }
  fi
  changed=$(git diff --name-only "$base" "$local_sha") || { echo all; exit 0; }
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    result=$(classify "$file")
    case "$result" in
      *unknown*) echo all; exit 0 ;;
    esac
    [ -n "$result" ] && collected="$collected
$result"
  done <<LIST
$changed
LIST
done

collected=$(printf '%s\n' "$collected" | grep -v '^$' | sort -u | tr '\n' ' ' | sed 's/ $//')
if [ -z "$collected" ]; then echo none; else echo "$collected"; fi
