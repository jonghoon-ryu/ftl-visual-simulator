#include <iostream>
#include <ctime>
#include <string>
#include <cstring>
#include "ssd/SSD_Defs.h"
#include "exec/MQSim_Interface.h"

using namespace std;

void command_line_args(char* argv[], string& input_file_path, string& workload_file_path)
{

	for (int arg_cntr = 1; arg_cntr < 5; arg_cntr++) {
		string arg = argv[arg_cntr];

		char file_path_switch[] = "-i";
		if (arg.compare(0, strlen(file_path_switch), file_path_switch) == 0) {
			input_file_path.assign(argv[++arg_cntr]);
			continue;
		}

		char workload_path_switch[] = "-w";
		if (arg.compare(0, strlen(workload_path_switch), workload_path_switch) == 0) {
			workload_file_path.assign(argv[++arg_cntr]);
			continue;
		}
	}
}

void print_help()
{
	cout << "MQSim - SSD simulator with both NVMe and SATA host interface behavior, see ReadMe.md for details" << endl <<
		"Standalone Usage:" << endl <<
		"./MQSim [-i path/to/config/file] [-w path/to/workload/file]" << endl;
}

int main(int argc, char* argv[])
{
	string ssd_config_file_path, workload_defs_file_path;
	if (argc != 5) {
		// MQSim expects 2 arguments: 1) the path to the SSD configuration definition file, and 2) the path to the workload definition file
		print_help();
		return 1;
	}

	command_line_args(argv, ssd_config_file_path, workload_defs_file_path);

	MQSim_Interface::Workload_Set* workload = MQSim_Interface::Load_workload(ssd_config_file_path, workload_defs_file_path);

	for (int scenario_number = 1; scenario_number <= (int)workload->Io_scenarios->size(); scenario_number++) {
		time_t start_time = time(0);
		char* dt = ctime(&start_time);
		PRINT_MESSAGE("MQSim started at " << dt)
		PRINT_MESSAGE("******************************")
		PRINT_MESSAGE("Executing scenario " << scenario_number << " out of " << workload->Io_scenarios->size() << " .......")

		MQSim_Interface::Simulation_Instance* instance = MQSim_Interface::Initialize_scenario(workload, scenario_number);
		MQSim_Interface::Run_to_completion(instance);

		time_t end_time = time(0);
		dt = ctime(&end_time);
		PRINT_MESSAGE("MQSim finished at " << dt)
		uint64_t duration = (uint64_t)difftime(end_time, start_time);
		PRINT_MESSAGE("Total simulation time: " << duration / 3600 << ":" << (duration % 3600) / 60 << ":" << ((duration % 3600) % 60))
		PRINT_MESSAGE("");

		PRINT_MESSAGE("Writing results to output file .......");
		MQSim_Interface::Write_results(instance, workload_defs_file_path.substr(0, workload_defs_file_path.find_last_of(".")) + "_scenario_" + std::to_string(scenario_number) + ".xml");

		MQSim_Interface::Finalize_scenario(instance);
	}

	MQSim_Interface::Unload_workload(workload);

	cout << "Simulation complete; Press any key to exit." << endl;

	cin.get(); // Disable if you prefer batch runs

	return 0;
}
