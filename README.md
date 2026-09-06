# FTL Visual Simulator

An interactive, browser-based visualizer for Flash Translation Layer (FTL)
internals — address mapping, garbage collection, and wear leveling — built
on top of [MQSim](https://github.com/CMU-SAFARI/MQSim), a real SSD/FTL
simulator, compiled to WebAssembly.

Unlike a from-scratch reimplementation, the simulation engine here is
MQSim's actual C++ source (vendored under `engine/mqsim`, MIT-licensed),
compiled with Emscripten and instrumented with hooks that report internal
FTL state changes to the UI in real time. The goal is to make FTL concepts
(page-level mapping, GC victim selection, dynamic/static wear leveling)
visible and explorable, not just simulated.

Full development plan and write-ups (in Korean) live at
[jonghoon-ryu.github.io/ftl-visual-simulator](https://jonghoon-ryu.github.io/ftl-visual-simulator/).
Live app: [ftl-visual-simulator-app on GitHub Pages](https://jonghoon-ryu.github.io/ftl-visual-simulator-app/).

## Status

All three concept presets run on the real WASM engine end-to-end:

- **매핑 기본 (mapping basics)** and **GC 시연 (GC demo)** — real playback,
  live mapping table, flash block/page grid, event log, and stats (WAF,
  valid-page ratio, GC/WL execution counts, erase count), all reconfigurable
  via interactive parameter (page/block/OP/GC-threshold/mapping-method) and
  workload (access pattern/read ratio/burst size) controls.
- **마모평준화 시연 (wear-leveling demo)** — real per-block erase-count view,
  wired to the real engine after fixing a genuine upstream bug: MQSim's
  `SSD_Device.cpp` never actually passed the wear-leveling config fields
  through to the GC/WL unit, so `Static_Wearleveling_Threshold` was
  silently ignored no matter what `ssdconfig.xml` said. With that fixed,
  static wear-leveling triggers exactly once per run at this preset's demo
  scale (see the [reference docs](https://jonghoon-ryu.github.io/ftl-visual-simulator/reference/)
  for why it doesn't repeat, and why that's an honest limit rather than a
  bug).

## How it works

1. **Engine**: `engine/mqsim/src` is MQSim's C++ source with a small
   library-style interface (`MQSim_Interface.cpp`) added on top of it,
   plus Emscripten bindings (`src/wasm/bindings.cpp`) exposing
   `init`/`configure`/`step`/`run`/`getState`/`setEventCallback` to
   JavaScript. `engine/build-wasm.sh` compiles it to
   `src/wasm-build/mqsim.{mjs,wasm}` (gitignored — rebuilt from source, see
   `.github/workflows/deploy.yml`).
2. **Worker**: the compiled module runs inside a dedicated Web Worker
   (`src/workers/mqsim.worker.ts`), so a long `run()` call never blocks the
   UI thread. `src/hooks/useMqsimEngine.ts` is a small promise-based RPC
   client for it.
3. **Config as XML, in memory**: parameter/workload panels don't reach into
   the engine directly — they generate `ssdconfig.xml`/`workload.xml` text
   (`src/data/mqsimConfigs.ts`), which gets written into the WASM module's
   in-memory filesystem and parsed by MQSim's own (unmodified) XML config
   reader, the same as the original CLI would read files from disk.
4. **Hooks → events**: real engine events (mapping updates, GC/WL
   start/migrate/erase, dynamic-WL block rotation) are forwarded from C++
   to JS via a single registered callback and fanned out to whichever
   hooks/components subscribed (`src/hooks/useMqsimEvents.ts`).
5. **Golden regression tests**: `npm run test:engine` builds a native (non-
   WASM) CLI from the same `engine/mqsim/src` and diffs its output against
   committed golden result files — a way to check that instrumentation
   changes (hooks, `getState()`) never alter what MQSim actually simulates.
6. **GMock/GTest unit tests**: `npm run test:engine:unit` (`engine/tests/unit/`)
   isolates individual engine modules behind hand-written fakes/mocks of
   their collaborators, so a specific condition (an erase-count spread, a
   GC/WL threshold) can be checked deterministically in milliseconds instead
   of running a real workload for millions of event-groups hoping to
   stumble into it naturally — see the
   [wear-leveling integration doc](https://jonghoon-ryu.github.io/ftl-visual-simulator/plan/wear-leveling-integration/)
   for the investigation that motivated writing these.

Several real, pre-existing MQSim bugs (a use-after-free in the DRAM cache
teardown path, an uninitialized-field divide-by-zero, two static
wear-leveling logic bugs, and a dropped-config-parameter bug that made
`Static_Wearleveling_Threshold` unconfigurable) were found and fixed along
the way — see the
[reference docs](https://jonghoon-ryu.github.io/ftl-visual-simulator/reference/)
for the investigation write-ups.

## Stack

- Vite + React + TypeScript (UI)
- MQSim C++ compiled to WebAssembly via Emscripten (engine, `engine/mqsim`)
- GitHub Pages (deploy target, auto-built on every push to `main`)

## Development

```bash
npm install
npm run dev            # dev server (needs src/wasm-build/ already built - see below)
npm run build           # typecheck + production build
npm run lint            # oxlint
npm run test:engine     # native golden regression tests for engine/mqsim
npm run test:engine:unit # GMock/GTest unit tests for engine/mqsim (needs network on first run)
```

Building the WASM module requires an active [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html)
on `PATH` (`source /path/to/emsdk/emsdk_env.sh`), then:

```bash
bash engine/build-wasm.sh
```

`src/wasm-build/` is gitignored — CI rebuilds it from `engine/mqsim/src` on
every deploy, so there's never a stale prebuilt binary to fall out of sync
with the source.
