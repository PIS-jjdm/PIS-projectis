#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROTO_DIR="$ROOT_DIR/proto"
OUT_DIR="$ROOT_DIR/frontend/src/lib/grpc/generated"
PROTOC_INCLUDE="${PROTOC_INCLUDE:-}"

mkdir -p "$OUT_DIR"

PROTOC_GEN_JS="$ROOT_DIR/frontend/node_modules/.bin/protoc-gen-js"

if [[ -z "$PROTOC_INCLUDE" ]]; then
  for candidate in /usr/include /usr/local/include; do
    if [[ -f "$candidate/google/protobuf/timestamp.proto" ]]; then
      PROTOC_INCLUDE="$candidate"
      break
    fi
  done
fi

PROTOC_ARGS=(
  -I="$PROTO_DIR"
)

if [[ -n "$PROTOC_INCLUDE" ]]; then
  PROTOC_ARGS+=(-I="$PROTOC_INCLUDE")
fi

protoc \
  "${PROTOC_ARGS[@]}" \
  --plugin=protoc-gen-js="$PROTOC_GEN_JS" \
  --js_out=import_style=commonjs,binary:"$OUT_DIR" \
  "$PROTO_DIR/common.proto" \
  "$PROTO_DIR/auth.proto" \
  "$PROTO_DIR/subject.proto" \
  "$PROTO_DIR/project.proto" \
  "$PROTO_DIR/notification.proto" \
  "$PROTO_DIR/eval.proto" \
  "$PROTO_DIR/gateway.proto"

node -e '
const fs = require("fs");
const path = process.argv[1];
for (const file of fs.readdirSync(path)) {
  if (!file.endsWith("_pb.js")) continue;
  const target = `${path}/${file}`;
  let source = fs.readFileSync(target, "utf8");
  const marker = "Function('\''return this'\'')();\n";
  if (!source.includes("var proto = globalThis.proto || (globalThis.proto = {});")) {
    source = source.replace(
      marker,
      `${marker}var proto = globalThis.proto || (globalThis.proto = {});\n`,
    );
  }
  if (!source.includes("var COMPILED = false;")) {
    source = source.replace(
      "var proto = globalThis.proto || (globalThis.proto = {});\n",
      "var proto = globalThis.proto || (globalThis.proto = {});\nvar COMPILED = false;\n",
    );
  }
  fs.writeFileSync(target, source);
}
' "$OUT_DIR"
