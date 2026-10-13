#!/bin/sh

zero=0000000000000000000000000000000000000000

is_safe() {
  case "$1" in
    apps/playwright/*) return 1 ;;
    *.test.ts | *.test.tsx | *.test.js) return 0 ;;
    *.md | docs/* | .github/* | .husky/* | .vscode/* | .idea/*) return 0 ;;
    *) return 1 ;;
  esac
}

while read -r _local_ref local_sha _remote_ref remote_sha; do
  [ "$local_sha" = "$zero" ] && continue
  if [ "$remote_sha" = "$zero" ]; then
    base=$(git merge-base origin/main "$local_sha" 2>/dev/null || true)
    [ -n "$base" ] || exit 0
  else
    base="$remote_sha"
    git cat-file -e "$base^{commit}" 2>/dev/null || exit 0
  fi
  changed=$(git diff --name-only "$base" "$local_sha") || exit 0
  [ -n "$changed" ] || continue
  for file in $changed; do
    is_safe "$file" || exit 0
  done
done

exit 1
