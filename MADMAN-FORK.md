# MadMan Cut for Windows

MadMan Cut starts as a source fork of Nuzky **v0.1.3-alpha**, matching the installer
`Nuzky_0.1.3-alpha_x64-setup.exe` used as the reference. The editor, engine, timeline,
Whisper speech recognition, captions, effects, project model and export are retained.

Upstream: https://github.com/nuzkyapp/nuzky

Baseline commit: `1461a17f143d79c6ec0a851a9b34f3978a023501`

Local branch: `codex/madman-windows`. The original remote is named `upstream`. The MadMan release repository is `fero98/MadMan-Cut`. Original copyright notices and GPL-3.0-or-later terms remain in
place. MadMan modifications are distributed under the same license.

## First changes

- Product name and Windows application identity: **MadMan Cut**, `cz.madman.cut`.
- Main window, startup screen and version label use the new product name.
- Default project/model data and cache use `madman-cut` rather than `nuzky`.
- The default local IPC directory is separate. Explicit `NUZKY_DATA_DIR` and
  `XDG_RUNTIME_DIR` overrides keep their existing meaning for tools and tests.
- Updates use the MadMan Cut GitHub release feed and a separate signing key; upstream installers are refused.
- The `.nuzky` project format and internal command names stay compatible.
- Nested Whisper/Vulkan build files live in a short, per-build directory below
  `target/whisper-ep/`, avoiding MSBuild's 260-character path limit in a deep
  OneDrive checkout. This retains GPU speech recognition. The failing native
  build was reproduced and the same CMake build passed after this change.

The first patch deliberately preserves the original layout and editing behavior.
Upstream names still appear in help, attribution, the internal executable name,
the CLI, and the external agent connection setup. External MCP configuration is
still called `nuzky`: connecting this copy can replace that entry after its
existing confirmation/backup flow. Use the in-app AI panel or separate agent
profiles when working with both products.

## Build

See `scripts/madman/build-windows.ps1`. It performs a preflight before downloading
dependencies, then uses the upstream pinned Windows dependency setup and bundler.
Run the preflight with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/madman/build-windows.ps1 -CheckOnly
```

Windows builds need Rust MSVC, Visual Studio C++ Build Tools and a Windows SDK,
LLVM with libclang, CMake and Node.js. `scripts/madman/install-build-tools.ps1`
prepares them from the official installers and requires an administrator shell
for Visual Studio. The Microsoft installer signature and Rust installer checksum
are verified before execution. The build
itself should run as the ordinary user, not as administrator.

The upstream build instructions and licenses are in `docs/BUILDING.md` and
`LICENSE`. Keep those notices and provide corresponding source with distributions.
The first Windows installer is now built. `delivery/` contains the setup EXE,
its SHA-256 checksum, and `MadMan-Cut/`, a portable folder with the executable and
its required DLLs. Keep the whole portable folder together. A desktop shortcut
named MadMan Cut opens its executable. See `VERIFICATION-MADMAN.md` for the
checks performed and their limits.

## Next improvements after the baseline runs

1. Verify import, playback, trimming, captions and MP4 export in the actual Windows build.
2. Add Czech UI through a translation layer while retaining English as a fallback.
3. Separate the external agent's MCP configuration name from upstream.
4. Add MadMan caption/export presets for YouTube and Shorts.
5. Improve batch selection and processing of gaming footage.

These are planned work, not implemented features.
