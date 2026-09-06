#!/usr/bin/env bash
set -euo pipefail

# Builds the vendored MQSim engine (engine/mqsim/src) as a plain native CLI
# binary (the same way the upstream MQSim README always built it, minus the
# WASM bindings). This is the binary run-regression-tests.sh uses to check
# that a change hasn't altered simulation behavior - see that script for
# what "golden" means here.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$SCRIPT_DIR/mqsim"
OUT_PATH="${1:-$SCRIPT_DIR/../.build/MQSim}"

INCLUDES=()
for m in exec host nvm_chip nvm_chip/flash_memory sim ssd utils; do
	INCLUDES+=("-I$ENGINE_DIR/src/$m")
done

SRCS=()
while IFS= read -r -d '' f; do
	SRCS+=("$f")
done < <(find "$ENGINE_DIR/src" -name "*.cpp" ! -path "*/wasm/*" -print0)
# wasm/bindings.cpp is excluded - it needs Emscripten's <emscripten/bind.h>,
# which doesn't exist for a native g++ build.

mkdir -p "$(dirname "$OUT_PATH")"

g++ -std=c++17 -O2 "${INCLUDES[@]}" "${SRCS[@]}" -o "$OUT_PATH"

echo "Built $OUT_PATH"
