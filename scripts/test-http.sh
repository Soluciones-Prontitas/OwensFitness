#!/usr/bin/env bash
set -euo pipefail
TASK_TEST_DIR=$(mktemp -d)
TASK_SERVER_PID=''
cleanup(){ if [[ -n "$TASK_SERVER_PID" ]]; then kill "$TASK_SERVER_PID" 2>/dev/null || true; fi; rm -rf "$TASK_TEST_DIR"; }
trap cleanup EXIT
pnpm exec tsc --module commonjs --moduleResolution node --target ES2022 --types node --esModuleInterop --skipLibCheck --rootDir . --outDir "$TASK_TEST_DIR/modules" --noEmit false lib/database.ts lib/accounts.ts lib/roles.ts lib/record-access.ts lib/auth.ts
printf '{"type":"commonjs"}\n' > "$TASK_TEST_DIR/modules/package.json"
export SQLITE_PATH="$TASK_TEST_DIR/http.sqlite"
export SESSION_SECRET='test-session-secret-with-32-characters'
export ADMIN_PASSWORD='local-test-admin-password'
export APP_ORIGIN='http://127.0.0.1:3312'
export TASK_MODULES="$TASK_TEST_DIR/modules"
export NODE_PATH="$PWD/node_modules"
unset GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3312 > "$TASK_TEST_DIR/server.log" 2>&1 &
TASK_SERVER_PID=$!
for _ in {1..100}; do if curl --fail --silent "$APP_ORIGIN/OwensFitness/login/" > /dev/null; then break; fi; if ! kill -0 "$TASK_SERVER_PID" 2>/dev/null; then cat "$TASK_TEST_DIR/server.log"; exit 1; fi; sleep .1; done
node --test tests/http-permissions.cjs
