# MQSim (vendored)

This directory contains a copy of [MQSim](https://github.com/CMU-SAFARI/MQSim)
by the SAFARI Research Group at ETH Zurich, licensed under the MIT License
(see `LICENSE`).

It is used here as the simulation engine for the FTL Visual Simulator,
compiled to WebAssembly via Emscripten. The source has been (or will be)
modified from upstream to:

- refactor the CLI entry point (`main.cpp`) into a callable library
- add instrumentation hooks in the FTL classes (address mapping, block
  management, GC/wear-leveling) so the WASM module can report internal
  state changes to JavaScript for visualization

This is a derivative use for a specific project, not a fork intended to
track or contribute back to upstream. See the upstream repository for the
original, unmodified source.

Vendored from upstream commit `51f0f2d3fed92d88ef4a0fa61a38024b07bf9d16`.
