#!/usr/bin/env sh
# Apply pending Drizzle migrations before Railway starts the app.
# Invoked via railway.json deploy.preDeployCommand (see docs/railway-deploy-runbook.md).
set -eu

if [ -z "${TURSO_DB_URL:-}" ]; then
  echo "[migrate] error: TURSO_DB_URL is not set"
  exit 1
fi

case "$TURSO_DB_URL" in
  file:*)
    echo "[migrate] error: TURSO_DB_URL is a local file — set libsql:// for Railway deploy"
    exit 1
    ;;
  libsql:*)
    if [ -z "${TURSO_AUTH_TOKEN:-}" ]; then
      echo "[migrate] error: TURSO_AUTH_TOKEN is required for remote Turso"
      exit 1
    fi
    ;;
esac

cd "$(dirname "$0")/.."
exec bun run db:apply
