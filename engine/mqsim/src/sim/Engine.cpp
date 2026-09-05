#include <stdexcept>
#include "Engine.h"
#include "../utils/Logical_Address_Partitioning_Unit.h"

namespace MQSimEngine
{
	Engine* Engine::_instance = NULL;

	Engine* Engine::Instance() {
		if (_instance == 0) {
			_instance = new Engine;
		}
		return _instance;
	}

	void Engine::Reset()
	{
		_EventList->Clear();
		_ObjectList.clear();
		_sim_time = 0;
		stop = false;
		started = false;
		Utils::Logical_Address_Partitioning_Unit::Reset();
	}


	//Add an object to the simulator object list
	void Engine::AddObject(Sim_Object* obj)
	{
		if (_ObjectList.find(obj->ID()) != _ObjectList.end()) {
			throw std::invalid_argument("Duplicate object key: " + obj->ID());
		}
		_ObjectList.insert(std::pair<sim_object_id_type, Sim_Object*>(obj->ID(), obj));
	}
	
	Sim_Object* Engine::GetObject(sim_object_id_type object_id)
	{
		auto itr = _ObjectList.find(object_id);
		if (itr == _ObjectList.end()) {
			return NULL;
		}

		return (*itr).second;
	}

	void Engine::RemoveObject(Sim_Object* obj)
	{
		std::unordered_map<sim_object_id_type, Sim_Object*>::iterator it = _ObjectList.find(obj->ID());
		if (it == _ObjectList.end()) {
			throw std::invalid_argument("Removing an unregistered object.");
		}
		_ObjectList.erase(it);
	}

	/// One-time preparation before any event is processed: trigger setup,
	/// config validation, and each object's Start_simulation() hook. Must be
	/// called exactly once per Reset()'d simulation, before the first call to
	/// Run_next_event_group().
	void Engine::Setup_simulation()
	{
		started = true;

		for(std::unordered_map<sim_object_id_type, Sim_Object*>::iterator obj = _ObjectList.begin();
			obj != _ObjectList.end();
			++obj) {
			if (!obj->second->IsTriggersSetUp()) {
				obj->second->Setup_triggers();
			}
		}

		for (std::unordered_map<sim_object_id_type, Sim_Object*>::iterator obj = _ObjectList.begin();
			obj != _ObjectList.end();
			++obj) {
			obj->second->Validate_simulation_config();
		}

		for (std::unordered_map<sim_object_id_type, Sim_Object*>::iterator obj = _ObjectList.begin();
			obj != _ObjectList.end();
			++obj) {
			obj->second->Start_simulation();
		}
	}

	/// Processes exactly one event-group (every event sharing the single
	/// next-nearest fire time, same as one iteration of the old
	/// Start_simulation() loop body) and returns whether the queue still has
	/// events left to process. This is the step primitive that a UI's
	/// step()/run(n) controls call repeatedly; Start_simulation() below is
	/// just this called in a loop.
	bool Engine::Run_next_event_group()
	{
		if (_EventList->Count == 0 || stop) {
			return false;
		}

		EventTreeNode* minNode = _EventList->Get_min_node();
		Sim_Event* ev = minNode->FirstSimEvent;

		_sim_time = ev->Fire_time;

		while (ev != NULL) {
			if(!ev->Ignore) {
				ev->Target_sim_object->Execute_simulator_event(ev);
			}
			Sim_Event* consumed_event = ev;
			ev = ev->Next_event;
			delete consumed_event;
		}
		_EventList->Remove(minNode);

		return true;
	}

	/// This is the main method of simulator which starts simulation process.
	void Engine::Start_simulation()
	{
		Setup_simulation();
		while (Run_next_event_group()) {
		}
	}

	void Engine::Stop_simulation()
	{
		stop = true;
	}

	bool Engine::Has_started()
	{
		return started;
	}

	sim_time_type Engine::Time()
	{
		return _sim_time;
	}

	Sim_Event* Engine::Register_sim_event(sim_time_type fireTime, Sim_Object* targetObject, void* parameters, int type)
	{
		Sim_Event* ev = new Sim_Event(fireTime, targetObject, parameters, type);
		DEBUG("RegisterEvent " << fireTime << " " << targetObject)
		_EventList->Insert_sim_event(ev);
		return ev;
	}

	void Engine::Ignore_sim_event(Sim_Event* ev)
	{
		ev->Ignore = true;
	}

	bool Engine::Is_integrated_execution_mode()
	{
		return false;
	}
}