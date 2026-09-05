# WASM-vs-native parity debugging log (RESOLVED, 2026-09-05)

**Goal**: MQSim compiled to WASM (Emscripten) must produce identical simulation
results to the native g++ build for the same config/workload input. This is
the core fidelity premise of the whole project (real MQSim engine, not a
reimplementation) - see the blog's `reference/wasm-primer` doc for why this
matters.

**Status: RESOLVED.** Four real bugs found and fixed (see below), all
uncommitted as of this writing - check `git status`/`git diff` in
`ftl-visual-simulator` before assuming otherwise. After all four fixes:

**Follow-up full verification pass (after the initial fix)**: re-tested with
`-sMAXIMUM_MEMORY=4GB` (WASM32's actual ceiling, vs. the 2GB tried during
initial debugging) and a 4th scenario added to `workload.xml` using the
previously-untested `traces/wsrch-small.trace` (24783 requests, larger than
the tpcc trace). Result: **all 4 scenarios' full result XML files are
MD5-identical between native and WASM** - not just summary request counts,
every single stat/counter in the output:

```
scenario 1 (synthetic, small):  ab61421c2b7cb0ad4a3fb3f54fcba9f3  (both)
scenario 2 (synthetic, large):  b3f7aae10f79a49ea436af2eba82226b  (both)
scenario 3 (trace, tpcc):       9ec3245c50e6b505f035d524cabaf060  (both -
                                 also matches the ORIGINAL pre-bug-hunt
                                 native baseline exactly, confirming this
                                 trace-only scenario never regressed through
                                 any of the 4 fixes)
scenario 4 (trace, wsrch, new): f8d9e6fb6b1d50fb93e5c5d3bb77b1e7  (both)
```

Scenario 2's earlier `std::bad_alloc` (see below) was purely a memory-limit
artifact of the *test harness's* `-sMAXIMUM_MEMORY` flag being set too low
(2GB) during initial debugging, not a real blocker - raising it to WASM32's
actual 4GB ceiling let it complete and match natively.

**Second follow-up: MQSim's own official FAST'18 paper-reproduction test
suite** (`fast18/` in the upstream `/home/ryuj/Ryu/MQSim` clone - not
something this project created, it's CMU-SAFARI's own historical experiment
inputs). Covers configs this project's sample `ssdconfig.xml`/`workload.xml`
never exercised, including `Ideal_Mapping_Table=true` (a different code path
that bypasses the CMT-miss/`ArrivingMappingEntries` logic entirely, since
`handle_transaction_serviced_signal_from_PHY` early-returns via
`if (_my_instance->ideal_mapping_table) throw ...` for that mode - good
negative-coverage: confirms the fix doesn't disturb a path that never hit
the bug in the first place). Result: **64 additional scenario-level
native-vs-WASM comparisons, every one byte-for-byte identical**:

- `backend-contention/workload-backend-contention-flow-2.xml`: 8/8 scenarios identical
- `backend-contention/workload-backend-contention-flow-1-flow-2.xml`: 8/8 identical
- `queue-fetch-size` (both `=16` and `=1024` config variants) x 3 workload
  files x 6 scenarios each: 36/36 identical
- `data-cache-contention/workload-datacache-contention-flow-1.xml`: 6/6 identical
- `data-cache-contention/workload-datacache-contention-flow-2.xml`: 6/6 identical

Two things found along the way that are **pre-existing bugs unrelated to
this investigation**, noted here so they aren't mistaken for a regression
later:

1. `fast18/backend-contention/workload-backend-contention-flow-1.xml` in the
   **upstream MQSim repo** has an unresolved git merge conflict committed
   directly into the file (literal `<<<<<<< HEAD` markers plus a malformed
   `<Generated_Aligned_Addresses>true</<Generated_Aligned_Addresses>` tag) -
   fails to parse on any build. A pre-existing data-corruption issue in
   CMU-SAFARI's own repo, not something introduced here.
2. `fast18/data-cache-contention/workload-datacache-contention-flow-1-flow-2.xml`
   scenario 3 (`Working_Set_Percentage=1`, `Address_Distribution=RANDOM_HOTCOLD`,
   `Percentage_of_Hot_Region=1`) crashes with `SIGFPE` (floating point
   exception, almost certainly divide-by-zero from the hot-region size
   rounding to 0 addresses at these unusually small percentages) - **on
   native.** Confirmed this is not caused by any of the 4 fixes here: it
   crashes identically, at the identical point, when built from the
   completely untouched, unmodified `/home/ryuj/Ryu/MQSim` clone. A separate,
   pre-existing bug in MQSim's `RANDOM_HOTCOLD` address generator, out of
   scope for this investigation - flagging in case it's worth its own bug
   hunt later, but not chased further here.

**The root cause (bug #4 below) was found by**: adding print instrumentation
at the exact completion point for one specific "lost" transaction, then
walking backward through the pipeline (dispatch -> CMT-miss mapping-read
creation -> mapping-read completion -> the completion *handler* that's
supposed to resubmit the pending write) until native and WASM's behavior
first diverged. That point was `std::multimap::find()` returning a
different (but standard-legal) element when duplicate keys exist. See
"Completion-sequence diffing" and the later pointer-tagged tracing technique
below for the reusable method - it found the bug in a handful of rebuild
cycles once applied, after many hours of broader hypothesis-testing (RNG,
destructors, container ordering in general, stack size, `long double`, etc.)
had failed to find it.

<div style="margin-top:20px"></div>

## How this was discovered

Building the embind bindings (`engine/mqsim/src/wasm/bindings.cpp`,
`engine/build-wasm.sh` - both already committed on `main`) for
init()/step()/run()/configure(), I verified them by running the sample
scenario through Node and diffing against native output. Scenario 1
(synthetic) looked plausible in isolation, but a direct native-vs-WASM diff
(not done before this point - earlier "verification" only ever compared two
different WASM runs against each other) showed native and WASM disagree
substantially. Scenario 3 (trace-based, `traces/tpcc-small.trace`) is the
cleanest reproduction: request **generation** is identical (6999/6999, byte-
for-byte since it's just replaying a file), but WASM only **services**
2418/6999 before the event queue goes completely empty - native services all
6999. Use scenario 3 for all further debugging; it has no RNG dependency, so
it's a strictly smaller search space than the synthetic scenarios.

<div style="margin-top:20px"></div>

## Current working-tree state (uncommitted, in `/home/ryuj/Ryu/ftl-visual-simulator`)

Run `git status --short` and `git diff` to check this is still accurate.
As of writing:

```
 M .gitignore
 M engine/mqsim/src/host/IO_Flow_Base.h
 M engine/mqsim/src/host/IO_Flow_Synthetic.h
 M engine/mqsim/src/ssd/GC_and_WL_Unit_Base.h
 M engine/mqsim/src/ssd/NVM_Channel_Base.h
 M engine/mqsim/src/ssd/NVM_Firmware.h
 M engine/mqsim/src/ssd/NVM_PHY_Base.h
 M engine/mqsim/src/ssd/NVM_Transaction.h
 M engine/mqsim/src/utils/CMRRandomGenerator.h
?? engine/build-wasm.sh          <- already committed on main actually, check
?? engine/mqsim/src/wasm/        <- already committed on main actually, check
```

(The `??` entries may just mean this working tree has them untracked for a
reason unrelated to this investigation - check `git log -- engine/build-wasm.sh`
before assuming. The three real fixes are all in the `M` files.)

None of the three fixes below have been committed yet. **Do not lose this
diff** - if you need to `git stash`/`git checkout` for any reason, stash first
(`git stash push` includes untracked with `-u`).

<div style="margin-top:20px"></div>

## Three confirmed, fixed bugs (all pre-existing in original MQSim, not introduced by the earlier main.cpp library refactor / PR #1)

### 1. Signed integer overflow (UB) in the RNG

**File**: `engine/mqsim/src/utils/CMRRandomGenerator.h`, functions `mv_mul`
and `mm_mul` (~line 89-115).

**Bug**: matrix-multiply-mod arithmetic used `int64_t` accumulation, but
factors are close to the MRG32k3a moduli (`m1=4294967087`, `m2=4294944443`,
both ≈2^32), so products can reach ~1.84e19 - overflowing signed int64_t
(max ~9.22e18). Confirmed via UBSan on native:
```
CMRRandomGenerator.h:109:27: runtime error: signed integer overflow:
4294156359 * 4294156359 cannot be represented in type 'long int'
```
This RNG (`Utils::RandomGenerator` / `Utils::CMRRandomGenerator`) is
constructed inside `FTL::FTL(...)` - it's a general-purpose engine RNG, not
just the workload generator's RNG.

**Fix applied**: changed both functions' accumulator to `uint64_t` (cast each
operand to `uint64_t` before multiplying, reduce mod `(uint64_t)m` each step,
cast back to `int64_t` for storage). `(m-1)^2` fits safely in uint64_t
(~1.844e19 < UINT64_MAX ~1.8447e19), so this is mathematically exact, not a
workaround - it just removes the UB, giving a platform-independent result
where before the actual wraparound result was compiler/platform-dependent.

**Verified impact**: changed WASM's synthetic-scenario numbers (previously
140103/17514 requests -> 150804/18852 after this fix alone) - confirms this
RNG bug was real and affected WASM. Did NOT fully close the gap to native's
329898/41238 for the same scenario. **Confirmed via direct instrumentation
that this RNG is NEVER CALLED AT ALL during the trace-based scenario 3** (see
"RNG instrumentation" below) - so this bug is entirely unrelated to
scenario 3's divergence. It's real and worth keeping, but it's not "the" bug
for scenario 3.

<div style="margin-top:20px"></div>

### 2. Missing virtual destructors (polymorphic delete through non-virtual base, UB)

Confirmed via ASan (`new-delete-type-mismatch`, then an actual SEGV after
fixing the first one - fixing each one serially uncovered the next, since
previously the derived destructor NEVER ran at all, so bugs inside those
derived destructors were dormant/never-exercised code).

Fixed by adding `virtual` to the destructor (or adding one where missing):

- `engine/mqsim/src/ssd/NVM_Transaction.h` - `NVM_Transaction` had no
  destructor declared at all; added `virtual ~NVM_Transaction() {}`. Deleted
  polymorphically in `NVM_PHY_ONFI::broadcastTransactionServicedSignal`
  (`ssd/NVM_PHY_ONFI.cpp:22`, `delete transaction;` where the actual object
  is `NVM_Transaction_Flash_RD/WR/ER`).
- `engine/mqsim/src/ssd/NVM_PHY_Base.h` - had `~NVM_PHY_Base();`, added
  `virtual`.
- `engine/mqsim/src/host/IO_Flow_Base.h` - had `~IO_Flow_Base();`, added
  `virtual`. (Host_System.cpp:98 deletes through this base pointer.)
- `engine/mqsim/src/ssd/GC_and_WL_Unit_Base.h` - no destructor declared;
  added `virtual ~GC_and_WL_Unit_Base() {}`.
- `engine/mqsim/src/ssd/NVM_Firmware.h` - no destructor declared; added
  `virtual ~NVM_Firmware() {}`.
- `engine/mqsim/src/ssd/NVM_Channel_Base.h` - was `class NVM_Channel_Base
  {};` (literally empty, sizeof==1); changed to
  `class NVM_Channel_Base { public: virtual ~NVM_Channel_Base() {} };`.
  Deleted polymorphically in `SSD_Device::~SSD_Device()`
  (`exec/SSD_Device.cpp:383`, actual objects are `ONFI_Channel_NVDDR2` via
  `ONFI_Channel_Base`).

**Verified impact**: after all 6 fixes, native runs the full 3-scenario
workload through combined `-fsanitize=undefined,address` with **zero**
errors (previously aborted partway through cleanup). Did NOT change WASM's
computed simulation numbers at all (makes sense in hindsight - these deletes
only run at scenario teardown, after all the numbers are already computed;
they don't affect the running simulation). Worth keeping regardless - it's
real, ASan-confirmed UB - but not the cause of the remaining WASM divergence.

<div style="margin-top:20px"></div>

### 3. Uninitialized `RandomGenerator*` members in `IO_Flow_Synthetic`

**File**: `engine/mqsim/src/host/IO_Flow_Synthetic.h`.

**Bug**: `random_hot_address_generator`, `random_hot_cold_generator`,
`random_request_size_generator`, `random_time_interval_generator` are only
conditionally `new`'d in the constructor (`IO_Flow_Synthetic.cpp` ~line
39-55), but the destructor (`~IO_Flow_Synthetic()`, line ~63) unconditionally
`delete`s all 6 generator pointers. This crashed (SEGV) once bug #2's fix
made this destructor actually run for the first time.

**Fix applied**: added `= nullptr` in-class initializers to all 6
`Utils::RandomGenerator*` members in the header, so `delete nullptr` (a
guaranteed no-op) happens instead of deleting garbage when the conditional
`new` never ran.

**Verified impact**: needed for bug #2's fix to not crash; not independently
tested against WASM numbers, but same reasoning as #2 applies (teardown-only,
shouldn't affect computed results).

<div style="margin-top:20px"></div>

### 4. `std::multimap::find()` assumed to return the first of an equal-key group (it doesn't have to) - THE ROOT CAUSE

**File**: `engine/mqsim/src/ssd/Address_Mapping_Unit_Page_Level.cpp`,
`handle_transaction_serviced_signal_from_PHY` (~line 1665), and the same
pattern nearby for `Waiting_unmapped_read_transactions`/
`Waiting_unmapped_program_transactions`.

**Bug**: `ArrivingMappingEntries` is a `std::multimap<MVPN_type, LPA_type>`.
When a mapping-page read completes, the handler does:
```cpp
auto it = ArrivingMappingEntries.find(mvpn);
while (it != ArrivingMappingEntries.end()) {
    if (it->first == mvpn) { /* process it->second */ }
    else break;
    it = ArrivingMappingEntries.erase(it); // (was erase(it++) originally)
}
```
This assumes `find()` returns the *first* of a group of equal-key elements,
so a forward-only walk visits every element in that group before hitting a
different key. **The C++ standard does not guarantee this** - cppreference
on `multimap::find`: "If there are several elements with key in the
container, any of them may be returned." libstdc++ (native GCC) happens to
always return the first of the equal-range in practice; libc++
(Emscripten/clang) does not always - confirmed empirically (see tracing
below), not just reasoned about. When two writes map to the same MVPN (e.g.
two adjacent LPAs both needing the same mapping page), `find()` under WASM
sometimes returned the *second*-inserted one, and the forward-only walk then
permanently skipped the first one - it stays in `ArrivingMappingEntries`
forever, its write transaction never gets resubmitted to TSU, and its
reserved CMT slot is never freed. This accumulates over the run (each
occurrence is a small, isolated "lost" transaction) until enough CMT slots
are permanently pinned that the whole pipeline seizes up and the event queue
goes genuinely empty - explaining every observed symptom: divergence from
almost the first few completions, isolated "missing" transactions (verified
by grepping their LPA across the *entire* WASM completions log - genuinely
never completed, not just delayed), and eventual total stall despite
simulated time reaching ~97% of native's.

**How this was found** - pointer-tagged tracing (build on the completion-log
technique below): picked one specific "lost" transaction (a WRITE, LPA
14401310, confirmed via `grep -c "lpa=14401310"` to appear exactly once in
native's ~20000-line completion log and zero times in WASM's full log), then
added prints at each stage of its lifecycle, tagging each transaction by
pointer address so entries could be matched across stages even when the LPA
field itself is repurposed (mapping-read transactions store the MVPN in the
`LPA` field, not a real LPA):
1. `Translate_lpa_to_ppa_and_dispatch` entry (LPA, type, time) - identical on
   both platforms.
2. `Physical_address_determined` at dispatch time - identical (both `false`,
   i.e. CMT miss).
3. `generate_flash_read_request_for_mapping_data` - logs `(orig_lpn, mvpn,
   ptr)` of the mapping-read transaction created to resolve the miss -
   identical on both platforms (same mvpn, same time).
4. The mapping-read's own completion (matched by `ptr`) - **identical time on
   both platforms** (939089391) - ruling out the mapping-read itself.
5. `handle_transaction_serviced_signal_from_PHY`'s per-LPA processing inside
   its while-loop - **this is where they diverged**: native logged
   `DIAGHANDLERLPA ... lpa=14401310` then `lpa=14401311`; WASM logged only
   `lpa=14401311`, skipping 14401310's iteration of the loop entirely, even
   though 14401310 was confirmed present in `ArrivingMappingEntries`
   (inserted at the same time as 14401311, same key).

**Fix applied**: replaced all three `find()` + manual-while-loop-with-
`erase(it++)` patterns with `equal_range()` + a `for` loop using `erase()`'s
return value - the standard-guaranteed portable way to visit every element
in an equal-key group regardless of which specific element a bare `find()`
happens to return.

**Verified impact**: scenario 1 now byte-identical between native and WASM
(329898/41238 both). Scenario 3 now fully serviced on both (6999/6999 both,
previously WASM stalled at 2418/6999). This was the fix - confirmed via
before/after A-B testing of this single change with everything else held
constant.

<div style="margin-top:20px"></div>

## Resolved non-issue: scenario 2's `std::bad_alloc`

Scenario 2 (the largest synthetic scenario in the sample workload) initially
threw `std::bad_alloc` under WASM partway through when built with
`-sMAXIMUM_MEMORY=2GB`, confirmed via a caught C++ exception (built with
`-fexceptions`, caught in a C++ try/catch around the `run()` binding,
printed via `e.what()` - not guessed from a generic "Aborted()"). This was
genuine WASM linear-memory exhaustion, not a logic bug -
`AddressMappingDomain`'s constructor was separately observed via
Emscripten's ASan requesting ~1.5GB for one array. **Resolved** by rebuilding
with `-sMAXIMUM_MEMORY=4GB` (WASM32's actual hard ceiling) - scenario 2 then
completes and matches native exactly (see the follow-up verification pass
above). Worth remembering for the real build script/binding: use a memory
ceiling close to WASM32's actual 4GB limit rather than an arbitrarily small
one, since large-occupancy configs can legitimately need close to 2GB.

<div style="margin-top:20px"></div>

## Superseded: earlier "what's still unresolved" section

(Kept below for the reasoning trail and reusable diagnostic techniques, but
the divergence it describes is now fixed by bug #4 above.)

**Scenario 1/2 (synthetic, RNG-dependent)**: WASM numbers moved after fix #1
but still don't match native (WASM 150804/18852 vs native 329898/41238 for
scenario 1, roughly similar ratio gap for scenario 2). Not yet investigated
further after fix #1 - could be a second RNG-adjacent issue, or could share
scenario 3's root cause. Untested since scenario 3 debugging took priority
(cleaner, RNG-free reproduction).

**Scenario 3 (trace-based) - the priority case**: WASM still services only
2418/6999 requests, completely unchanged by any of fixes #1/#2/#3. Native's
final `Simulator->Time()` reaches 1,110,261,323; WASM's reaches 1,075,002,008
(~97% of native's) - so WASM isn't stopping drastically early in simulated
time, it's failing to schedule/complete a large fraction of the work within
that time.

**Ruled out for scenario 3** (each empirically tested, not just reasoned
about):
- MEMFS config not loading (no "file not found, using defaults" messages
  appear - config parses correctly)
- `main.cpp`'s own `main()` auto-invoking on WASM module load and corrupting
  global state (tested with `main.cpp` fully excluded from the WASM build -
  no change to the 2418 number)
- Stack size too small (tested up to `-sSTACK_SIZE=128MB` with
  `-sINITIAL_MEMORY=512MB` - no change)
- `long double` usage anywhere in the codebase (`grep -rl "long double"` -
  zero matches)
- `Engine::_ObjectList`'s `unordered_map` iteration order (empirically
  swapped to `std::map` in a scratch copy - changed NATIVE's own numbers
  very slightly, ~0.08%, confirming order-sensitivity is real but far too
  small to explain scenario 3's 65% shortfall; scenario 3 itself was
  unaffected by this swap - stayed at 6999/6999 fully serviced natively
  either way)
- Every other `unordered_map` iteration site found via systematic grep
  across `ssd/` and `host/` (`Address_Mapping_Unit_Page_Level`'s `addressMap`
  CMT, `Data_Cache_Flash`'s `slots`, `IO_Flow_Base`'s
  `nvme_software_request_queue`, `Queue_Probe`'s `currentObjectsInQueue`) -
  every actual `for(:...)` iteration over these is destructor-only cleanup
  (order-independent); all point lookups elsewhere use `.find()`/`[]`
  (order-independent) or an explicit ordered side-structure (`lru_list`,
  `std::set<uint16_t> available_command_ids`) for anything order-sensitive.
  **This was the single most time-consuming ruled-out hypothesis - don't
  re-check individual `unordered_map`s again without a new reason to suspect
  one specifically.**
- The RNG fix (#1) itself - confirmed via direct instrumentation (see below)
  that `CMRRandomGenerator::NextDouble()` is never called at all during
  scenario 3.

**RNG instrumentation technique** (useful pattern, reusable): added a global
`void diag_rng_call(long call_no, double result)` function (defined in
`MQSim_Interface.cpp`, forward-declared and called from
`CMRRandomGenerator::NextDouble()` via `::diag_rng_call(++call_no, result)`
with a function-local `static long call_no`), printing the first N calls.
Zero output for scenario 3 on native - RNG genuinely never invoked for this
scenario. This same "add a diag_xxx free function, forward-declare it with
`::` qualification, call it from deep inside the class you're
instrumenting" pattern is a fast way to add one-off print instrumentation
without fighting namespace/header issues - reuse it for the next round of
instrumentation instead of re-deriving it.

**Completion-sequence diffing technique** (useful pattern, already
performed once): added a print in
`NVM_PHY_ONFI::broadcastTransactionServicedSignal` (`ssd/NVM_PHY_ONFI.cpp`,
right before the `for` loop that broadcasts the signal):
```cpp
std::cout << "DIAGCOMPLETE t=" << Simulator->Time() << " type=" << (int)transaction->Type << " lpa=" << transaction->LPA << std::endl;
```
(needs `#include <iostream>` added to the top of that .cpp). Ran both native
and WASM (via the debug bindings, see below) against the trace-only
scenario, grepped `DIAGCOMPLETE` lines to a file each, and diffed. **Finding**:
divergence starts almost immediately (~line 14-30 out of ~20000 total
completions in native) - not a gradual drift. Some entries are simply
missing from WASM's sequence at a given position; others are present but
with a *different* LPA at a similar-but-not-identical time (a genuine
different completion, not just reordering of the same set). This suggests a
real computational/scheduling difference, not merely hash-map iteration
order (which would produce reordering of the *same* set of entries, not
different entries). **Not yet followed up further** - the natural next step
is to keep this instrumentation and narrow down *which* subsystem
(mapping/GC/WL/TSU/cache) first produces a different decision, by adding
similar diagnostic prints at each subsystem's key decision points and
narrowing where native and WASM first disagree.

<div style="margin-top:20px"></div>

## Planned next step (not yet started as of this writing)

Subsystem bisection: since we know completions start diverging almost
immediately, add targeted diagnostic prints (same technique as above) at
the entry points of each major FTL subsystem in the request-processing path
for a *write* (the scenario 3 trace is presumably read+write mixed) - roughly:
`Address_Mapping_Unit_Page_Level::Translate_lpa_to_ppa_and_dispatch` ->
`query_cmt`/`request_mapping_entry` (mapping) -> `TSU_*::Execute_simulator_event`
(scheduling) -> `GC_and_WL_Unit_Page_Level::Check_gc_required` (GC/WL) ->
`NVM_PHY_ONFI` (physical completion, already instrumented). Find the
*earliest* point in this chain where native and WASM disagree on a decision
for the *same* logical request (matched by LPA), rather than diffing only
the final completions.

Also worth trying, cheaper than full bisection: rebuild the native binary at
`-O0` (matching WASM's typical unoptimized-during-debug state, though the
committed build script uses `-O2` for WASM too - so should compare -O2 vs
-O2, and separately try -O0 vs -O0, to see if optimization level itself
changes native's own output at all; if -O0 native differs from -O2 native,
that would point at compiler-optimization-dependent behavior, likely an
aliasing or uninitialized-read issue that differs by inlining decisions).

<div style="margin-top:20px"></div>

## Reference: build commands used throughout this investigation

Emscripten toolchain: `source /home/ryuj/Ryu/emsdk/emsdk_env.sh` before any
`em++`/`emcc` command (not on PATH otherwise).

**Native build** (from `engine/mqsim/`):
```bash
MODULES="exec host nvm_chip nvm_chip/flash_memory sim ssd utils"
INCLUDES=$(for m in $MODULES; do echo -n "-Isrc/$m "; done)
SRCS=$(find src -name "*.cpp" ! -path "*/wasm/*")   # exclude wasm bindings for native
g++ -std=c++17 -O2 -g $INCLUDES $SRCS -o MQSim
```

**Native + sanitizers** (much slower, use `-O0`, and use the
`workload_trace_only.xml` single-scenario file for scenario 3 to avoid
waiting through the slow synthetic scenarios):
```bash
g++ -std=c++17 -O0 -g -fsanitize=undefined,address -fno-sanitize-recover=all $INCLUDES $SRCS -o MQSim
UBSAN_OPTIONS=print_stacktrace=1 ASAN_OPTIONS=detect_leaks=0 ./MQSim -i ssdconfig.xml -w workload.xml < /dev/null
```

**WASM build** (the committed `engine/build-wasm.sh` builds the real
`wasm/bindings.cpp` with just init/step/run/configure; for debugging, a
richer debug bindings file was used instead - not committed, was iterated on
throughout at `/tmp/mqsim-bindings-verify/bindings_debug.cpp`, which adds a
`scenario_number` parameter to `init()` and a `debugWriteResults(path)` /
`FS`-readable-results function; also had to rename `run` to `runSteps` at
one point to avoid a symbol clash under `-fsanitize=address`):
```bash
INCLUDES=("-Isrc")
for m in exec host nvm_chip nvm_chip/flash_memory sim ssd utils; do INCLUDES+=("-Isrc/$m"); done
SRCS=$(find src -name "*.cpp" ! -path "*/wasm/*" ! -name "main.cpp")
em++ -std=c++17 -O2 "${INCLUDES[@]}" $SRCS <bindings.cpp> \
  -lembind -sSTACK_SIZE=8MB -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=128MB \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createMQSimModule -sENVIRONMENT=web,node \
  -sEXPORTED_RUNTIME_METHODS=FS \
  --embed-file <path-to>/traces@traces \
  -o mqsim.mjs
```
Run via a small Node ESM script that does
`const Module = await createMQSimModule(); Module.init(ssdConfigText, workloadText, scenarioNumber); ... Module.run(500) in a loop while it returns true ...`.

Single-scenario trace-only workload file (for fast iteration, skips the slow
synthetic scenarios 1/2): was created ad hoc at
`/tmp/mqsim-timediag/workload_trace_only.xml` - just the third
`<IO_Scenario>` block from the real `workload.xml`, wrapped in its own
`<MQSim_IO_Scenarios>`. Recreate if that scratch file is gone; the content is
in the "workload.xml scenario 3" quote earlier in this session, or just copy
the third `<IO_Scenario>` block out of `engine/mqsim/workload.xml`.

**All `/tmp/mqsim-*` scratch directories from this investigation are
disposable** - they were scratch build/test dirs, not referenced by anything
committed. Safe to delete if disk space is needed; regenerate via the
commands above if resuming debugging.
