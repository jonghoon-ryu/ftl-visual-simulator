#ifndef SIMULATION_EVENTS_H
#define SIMULATION_EVENTS_H

#include "../ssd/SSD_Defs.h"

// Build-agnostic event hooks that the SSD/FTL layer calls into when
// something a UI would want to see happens (e.g. a mapping-table update).
// Native builds (CLI, future GTest binaries) never assign a callback here,
// so Notify_*() calls are a no-op there and simulation behavior/output is
// unchanged. Only the WASM bindings layer (engine/mqsim/src/wasm) ever
// assigns these function pointers - this keeps Emscripten specifics out of
// the simulator code itself, matching how MQSim_Interface already isolates
// main.cpp's CLI concerns from the engine.
namespace Simulation_Events
{
	struct Mapping_Updated_Event
	{
		stream_id_type Stream_id;
		LPA_type Lpa;
		PPA_type Ppa;
		bool Is_write; // false: resolved for a read, true: newly written
	};

	extern void (*On_mapping_updated)(const Mapping_Updated_Event&);

	inline void Notify_mapping_updated(stream_id_type stream_id, LPA_type lpa, PPA_type ppa, bool is_write)
	{
		if (On_mapping_updated) {
			Mapping_Updated_Event event{ stream_id, lpa, ppa, is_write };
			On_mapping_updated(event);
		}
	}
}

#endif // !SIMULATION_EVENTS_H
