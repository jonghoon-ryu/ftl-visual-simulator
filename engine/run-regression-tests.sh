#!/usr/bin/env bash
set -euo pipefail

# Golden/regression test: builds the native CLI and runs it against the
# committed sample ssdconfig.xml/workload.xml, then checks the result XML
# for each scenario is byte-identical to the checked-in "golden" copy in
# engine/tests/golden/.
#
# This exists because engine/mqsim/src is supposed to behave exactly like
# upstream MQSim (see the WASM/em++ primer doc's fidelity argument) -
# instrumentation (Simulation_Events hooks, getState()) must never change
# simulation output. Every hook added so far was manually verified this way
# during development (see e.g. WASM_PARITY_DEBUG_LOG.md); this script is
# that same check made repeatable instead of a throwaway one-off each time.
#
# This is NOT a substitute for real unit tests (mocking the FTL's abstract
# interfaces with GMock - see engine/run-unit-tests.sh / engine/tests/unit/).
# This only catches "did the simulation's actual output change", which is
# exactly what an instrumentation-only change (a hook, an export function)
# must never do; the GMock suite instead checks that individual modules
# (GC/WL trigger logic, erase-count bookkeeping, ...) behave correctly
# under conditions a real workload may take millions of event-groups to
# stumble into naturally, or may never reach at all.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$SCRIPT_DIR/mqsim"
GOLDEN_DIR="$SCRIPT_DIR/tests/golden"
BINARY="$SCRIPT_DIR/../.build/MQSim"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Building native CLI..."
bash "$SCRIPT_DIR/build-native.sh" "$BINARY"

cp "$ENGINE_DIR/ssdconfig.xml" "$ENGINE_DIR/workload.xml" "$WORK_DIR/"
cp -r "$ENGINE_DIR/traces" "$WORK_DIR/"

echo "Running sample scenarios..."
( cd "$WORK_DIR" && "$BINARY" -i ssdconfig.xml -w workload.xml < /dev/null > run.log 2>&1 ) || {
	echo "MQSim exited with an error - see log:" >&2
	cat "$WORK_DIR/run.log" >&2
	exit 1
}

failed=0
for golden in "$GOLDEN_DIR"/workload_scenario_*.xml; do
	name="$(basename "$golden")"
	actual="$WORK_DIR/$name"
	if [ ! -f "$actual" ]; then
		echo "FAIL  $name - not produced by this run"
		failed=1
		continue
	fi
	if cmp -s "$golden" "$actual"; then
		echo "PASS  $name"
	else
		echo "FAIL  $name - result differs from golden/"
		echo "      diff (first 5 lines):"
		diff "$golden" "$actual" | head -5 | sed 's/^/      /'
		failed=1
	fi
done

if [ "$failed" -ne 0 ]; then
	echo "Regression test FAILED - simulation output changed. If this is an" >&2
	echo "intentional behavior change, review the diff and update" >&2
	echo "engine/tests/golden/ deliberately (don't just silence this)." >&2
	exit 1
fi

echo "All scenarios match golden output."
