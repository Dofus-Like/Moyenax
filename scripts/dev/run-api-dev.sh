#!/bin/sh
set -eu

if [ ! -x /workspace/node_modules/.bin/nx ] || [ ! -d /workspace/node_modules/eslint ]; then
  yarn install --frozen-lockfile
fi

npx prisma generate --schema=apps/api/prisma/schema.prisma

export NX_TASK_TARGET_PROJECT=api
export NX_TASK_TARGET_TARGET=build
export NX_TASK_TARGET_CONFIGURATION=development

(
  cd /workspace/apps/api
  npx webpack-cli build --node-env=development --watch
) &
BUILD_PID=$!

cleanup() {
  kill "$NODE_PID" 2>/dev/null || true
  kill "$BUILD_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

while [ ! -f /workspace/dist/apps/api/main.js ]; do
  sleep 1
done

node --watch /workspace/dist/apps/api/main.js &
NODE_PID=$!

while kill -0 "$BUILD_PID" 2>/dev/null && kill -0 "$NODE_PID" 2>/dev/null; do
  sleep 1
done

if ! kill -0 "$BUILD_PID" 2>/dev/null; then
  wait "$BUILD_PID"
  kill "$NODE_PID" 2>/dev/null || true
  wait "$NODE_PID" || true
  exit 1
fi

wait "$NODE_PID"
