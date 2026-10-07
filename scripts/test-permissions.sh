#!/usr/bin/env bash
set -euo pipefail
TASK_TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TASK_TEST_DIR"' EXIT
pnpm exec tsc --module commonjs --moduleResolution node --target ES2022 --types node --esModuleInterop --skipLibCheck --rootDir . --outDir "$TASK_TEST_DIR" --noEmit false lib/database.ts lib/accounts.ts lib/roles.ts lib/record-access.ts lib/auth.ts
mkdir -p "$TASK_TEST_DIR/tests"
cp tests/permissions.cjs "$TASK_TEST_DIR/tests/permissions.cjs"
printf '{"type":"commonjs"}\n' > "$TASK_TEST_DIR/package.json"
NODE_PATH="$PWD/node_modules" SQLITE_PATH="$TASK_TEST_DIR/test.sqlite" SESSION_SECRET='test-session-secret-with-32-characters' node --test "$TASK_TEST_DIR/tests/permissions.cjs"
