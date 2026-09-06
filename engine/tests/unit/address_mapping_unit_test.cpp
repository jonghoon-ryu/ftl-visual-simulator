#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include "test_doubles.h"

using namespace SSD_Components;
using mqsim_test::MockAddressMappingUnit;
using ::testing::Field;
using ::testing::Return;

// Address_Mapping_Unit_Base is the one class, of this project's original
// four "already abstract interface" candidates, where a real GMock mock
// with EXPECT_CALL-style interaction verification works exactly as
// advertised - every method a caller could plausibly depend on is pure
// virtual. Contrast with flash_block_manager_test.cpp/tsu_test.cpp, where
// the specific methods this project most wants to test turned out to be
// concrete/non-virtual, and a hand-written fake with directly-poked state
// had to stand in for a true mock instead.
TEST(MockAddressMappingUnit, RecordsExpectedCallWithMatchingArgument) {
	MockAddressMappingUnit amu;
	NVM::FlashMemory::Physical_Page_Address target_block(0, 0, 0, 0, /*BlockID=*/2);

	// Physical_Page_Address has no operator== (checked - not defined
	// anywhere in the engine), so match on the field that matters for this
	// test rather than the whole struct.
	EXPECT_CALL(amu, Set_barrier_for_accessing_physical_block(
		Field(&NVM::FlashMemory::Physical_Page_Address::BlockID, 2))).Times(1);

	amu.Set_barrier_for_accessing_physical_block(target_block);
}

TEST(MockAddressMappingUnit, StubsReturnValueForCallers) {
	MockAddressMappingUnit amu;
	EXPECT_CALL(amu, Get_cmt_capacity()).WillOnce(Return(2097152u));

	EXPECT_EQ(amu.Get_cmt_capacity(), 2097152u);
}

TEST(MockAddressMappingUnit, StubsDifferentReturnValuesPerArgument) {
	MockAddressMappingUnit amu;
	// A golden/regression test running a real workload can only observe the
	// *simulated outcome* of a call like this, not pin down its behavior for
	// a specific LPA the workload may never happen to generate - a mock can.
	EXPECT_CALL(amu, is_lpa_locked_for_gc(0, 42)).WillOnce(Return(true));
	EXPECT_CALL(amu, is_lpa_locked_for_gc(0, 7)).WillOnce(Return(false));

	EXPECT_TRUE(amu.is_lpa_locked_for_gc(0, 42));
	EXPECT_FALSE(amu.is_lpa_locked_for_gc(0, 7));
}
