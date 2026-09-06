#ifndef MQSIM_UNIT_TEST_DOUBLES_H
#define MQSIM_UNIT_TEST_DOUBLES_H

#include <gmock/gmock.h>
#include "ssd/Address_Mapping_Unit_Base.h"
#include "ssd/Flash_Block_Manager_Base.h"
#include "ssd/TSU_Base.h"

namespace mqsim_test {

// Address_Mapping_Unit_Base is the richest of this project's four
// "abstract interface" classes (see the plan's "MQSim 개괄" doc) - every
// method a caller could plausibly depend on is pure virtual, so it's a
// genuine GMock candidate: MOCK_METHOD + EXPECT_CALL work exactly as
// advertised. See flash_block_manager_test.cpp's FakeFlashBlockManager for
// the contrasting case (a class that's only *partially* virtual).
class MockAddressMappingUnit : public SSD_Components::Address_Mapping_Unit_Base {
public:
	MockAddressMappingUnit()
		: Address_Mapping_Unit_Base("mock-amu", nullptr, nullptr, nullptr,
			/*ideal_mapping_table=*/false, /*no_of_input_streams=*/1,
			/*ChannelCount=*/1, /*chip_no_per_channel=*/1, /*DieNoPerChip=*/1, /*PlaneNoPerDie=*/1,
			/*Block_no_per_plane=*/4, /*Page_no_per_block=*/4, /*SectorsPerPage=*/8, /*PageSizeInBytes=*/4096,
			/*Overprovisioning_ratio=*/0.07, SSD_Components::CMT_Sharing_Mode::SHARED, /*fold_large_addresses=*/false) {}

	// Address_Mapping_Unit_Base -> Sim_Object also declares 3 pure virtuals
	// of its own (every Sim_Object subclass needs these) - trivial no-op
	// overrides since no test here drives the class through the real
	// simulation event loop.
	void Start_simulation() override {}
	void Validate_simulation_config() override {}
	void Execute_simulator_event(MQSimEngine::Sim_Event*) override {}

	// MOCK_METHOD's argument list is a preprocessor macro argument, not
	// real C++ - a raw comma inside a template's angle brackets
	// (std::map<A, B>) splits into two macro arguments and breaks the
	// count MOCK_METHOD expects, so this one multi-arg template type needs
	// a local alias first.
	using LpaStatusMap = std::map<LPA_type, page_status_type>;

	MOCK_METHOD(void, Allocate_address_for_preconditioning, (const stream_id_type, LpaStatusMap&, std::vector<double>&), (override));
	MOCK_METHOD(int, Bring_to_CMT_for_preconditioning, (stream_id_type, LPA_type), (override));
	MOCK_METHOD(void, Store_mapping_table_on_flash_at_start, (), (override));
	MOCK_METHOD(unsigned int, Get_cmt_capacity, (), (override));
	MOCK_METHOD(unsigned int, Get_current_cmt_occupancy_for_stream, (stream_id_type), (override));
	MOCK_METHOD(LPA_type, Get_logical_pages_count, (stream_id_type), (override));
	MOCK_METHOD(void, Translate_lpa_to_ppa_and_dispatch, (const std::list<SSD_Components::NVM_Transaction*>&), (override));
	MOCK_METHOD(void, Get_data_mapping_info_for_gc, (const stream_id_type, const LPA_type, PPA_type&, page_status_type&), (override));
	MOCK_METHOD(void, Get_translation_mapping_info_for_gc, (const stream_id_type, const SSD_Components::MVPN_type, SSD_Components::MPPN_type&, sim_time_type&), (override));
	MOCK_METHOD(void, Allocate_new_page_for_gc, (SSD_Components::NVM_Transaction_Flash_WR*, bool), (override));
	MOCK_METHOD(NVM::FlashMemory::Physical_Page_Address, Convert_ppa_to_address, (const PPA_type), (override));
	MOCK_METHOD(void, Convert_ppa_to_address, (const PPA_type, NVM::FlashMemory::Physical_Page_Address&), (override));
	MOCK_METHOD(PPA_type, Convert_address_to_ppa, (const NVM::FlashMemory::Physical_Page_Address&), (override));
	MOCK_METHOD(void, Set_barrier_for_accessing_physical_block, (const NVM::FlashMemory::Physical_Page_Address&), (override));
	MOCK_METHOD(void, Set_barrier_for_accessing_lpa, (const stream_id_type, const LPA_type), (override));
	MOCK_METHOD(void, Set_barrier_for_accessing_mvpn, (const stream_id_type, const SSD_Components::MVPN_type), (override));
	MOCK_METHOD(void, Remove_barrier_for_accessing_lpa, (const stream_id_type, const LPA_type), (override));
	MOCK_METHOD(void, Remove_barrier_for_accessing_mvpn, (const stream_id_type, const SSD_Components::MVPN_type), (override));
	MOCK_METHOD(void, Start_servicing_writes_for_overfull_plane, (const NVM::FlashMemory::Physical_Page_Address), (override));
	MOCK_METHOD(bool, query_cmt, (SSD_Components::NVM_Transaction_Flash*), (override));
	MOCK_METHOD(PPA_type, online_create_entry_for_reads, (LPA_type, const stream_id_type, NVM::FlashMemory::Physical_Page_Address&, uint64_t), (override));
	MOCK_METHOD(void, manage_user_transaction_facing_barrier, (SSD_Components::NVM_Transaction_Flash*), (override));
	MOCK_METHOD(void, manage_mapping_transaction_facing_barrier, (stream_id_type, SSD_Components::MVPN_type, bool), (override));
	MOCK_METHOD(bool, is_lpa_locked_for_gc, (stream_id_type, LPA_type), (override));
	MOCK_METHOD(bool, is_mvpn_locked_for_gc, (stream_id_type, SSD_Components::MVPN_type), (override));
};

// Flash_Block_Manager_Base is only *partially* virtual - its 8 pure
// virtuals are all about allocating new blocks/pages, which the tests
// using this fake never exercise. The methods this project actually cares
// about testing (Get_min_max_erase_difference, Get_coldest_block_id, ...)
// are concrete, non-virtual methods already implemented on the base class
// itself - GMock can't intercept those via inheritance (non-virtual calls
// don't dispatch dynamically), so there's nothing to mock there. Instead,
// this fake just supplies no-op allocation methods so the class can be
// instantiated, and tests poke Blocks[i].Erase_count directly through the
// already-public PlaneBookKeepingType/Block_Pool_Slot_Type structs to set
// up whatever erase-count scenario they need, then call the real
// (non-virtual) methods under test.
class FakeFlashBlockManager : public SSD_Components::Flash_Block_Manager_Base {
public:
	using Flash_Block_Manager_Base::Flash_Block_Manager_Base;
	void Allocate_block_and_page_in_plane_for_user_write(const stream_id_type, NVM::FlashMemory::Physical_Page_Address&) override {}
	void Allocate_block_and_page_in_plane_for_gc_write(const stream_id_type, NVM::FlashMemory::Physical_Page_Address&) override {}
	void Allocate_block_and_page_in_plane_for_translation_write(const stream_id_type, NVM::FlashMemory::Physical_Page_Address&, bool) override {}
	void Allocate_Pages_in_block_and_invalidate_remaining_for_preconditioning(const stream_id_type, const NVM::FlashMemory::Physical_Page_Address&, std::vector<NVM::FlashMemory::Physical_Page_Address>&) override {}
	void Invalidate_page_in_block(const stream_id_type, const NVM::FlashMemory::Physical_Page_Address&) override {}
	void Invalidate_page_in_block_for_preconditioning(const stream_id_type, const NVM::FlashMemory::Physical_Page_Address&) override {}
	void Add_erased_block_to_pool(const NVM::FlashMemory::Physical_Page_Address&) override {}
	unsigned int Get_pool_size(const NVM::FlashMemory::Physical_Page_Address&) override { return 0; }
};

// TSU_Base's own pure virtuals (Schedule/service_*_transaction) are all
// about picking which queued transaction to issue next on real flash
// hardware timing - genuinely mockable via GMock, but no test here needs
// EXPECT_CALL-style behavior verification on them (Prepare_for_transaction_
// submit()/Submit_transaction() - the two methods gc_and_wl_unit_test.cpp
// actually calls through - are concrete, non-virtual, and harmless no-ops
// without a real NVM_PHY_ONFI controller behind them). Plain no-op stubs
// are enough to make the class instantiable.
class FakeTSU : public SSD_Components::TSU_Base {
public:
	using TSU_Base::TSU_Base;
	void Schedule() override {}
	// TSU_Base -> Sim_Object's 3 pure virtuals - see MockAddressMappingUnit's
	// comment above for why every Sim_Object subclass needs these.
	void Start_simulation() override {}
	void Validate_simulation_config() override {}
	void Execute_simulator_event(MQSimEngine::Sim_Event*) override {}
protected:
	bool service_read_transaction(NVM::FlashMemory::Flash_Chip*) override { return false; }
	bool service_write_transaction(NVM::FlashMemory::Flash_Chip*) override { return false; }
	bool service_erase_transaction(NVM::FlashMemory::Flash_Chip*) override { return false; }
};

// Same pattern as MockAddressMappingUnit, for the rarer case where a test
// wants to verify something *calls into* a TSU (rather than exercising a
// TSU's own scheduling logic, which no test here does).
class MockTSU : public SSD_Components::TSU_Base {
public:
	MockTSU()
		: TSU_Base("mock-tsu", nullptr, nullptr, SSD_Components::Flash_Scheduling_Type::OUT_OF_ORDER,
			/*Channel_no=*/1, /*chip_no_per_channel=*/1, /*DieNoPerChip=*/1, /*PlaneNoPerDie=*/1,
			/*EraseSuspensionEnabled=*/false, /*ProgramSuspensionEnabled=*/false,
			/*WriteReasonableSuspensionTimeForRead=*/0, /*EraseReasonableSuspensionTimeForRead=*/0,
			/*EraseReasonableSuspensionTimeForWrite=*/0) {}

	MOCK_METHOD(void, Schedule, (), (override));
	void Start_simulation() override {}
	void Validate_simulation_config() override {}
	void Execute_simulator_event(MQSimEngine::Sim_Event*) override {}

protected:
	MOCK_METHOD(bool, service_read_transaction, (NVM::FlashMemory::Flash_Chip*), (override));
	MOCK_METHOD(bool, service_write_transaction, (NVM::FlashMemory::Flash_Chip*), (override));
	MOCK_METHOD(bool, service_erase_transaction, (NVM::FlashMemory::Flash_Chip*), (override));
};

} // namespace mqsim_test

#endif // !MQSIM_UNIT_TEST_DOUBLES_H
