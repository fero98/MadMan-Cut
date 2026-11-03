# Windows baseline verification — 2026-11-02

Reference: Nuzky v0.1.3-alpha, commit
`1461a17f143d79c6ec0a851a9b34f3978a023501`.

## Completed

- Installed Rust 1.99.1, Visual Studio 2022 C++ Build Tools, Windows SDK,
  LLVM and CMake. Microsoft installer signature and Rust checksum were checked.
- Installed npm dependencies from the lockfile. npm reported no vulnerabilities.
- Frontend lint, TypeScript checks and production Vite build passed.
- Rust formatting and the diff whitespace check passed.
- Built the native release application successfully.
- Reproduced Whisper's MSBuild 260-character path failure, shortened only its
  nested build directory, and reran the same CMake build: zero errors.
- Launched the real release app with a separate home, data and IPC directory.
- Observed the MadMan Cut native title, startup screen and sidebar version label.
  The sidebar showed the fork attribution and no upstream update menu.
- Imported a generated 4-second 640×360 test-pattern video with a sine-wave audio
  track. The real preview and media thumbnail showed the expected moving pattern.
- Split at 2 seconds using the editor's S shortcut. The saved `.nuzky` project
  contained two clips: start/duration 0/2,000,000 and 2,000,000/2,000,000 µs.
- Exported through the real Export dialog, with its progress and completion UI.
  ffprobe confirmed 1920×1080 H.264 at 30 fps, a 4.000-second video stream and an
  AAC audio stream. Container/audio duration was 4.010 seconds.
- Decoded the entire MP4 with FFmpeg without errors. Audio was present: mean
  volume −21.1 dB, peak −16.1 dB.
- Closing the editor returned to the library; closing again ended the test app.

Proof is under ignored `tmp-test/madman-smoke/`, with the native build logs under
`tmp-test/`. The test source is generated content, not a private user recording.

## Scope and remaining checks

The `madman_identity` automated UI flow is registered and parses correctly. Its
equivalent checks above were performed manually on the real release binary;
the debug-only automated flow and the full upstream gate were not run.

Whisper's GPU build passed and the setup screen detected GPU speech support.
Actual speech transcription, face models, external AI provider requests, phone
import and a broad phone-codec regression suite were not exercised in this pass.
The inherited feature implementations remain in the fork.

The final NSIS package completed successfully (106.24 MiB). A silent per-user
installation returned exit code 0, and the installed executable opened the saved
test project library. All FFmpeg, ONNX Runtime and Visual C++ runtime DLLs and
license notices were present in the installed directory.

The Codex desktop package redirects LocalAppData writes into its own package
cache. For a stable, directly accessible deliverable, `delivery/MadMan-Cut/`
contains a complete portable copy of the installed files, excluding the
uninstaller. The desktop shortcut points to that folder. The separate NSIS EXE
can also be launched manually from Explorer for an ordinary installation.

The portable executable was then launched from its delivery folder and its real
window was inspected: MadMan Cut opened the project library successfully. The
desktop shortcut targets this portable executable, outside the Codex package cache.

## Cinematic interface and icon

The `madman_identity` automated flow passed with the cinematic theme and new
icon. It checked the 1440×900 and 1024×640 home views, primary action, fork
identity, absence of upstream update UI, and opening the editor with its library
heading. Screenshots are in `tmp-test/repro/madman_identity/`. The generated
icon was also reviewed at 32×32. Frontend lint and build passed. The earlier
media editing and export smoke test above predates this interface update.

The asset research in `docs/MADMAN-ASSET-SOURCES.md` identifies possible future
sources; it does not install new media or implement new transitions.

## AI and sound discovery check

`python scripts/repro.py madman_identity` passed with the AI ideas and sound
search shortcuts. It verified the selected idea populates an editable draft
without starting the agent, and that the sound shortcut starts the matching
search. Lint and frontend production build passed. This check did not run a
provider-backed AI editing session or verify a newly downloaded asset.

## Partial Czech interface check

The `madman_identity` repro flow passed in the isolated desktop app, including
checks for Czech media, library and editor labels, an editable AI idea, and a
sound-search shortcut. Home and editor screenshots at 1024×640 and home at
1440×900 were captured. This does not verify every untranslated dialog or an
actual external AI editing session.

## MadMan video guide verification

The `madman_identity` repro opened and played the embedded 135-second guide,
closed it without changing the current project, checked the dialog at 1024×640,
and opened it from setup. The screenshots are under
`tmp-test/repro/madman_identity/`. Lint and the frontend build passed.

## MadMan identity audit and checks

- Visible scissors icons in the editor and related controls use split symbols.
- Main-screen, agent setup and selected user-facing product text uses MadMan Cut.
- The optional recap ending renders MadMan Cut, without the upstream domain.
- The user's local guide was regenerated with the current interface screenshots.
- `madman_identity` passed in the real Windows debug app, including guide
  playback, split icon and setup branding; the `connect` flow passed with test
  agents and an isolated profile. Neither used the user's signed-in agents.
- `cargo test --workspace --test qa_recap
  recap_snaps_each_cut_shut_on_the_bar_and_ends_on_the_finished_cut_as_the_renderer_draws_it`
  passed. An extracted frame showed the MadMan Cut card. This is not a full
  release gate or a test of every inherited feature.

Details and retained integration identifiers are in
`docs/MADMAN-IDENTITY-AUDIT.md`.

## Social links, sample visibility and Czech style

The isolated `madman_identity` and `madman_hide_samples` flows passed, including
all three addresses in the browser-open handler, real text clips for each URL,
undo, Czech style text, small-window layout, preservation of the sample project,
and a different project with the same name remaining visible. The
`madman_social_export` flow exported and decoded a video with the YouTube URL;
its rendered frame was inspected. Browser opening was intercepted in the test;
the actual external websites were not visited. The sample filter recognizes
the previously open original by its sample credit and remembers that path; it
does not scan every closed sample project on disk.
# Windows sandbox, diagnostics and icon update (2026-11-02)

- Codex 0.166.0 on this machine accepted the Windows MXC sandbox with the
  restricted filesystem profile and emitted `thread.started`. A subsequent
  network request returned HTTP 403, so an actual AI response was not verified.
- The Windows command-construction unit test passed and checks both MXC and
  the existing minimal read-only filesystem profile.
- Frontend lint and TypeScript checks passed. The isolated MadMan identity flow
  passed, including social URL dispatch, the local diagnostics menu, the Czech
  style screen and guide playback at two window sizes.
- The isolated Codex panel flow passed with a fake agent, including cutting,
  captions, undo, stop, resuming a conversation, and account error handling.
- The new original vector icon is `assets/madman/icon-v2.svg`; generated Windows
  icons are in `src-tauri/icons-madman-v2`. The new release is tested separately
  from the user's existing projects and account.
- Czech translation has been extended, but English strings remain in other
  screens and in raw diagnostics from external tools.

# Import, transitions and sound (2026-11-02)

- The user's screenshot shows a Windows cloud-file error 0x80070194 before the
  online-only MP4 reached the app; that particular file was not tested.
- `madman_quality` passed with three locally generated MP4 clips, two new
  transitions, three Czech text clips, the built-in Dancing song and Whoosh.
  The exported 9-second H.264/AAC video had non-silent audio from its opening;
  sampled export frames showed both transitions in the intended direction.
- `madman_preview_sound` passed for the three offline music rows, the audible
  20-second offset for Dancing, another offline song and the Whoosh preview.
  The default audio device opened, but human audibility cannot be established
  by an automated device-open check.
- The broader `sounds` flow passed with an isolated mock online service,
  including offline fallback, local effects, audio export and credits. It
  verifies the existing rule that audio beyond the last picture is not exported.
- Directional transition geometry, embedded sound hashes, generated TypeScript
  types, frontend lint and type checking passed. The release app started in an
  isolated profile; the user's projects and cloud settings were not changed.

# Speech models and language selector (2026-11-02)

- The Windows selector regression reproduced inherited light text on a
  transparent option background. The revised option colors exceed 4.5:1 in
  computed style; Czech labels and unchanged language codes were checked in the
  isolated editor. The actual open Windows popup was visually inspected in
  `tmp-test/repro/madman_speech_popup/native-language-popup.png`, and the
  selected model card was checked at 1024 by 640 pixels.
- `madman_large_v3` passed with the actual checksum-verified 1,081,140,203-byte
  model and 12 seconds of public-domain Czech speech. It generated caption
  clips in the editor without errors. On this short sample, both full and turbo
  made mistakes, and turbo correctly recognised a word the larger model missed;
  this is not a comparative benchmark.
- The model is optional in the app and is not automatically installed in the
  user's model directory. The sample, temporary model and caches used only the
  isolated test directory. Other models in `docs/MADMAN-MODEL-RESEARCH.md` are
  candidates, not integrated features.
- `madman_large_v3` was repeated with standard isolated fixtures; the editor
  generated Czech caption clips successfully without using the user's projects.

