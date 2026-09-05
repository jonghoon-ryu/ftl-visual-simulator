#include <emscripten/bind.h>
#include <fstream>
#include <string>
#include "../exec/MQSim_Interface.h"

using namespace emscripten;

namespace
{
	// A single active simulation at a time - matches how the WASM module is
	// actually used (one browser tab, one running scenario). configure()
	// tears this down and rebuilds it from new config/workload text.
	MQSim_Interface::Workload_Set* g_workload = nullptr;
	MQSim_Interface::Simulation_Instance* g_instance = nullptr;

	void write_memfs_file(const std::string& path, const std::string& text)
	{
		std::ofstream out(path.c_str());
		out << text;
	}

	void teardown_current()
	{
		if (g_instance) {
			MQSim_Interface::Finalize_scenario(g_instance);
			g_instance = nullptr;
		}
		if (g_workload) {
			MQSim_Interface::Unload_workload(g_workload);
			g_workload = nullptr;
		}
	}
}

// Writes the given config/workload XML text into MEMFS at the paths MQSim's
// existing file-based parsing code expects, then loads and initializes
// scenario 1 - the WASM UI only ever drives one scenario at a time, unlike
// the CLI's "run every scenario in the file" batch mode.
void init(const std::string& ssd_config_xml, const std::string& workload_xml)
{
	teardown_current();

	write_memfs_file("/ssdconfig.xml", ssd_config_xml);
	write_memfs_file("/workload.xml", workload_xml);

	g_workload = MQSim_Interface::Load_workload("/ssdconfig.xml", "/workload.xml");
	g_instance = MQSim_Interface::Initialize_scenario(g_workload, 1);
}

// Runs exactly one event-group; returns whether events remain.
bool step()
{
	return MQSim_Interface::Run_step(g_instance);
}

// Runs up to n event-groups, stopping early if the queue empties; returns
// whether events remain afterwards.
bool run(int n)
{
	bool has_more = true;
	for (int i = 0; i < n && has_more; i++) {
		has_more = MQSim_Interface::Run_step(g_instance);
	}
	return has_more;
}

// Re-initializes with new config/workload text, discarding the current run -
// same steps as init(), kept as a separate binding name to match the
// documented parameter-change/reset use case.
void configure(const std::string& ssd_config_xml, const std::string& workload_xml)
{
	init(ssd_config_xml, workload_xml);
}

EMSCRIPTEN_BINDINGS(mqsim_module)
{
	function("init", &init);
	function("step", &step);
	function("run", &run);
	function("configure", &configure);
}
