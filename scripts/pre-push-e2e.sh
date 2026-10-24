#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

# E2E runs on its own ports so it never touches the dev stack (dev API :3000/:3001,
# dev web :5173). It shares the local compose Postgres but never stops it unless
# this script started it.
E2E_API_PORT="${E2E_API_PORT:-3101}"
E2E_WEB_PORT="${E2E_WEB_PORT:-5273}"

export DATABASE_URL='postgresql://hexoflat:hexoflat@localhost:5433/hexoflat'
export NODE_ENV=development
export PORT="$E2E_API_PORT"
export CORS_ORIGIN="http://localhost:$E2E_WEB_PORT"
export E2E_API_URL="http://127.0.0.1:$E2E_API_PORT"
export E2E_WEB_URL="http://localhost:$E2E_WEB_PORT"
export E2E_BROWSER_API_URL="http://localhost:$E2E_API_PORT"
export VITE_API_URL="http://localhost:$E2E_API_PORT"

api_pid=''
postgres_started_here=0
api_log=$(mktemp "${TMPDIR:-/tmp}/hexoflat-push-api.XXXXXX")
setup_log=$(mktemp "${TMPDIR:-/tmp}/hexoflat-push-db.XXXXXX")

cleanup() {
  result=$?
  trap - EXIT INT TERM
  if [ -n "$api_pid" ]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  if [ "$postgres_started_here" -eq 1 ]; then
    docker compose -f docker-compose.dev.yml stop postgres || true
  fi
  if [ "$result" -ne 0 ]; then
    printf '\nPre-push checks failed. Database setup log: %s\n' "$setup_log"
    tail -n 60 "$setup_log"
    if [ -s "$api_log" ]; then
      printf '\nAPI log: %s\n' "$api_log"
      tail -n 60 "$api_log"
    fi
  fi
  exit "$result"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for port in "$E2E_API_PORT" "$E2E_WEB_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    printf 'E2E port %s is busy. Free it or set E2E_API_PORT / E2E_WEB_PORT.\n' "$port" >&2
    exit 1
  fi
done

pnpm typecheck
pnpm --filter @hexoflat/engine run build

if ! docker compose -f docker-compose.dev.yml ps --status running --services 2>/dev/null | grep -qx postgres; then
  postgres_started_here=1
fi
printf '\nEnsuring PostgreSQL is up and syncing the local schema...\n'
docker compose -f docker-compose.dev.yml up -d --wait --wait-timeout 60 postgres
# Local development uses db:push, so existing tables may have no migration
# journal. Replaying CREATE TABLE migrations against that DB fails.
# Do not force destructive schema changes or consume git's hook stdin.
pnpm --filter @hexoflat/api run db:push </dev/null >"$setup_log" 2>&1
cat "$setup_log"

printf '\nStarting a fresh API on port %s...\n' "$E2E_API_PORT"
(
  cd apps/api
  exec node --import tsx src/main.ts
) >"$api_log" 2>&1 &
api_pid=$!

attempts=0
until curl --silent --fail --max-time 2 "$E2E_API_URL/health" >/dev/null; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    printf 'API exited before becoming healthy.\n' >&2
    exit 1
  fi
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 30 ]; then
    printf 'API did not become healthy in time.\n' >&2
    exit 1
  fi
  sleep 1
done

printf '\nRunning local E2E with a fresh frontend on port %s...\n' "$E2E_WEB_PORT"
E2E_PRE_PUSH=1 pnpm --filter @hexoflat/playwright run test:e2e "$@"
printf '\nLocal checks passed. Git can continue the push.\n'
