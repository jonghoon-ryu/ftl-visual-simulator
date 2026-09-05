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

## Status

Early scaffold. The UI shell and static preset mockups (매핑 기본 / GC 시연 /
마모평준화 시연) are in place; the MQSim-to-WASM build and live engine
bindings are not wired up yet.

## Stack

- Vite + React + TypeScript (UI)
- MQSim C++ compiled to WebAssembly via Emscripten (engine, `engine/mqsim`)
- GitHub Pages (deploy target)

## Development

```bash
npm install
npm run dev
```
