#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

# Always test the local compose database and local servers.
export DATABASE_URL='postgresql://hexoflat:hexoflat@localhost:5433/hexoflat'
export NODE_ENV=development
export PORT=3001
export CORS_ORIGIN='http://localhost:5173'
export E2E_API_URL='http://127.0.0.1:3001'
export E2E_WEB_URL='http://localhost:5173'
export E2E_BROWSER_API_URL='http://localhost:3001'
export VITE_API_URL='http://localhost:3001'

api_pid=''
api_log=$(mktemp "${TMPDIR:-/tmp}/hexoflat-push-api.XXXXXX")
setup_log=$(mktemp "${TMPDIR:-/tmp}/hexoflat-push-db.XXXXXX")

cleanup() {
  result=$?
  trap - EXIT INT TERM
  if [ -n "$api_pid" ]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  docker compose -f docker-compose.dev.yml stop postgres || true
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

printf '\nStopping local Hexoflat services...\n'
pnpm run stop:all

# A process manager may restart a server after stop:all. Do not accidentally
# test that stale server instead of the fresh API started below.
for port in 3001 5173; do
  attempts=0
  while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 10 ]; then
      printf 'Port %s is still occupied. Stop its process manager and retry.\n' "$port" >&2
      exit 1
    fi
    sleep 1
  done
done

pnpm typecheck
pnpm --filter @hexoflat/engine run build

printf '\nStarting PostgreSQL and syncing the local schema...\n'
docker compose -f docker-compose.dev.yml up -d --wait --wait-timeout 60 postgres
# Local development uses db:push, so existing tables may have no migration
# journal. Replaying CREATE TABLE migrations against that DB fails.
# Do not force destructive schema changes or consume git's hook stdin.
pnpm --filter @hexoflat/api run db:push </dev/null >"$setup_log" 2>&1
cat "$setup_log"

printf '\nStarting a fresh API...\n'
(
  cd apps/api
  exec node --import tsx src/main.ts
) >"$api_log" 2>&1 &
api_pid=$!

attempts=0
until curl --silent --fail --max-time 2 http://127.0.0.1:3001/health >/dev/null; do
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

printf '\nRunning local E2E with a fresh frontend...\n'
E2E_PRE_PUSH=1 pnpm --filter @hexoflat/playwright run test:e2e
printf '\nLocal checks passed. Git can continue the push.\n'
