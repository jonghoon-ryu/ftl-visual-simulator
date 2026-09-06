#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include "test_doubles.h"
#include "ssd/GC_and_WL_Unit_Page_Level.h"
#include "ssd/Stats.h"

using namespace SSD_Components;
using NVM::FlashMemory::Physical_Page_Address;
using mqsim_test::FakeFlashBlockManager;
using mqsim_test::FakeTSU;
using mqsim_test::MockAddressMappingUnit;
using ::testing::Field;
using ::testing::_;

namespace {

// check_static_wl_required()/run_static_wearleveling() are `protected` on
// GC_and_WL_Unit_Base (only its own subclasses and the static PHY-signal
// callback call them - no outside caller should). A derived class can
// still call an inherited protected member on an object of its own type,
// so a `using`-declaration in a public section re-exposes them for this
// test file only, without touching the real class's access rules.
class TestableGCAndWLUnit : public GC_and_WL_Unit_Page_Level {
public:
	using GC_and_WL_Unit_Page_Level::GC_and_WL_Unit_Page_Level;
	using GC_and_WL_Unit_Page_Level::check_static_wl_required;
	using GC_and_WL_Unit_Page_Level::run_static_wearleveling;
};

} // namespace

// This is the test the whole plan/wear-leveling-integration.md investigation
// was really after: does static wear-leveling trigger, and does it target
// the block it should, *without* needing to run a real workload for ~1.5
// million event-groups and hope the timing lines up? With the four classes
// wired together as fakes/mocks instead of a full simulation, the answer
// is yes, in well under a millisecond.
class StaticWearLevelingTest : public ::testing::Test {
protected:
	// 5 blocks, 1 stream -> Get_a_free_block() hands out blocks 0/1/2 as the
	// initial Data_wf/Translation_wf/GC_wf frontiers (in that order - see
	// Flash_Block_Manager_Base's constructor), leaving blocks 3 and 4 as
	// genuinely idle free blocks. is_safe_gc_wl_candidate() explicitly
	// rejects any of the three frontiers as a WL target (see GC_and_WL_Unit_
	// Base.cpp) - this is the exact structural reason, documented at
	// https://jonghoon-ryu.github.io/ftl-visual-simulator/reference/wl-threshold-not-wired-bug/,
	// that static WL only ever finds a real target once one of those idle
	// blocks becomes the coldest *and* isn't itself a frontier.
	FakeFlashBlockManager fbm{/*gc_and_wl_unit=*/nullptr, /*max_allowed_block_erase_count=*/10000,
		/*total_concurrent_streams_no=*/1, /*channel_count=*/1, /*chip_no_per_channel=*/1,
		/*die_no_per_chip=*/1, /*plane_no_per_die=*/1, /*block_no_per_plane=*/5, /*page_no_per_block=*/4};
	MockAddressMappingUnit amu;
	FakeTSU tsu{"fake-tsu", nullptr, nullptr, Flash_Scheduling_Type::OUT_OF_ORDER,
		1, 1, 1, 1, false, false, 0, 0, 0};
	Physical_Page_Address plane_address;

	TestableGCAndWLUnit MakeUnit(unsigned int static_wl_threshold) {
		return TestableGCAndWLUnit("gc-wl-unit", &amu, &fbm, &tsu, /*flash_controller=*/nullptr,
			GC_Block_Selection_Policy_Type::RGA, /*gc_threshold=*/0.5, /*preemptible_gc_enabled=*/false,
			/*gc_hard_threshold=*/0.005, /*channel_count=*/1, /*chip_no_per_channel=*/1,
			/*die_no_per_chip=*/1, /*plane_no_per_die=*/1, /*block_no_per_plane=*/5, /*page_no_per_block=*/4,
			/*sector_no_per_page=*/8, /*use_copyback=*/false, /*rho=*/0, /*max_ongoing_gc_reqs_per_plane=*/10,
			/*dynamic_wearleveling_enabled=*/true, /*static_wearleveling_enabled=*/true, static_wl_threshold, /*seed=*/1);
	}
};

TEST_F(StaticWearLevelingTest, TriggersOnIdleColdestBlockAndBarriersIt) {
	// Frontiers (0/1/2) get worn down; blocks 3/4 sit idle. Block 3 is the
	// strictly-coldest block overall *and* isn't a frontier, so it's the
	// one and only safe candidate.
	PlaneBookKeepingType* plane = fbm.Get_plane_bookkeeping_entry(plane_address);
	plane->Blocks[0].Erase_count = 10;
	plane->Blocks[1].Erase_count = 10;
	plane->Blocks[2].Erase_count = 10;
	plane->Blocks[3].Erase_count = 0;
	plane->Blocks[4].Erase_count = 5;

	TestableGCAndWLUnit unit = MakeUnit(/*static_wl_threshold=*/5); // gap of 10 >= 5

	EXPECT_CALL(amu, Set_barrier_for_accessing_physical_block(
		Field(&Physical_Page_Address::BlockID, 3u))).Times(1);

	unsigned int wl_before = Stats::Total_wl_executions;
	ASSERT_TRUE(unit.check_static_wl_required(plane_address));
	unit.run_static_wearleveling(plane_address);

	EXPECT_EQ(Stats::Total_wl_executions, wl_before + 1);
	EXPECT_TRUE(plane->Blocks[3].Has_ongoing_gc_wl);
}

TEST_F(StaticWearLevelingTest, DoesNotTriggerBelowThreshold) {
	PlaneBookKeepingType* plane = fbm.Get_plane_bookkeeping_entry(plane_address);
	plane->Blocks[0].Erase_count = 4;
	plane->Blocks[1].Erase_count = 4;
	plane->Blocks[2].Erase_count = 4;
	plane->Blocks[3].Erase_count = 1;
	plane->Blocks[4].Erase_count = 3;
	// gap is 4 - 1 = 3

	TestableGCAndWLUnit unit = MakeUnit(/*static_wl_threshold=*/5);

	EXPECT_CALL(amu, Set_barrier_for_accessing_physical_block(_)).Times(0);
	EXPECT_FALSE(unit.check_static_wl_required(plane_address));
}

// The bug at
// https://jonghoon-ryu.github.io/ftl-visual-simulator/reference/wl-threshold-not-wired-bug/
// (SSD_Device.cpp never passing Static_Wearleveling_Threshold through to
// this class's constructor, so it always used the compiled-in default of
// 100) would have been caught immediately by a test like this one - it
// directly asserts that the threshold *this test* passed in is the one
// actually being compared against, independent of whatever XML config
// generation happens to do elsewhere in the app.
TEST_F(StaticWearLevelingTest, HonorsTheThresholdItWasConstructedWith) {
	PlaneBookKeepingType* plane = fbm.Get_plane_bookkeeping_entry(plane_address);
	plane->Blocks[0].Erase_count = 10;
	plane->Blocks[1].Erase_count = 10;
	plane->Blocks[2].Erase_count = 10;
	plane->Blocks[3].Erase_count = 3;
	plane->Blocks[4].Erase_count = 8;
	// gap is 10 - 3 = 7

	TestableGCAndWLUnit lenient_unit = MakeUnit(/*static_wl_threshold=*/7);
	EXPECT_TRUE(lenient_unit.check_static_wl_required(plane_address));

	TestableGCAndWLUnit strict_unit = MakeUnit(/*static_wl_threshold=*/8);
	EXPECT_FALSE(strict_unit.check_static_wl_required(plane_address));
}
