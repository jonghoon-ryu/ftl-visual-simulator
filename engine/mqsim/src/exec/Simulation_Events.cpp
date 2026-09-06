#include "Simulation_Events.h"

namespace Simulation_Events
{
	void (*On_mapping_updated)(const Mapping_Updated_Event&) = nullptr;
	void (*On_gc_started)(const GC_Started_Event&) = nullptr;
	void (*On_gc_page_migrated)(const GC_Page_Migrated_Event&) = nullptr;
	void (*On_gc_block_erased)(const GC_Block_Erased_Event&) = nullptr;
}
