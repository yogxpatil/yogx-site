#!/usr/bin/env bash
# Dev aid: screenshots via tests/e2e/shots.spec.ts against an already running `node scripts/serve-out.mjs <port>`.
# Usage: scripts/shots.sh <port> <outdir> "sc-cc:0.2,-0.5;c5:0"
cd "$(dirname "$0")/.." || exit 1
PW_PORT="$1" PW_REUSE_SERVER=1 SHOTS_DIR="$2" SHOTS="$3" npx playwright test tests/e2e/shots.spec.ts --project=desktop --reporter=line 2>&1 | grep -E "^(sc-|c[0-9])|passed|failed|Error" | cut -c1-140
