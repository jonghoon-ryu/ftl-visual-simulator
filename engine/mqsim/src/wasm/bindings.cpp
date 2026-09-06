#include <emscripten/bind.h>
#include <fstream>
#include <string>
#include "../exec/MQSim_Interface.h"
#include "../exec/Simulation_Events.h"

using namespace emscripten;

namespace
{
	// A single active simulation at a time - matches how the WASM module is
	// actually used (one browser tab, one running scenario). configure()
	// tears this down and rebuilds it from new config/workload text.
	MQSim_Interface::Workload_Set* g_workload = nullptr;
	MQSim_Interface::Simulation_Instance* g_instance = nullptr;

	// JS callback registered via set_event_callback(), forwarded simulation
	// events as they happen. Undefined until JS registers one.
	val g_event_callback = val::undefined();

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

	// Simulation_Events::On_mapping_updated target - the only place in this
	// file that knows about Simulation_Events's event struct shape. Converts
	// it to a plain JS object and forwards to whatever JS registered.
	void forward_mapping_updated(const Simulation_Events::Mapping_Updated_Event& event)
	{
		if (g_event_callback.isUndefined() || g_event_callback.isNull()) {
			return;
		}
		val payload = val::object();
		payload.set("type", std::string("mapping_updated"));
		payload.set("streamId", event.Stream_id);
		payload.set("lpa", event.Lpa);
		payload.set("ppa", event.Ppa);
		payload.set("isWrite", event.Is_write);
		g_event_callback(payload);
	}
}

// Writes the given config/workload XML text into MEMFS at the paths MQSim's
// existing file-based parsing code expects, then loads and initializes
// scenario 1 - the WASM UI only ever drives one scenario at a time, unlike
// the CLI's "run every scenario in the file" batch mode.
void init(const std::string& ssd_config_xml, const std::string& workload_xml)
{
	// Wired here (not just once at module load) so it survives configure()
	// tearing down and rebuilding g_instance - the function pointer itself
	// is process-wide state, unaffected by teardown_current(), but setting
	// it unconditionally on every init() keeps this the one place that
	// "arms" event delivery, no matter which entry point triggered it.
	Simulation_Events::On_mapping_updated = forward_mapping_updated;

	teardown_current();

	write_memfs_file("/ssdconfig.xml", ssd_config_xml);
	write_memfs_file("/workload.xml", workload_xml);

	g_workload = MQSim_Interface::Load_workload("/ssdconfig.xml", "/workload.xml");
	g_instance = MQSim_Interface::Initialize_scenario(g_workload, 1);
}

// Registers the JS function that receives simulation events (currently just
// mapping-update notifications - see forward_mapping_updated()) as they
// happen during step()/run(). Pass undefined/null to stop receiving events.
void set_event_callback(val callback)
{
	g_event_callback = callback;
}

// Point-in-time simulator state for the UI to render, e.g. after step()/
// run() or on a timer. Currently just the mapping table; block/page grid
// state will be added here once the GC/block-manager hooks land.
val get_state()
{
	val mapping = val::array();
	if (g_instance) {
		auto snapshot = MQSim_Interface::Get_mapping_table_snapshot(g_instance, 0);
		for (const auto& entry : snapshot) {
			val row = val::object();
			row.set("lpa", entry.Lpa);
			row.set("ppa", entry.Mapped ? val(entry.Ppa) : val::null());
			row.set("mapped", entry.Mapped);
			mapping.call<void>("push", row);
		}
	}

	val state = val::object();
	state.set("mapping", mapping);
	return state;
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
	function("setEventCallback", &set_event_callback);
	function("getState", &get_state);
}
