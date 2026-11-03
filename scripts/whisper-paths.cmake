# ggml builds its Vulkan shader generator as a separate CMake project nested deep in whisper.cpp's build directory.
# Under C:\Users\<name>\code\nuzky the files MSBuild's file tracker writes there pass 260 characters, which it cannot
# do even with long paths enabled, so those projects get a shorter base. whisper-rs-sys passes CMAKE_PROJECT_INCLUDE
# from the environment to CMake, which reads this file after each project().
# A checkout inside OneDrive/Documents is deeper than the upstream example. Put nested build files near target's
# root, not inside target/<profile>/build/<crate>/out/build. Keep each parent build separate by its path hash.
if(DEFINED ENV{CARGO_TARGET_DIR})
    get_filename_component(_nuzky_checkout "${CMAKE_CURRENT_LIST_DIR}/.." ABSOLUTE)
    get_filename_component(_nuzky_target "$ENV{CARGO_TARGET_DIR}" ABSOLUTE BASE_DIR "${_nuzky_checkout}")
else()
    get_filename_component(_nuzky_target "${CMAKE_CURRENT_LIST_DIR}/../target" ABSOLUTE)
endif()
string(SHA256 _nuzky_build_key "${CMAKE_BINARY_DIR}")
string(SUBSTRING "${_nuzky_build_key}" 0 12 _nuzky_build_key)
set_property(DIRECTORY PROPERTY EP_BASE "${_nuzky_target}/whisper-ep/${_nuzky_build_key}")
