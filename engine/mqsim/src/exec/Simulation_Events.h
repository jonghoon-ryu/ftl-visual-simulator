#ifndef SIMULATION_EVENTS_H
#define SIMULATION_EVENTS_H

#include "../ssd/SSD_Defs.h"
#include "../nvm_chip/flash_memory/Physical_Page_Address.h"

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

	// A GC execution has just started on a victim block (PageID is not
	// meaningful here - the event is about the whole block). Fired from both
	// places GC_and_WL_Unit increments Stats::Total_gc_executions: the
	// immediate path (GC_and_WL_Unit_Page_Level::Check_gc_required) and the
	// "was blocked on an in-flight request, now clear to run" deferred path
	// (GC_and_WL_Unit_Base::handle_transaction_serviced_signal_from_PHY).
	//
	// Accuracy note: that deferred path is shared with static wear-leveling
	// (run_static_wearleveling() also parks a block the same way when it
	// can't run immediately) and MQSim itself does not track which of the
	// two triggered a given deferred execution - Stats::Total_gc_executions
	// gets incremented there unconditionally, regardless of which one
	// started it. This hook matches that same ground truth (that is what
	// makes "hook count == Stats::Total_gc_executions" a valid check at
	// all), so a small, rare fraction of "gc_started" events may actually be
	// a deferred static-WL erase. Revisit if Session 6's WL hooks need exact
	// attribution - a trigger-reason tag would need adding on the block/
	// transaction at the point it was first parked.
	struct GC_Started_Event
	{
		stream_id_type Stream_id;
		NVM::FlashMemory::Physical_Page_Address Block_address;
	};

	extern void (*On_gc_started)(const GC_Started_Event&);

	inline void Notify_gc_started(stream_id_type stream_id, const NVM::FlashMemory::Physical_Page_Address& block_address)
	{
		if (On_gc_started) {
			GC_Started_Event event{ stream_id, block_address };
			On_gc_started(event);
		}
	}

	// One valid page is being copied out of a GC victim block, fired once
	// per page right when the copy is submitted (mirrors the
	// Stats::Total_page_movements_for_gc++ call sites).
	struct GC_Page_Migrated_Event
	{
		stream_id_type Stream_id;
		NVM::FlashMemory::Physical_Page_Address Page_address;
	};

	extern void (*On_gc_page_migrated)(const GC_Page_Migrated_Event&);

	inline void Notify_gc_page_migrated(stream_id_type stream_id, const NVM::FlashMemory::Physical_Page_Address& page_address)
	{
		if (On_gc_page_migrated) {
			GC_Page_Migrated_Event event{ stream_id, page_address };
			On_gc_page_migrated(event);
		}
	}

	// A block's erase has physically completed and it is about to be
	// returned to the free pool. Fired from the one place in the engine an
	// erase transaction is ever serviced (Transaction_Type::ERASE in
	// GC_and_WL_Unit_Base::handle_transaction_serviced_signal_from_PHY) -
	// same GC/WL attribution caveat as GC_Started_Event above applies here.
	struct GC_Block_Erased_Event
	{
		NVM::FlashMemory::Physical_Page_Address Block_address;
	};

	extern void (*On_gc_block_erased)(const GC_Block_Erased_Event&);

	inline void Notify_gc_block_erased(const NVM::FlashMemory::Physical_Page_Address& block_address)
	{
		if (On_gc_block_erased) {
			GC_Block_Erased_Event event{ block_address };
			On_gc_block_erased(event);
		}
	}
}

#endif // !SIMULATION_EVENTS_H
