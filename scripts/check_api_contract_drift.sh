#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="apps/web/src/types/generated/contracts"

fingerprint() {
  find "$TARGET_DIR" -maxdepth 1 -type f -name "*.ts" -print0 \
    | sort -z \
    | xargs -0 shasum
}

before="$(fingerprint)"

npm run generate:api-contracts >/dev/null
npx prettier --write "$TARGET_DIR/*.ts" >/dev/null

after="$(fingerprint)"

if [[ "$before" != "$after" ]]; then
  echo "Generated API contracts are stale. Run: npm run generate:api-contracts"
  git diff --name-only -- "$TARGET_DIR"
  exit 1
fi

echo "API contract drift check passed."
