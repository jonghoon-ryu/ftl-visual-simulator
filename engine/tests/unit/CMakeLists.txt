cmake_minimum_required(VERSION 3.14)
project(mqsim_unit_tests CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)
FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG v1.14.0
)
# Windows-specific gtest flag, harmless elsewhere - kept for whoever builds
# this on Windows someday.
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

set(ENGINE_SRC ${CMAKE_CURRENT_SOURCE_DIR}/../../mqsim/src)

# Same real engine sources the WASM build and the native golden-test CLI
# compile from - these tests link against the actual production code, not
# a reimplementation of it, same "no separate copy to drift out of sync"
# principle as everything else in this project.
file(GLOB_RECURSE ENGINE_SOURCES ${ENGINE_SRC}/*.cpp)
list(FILTER ENGINE_SOURCES EXCLUDE REGEX ".*/wasm/.*")
list(FILTER ENGINE_SOURCES EXCLUDE REGEX ".*/main\\.cpp$")

add_executable(mqsim_unit_tests
  flash_block_manager_test.cpp
  address_mapping_unit_test.cpp
  tsu_test.cpp
  gc_and_wl_unit_test.cpp
  ${ENGINE_SOURCES}
)

target_include_directories(mqsim_unit_tests PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${ENGINE_SRC}
  ${ENGINE_SRC}/exec
  ${ENGINE_SRC}/host
  ${ENGINE_SRC}/nvm_chip
  ${ENGINE_SRC}/nvm_chip/flash_memory
  ${ENGINE_SRC}/sim
  ${ENGINE_SRC}/ssd
  ${ENGINE_SRC}/utils
)

target_link_libraries(mqsim_unit_tests PRIVATE gtest gtest_main gmock gmock_main)

include(GoogleTest)
gtest_discover_tests(mqsim_unit_tests)
