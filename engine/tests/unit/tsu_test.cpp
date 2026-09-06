#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include "test_doubles.h"

using mqsim_test::MockTSU;
using ::testing::Return;

// TSU_Base's own pure virtuals are split across two access levels: Schedule()
// is public (a consumer holding a TSU_Base* calls it to ask "please issue
// your queued transactions now"), while the three service_*_transaction()
// methods are protected (only TSU_Base's own concrete scheduling logic
// calls them - a real subclass like TSU_OutofOrder implements them, but no
// outside caller ever should). GMock mirrors whatever access level MOCK_
// METHOD is declared under, same as a real override would - so this test
// can EXPECT_CALL on Schedule() from outside the class, but the protected
// three would need a friend test class to reach, matching production code's
// own access rules exactly.
TEST(MockTSU, ScheduleCanBeVerifiedFromOutsideTheClass) {
	MockTSU tsu;
	EXPECT_CALL(tsu, Schedule()).Times(1);

	tsu.Schedule();
}
