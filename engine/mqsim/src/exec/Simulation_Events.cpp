#include "Simulation_Events.h"

namespace Simulation_Events
{
	void (*On_mapping_updated)(const Mapping_Updated_Event&) = nullptr;
}
