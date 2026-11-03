# Viral Lab verification — 2026-11-02

## Czech controls update — 2026-11-03

The delivered editor now has Czech Viral Lab navigation, buttons, field labels,
review/run statuses, error messages, number/date formatting and on-screen daily
reports. Series labels are translated while their stored English identifiers
remain unchanged. Original scripts, dialogue, prompts and exports stay in US
English; no existing production plan was rewritten during localization.

TypeScript checking, oxlint and the production frontend build passed. The
isolated desktop flow passed 30 assertions, including the six Czech navigation
labels, translated series names with stable identifiers, and preservation of
the English script. Evidence: `tmp-test/repro/viral-cz/madman_viral/result.json`.
The updated portable executable was opened directly and its Czech Náměty and
Scénáře screens were inspected through Windows Computer Use with the existing
saved example. The earlier English executable in the delivery folder was
replaced, and SHA256SUMS.txt was regenerated.

This rebuild used Tauri `build --no-bundle -- --locked --config
profile.release.package.nuzky-app.opt-level=0`: the thin app crate is built
without optimization to shorten packaging; dependency optimization and repository
profiles are unchanged. No backend behavior or database schema changed.

Delivered portable build: `delivery/MadMan-Cut-Viral-Lab/`.
The package contains the embedded-frontend release editor, standalone metadata
worker, runtime DLLs, third-party notices, setup documentation and binary hashes.

## Passed

- Release editor build through Tauri (`--no-bundle -- --locked`).
- Release standalone worker build and an isolated empty report smoke test.
- 9 discovery-crate tests: nullable statistics and zero values, duration parsing,
  deduplication, review preservation, independent snapshot retention, source
  unlinking, approval invalidation/stale revisions, timing/rubric validation,
  concurrent initialization, cross-connection run/quota reservations, safe export
  and generated TypeScript contract.
- Discovery clippy with `--all-targets -- -D warnings`.
- Frontend TypeScript checking, repository oxlint and production Vite build.
- 3 native ACL tests: command registration, main-webview access and denial to
  other webviews/remote pages. FFmpeg's DLL directory must be on PATH for these.
- 27 desktop-flow assertions, including test-key storage/removal in a separate
  keychain entry, no saved key disclosure, edit/save/approve/export, no overwrite,
  approval invalidation after edits, report generation and a 1024×720 viewport.
- 5 packaged-release smoke assertions: embedded frontend without a dev server,
  no development hook, backend/SQLite access, Viral Lab navigation and disabled
  live discovery without a key. All native tests used isolated profiles.
- Windows scheduler script syntax and read-only `Check` action. No task installed.

## Evidence and execution notes

Final desktop evidence:
`tmp-test/repro/viral-credentials/madman_viral/result.json` and its PNGs.
Packaged release evidence: `tmp-test/repro/viral-portable/launch/result.json`.

An initial visual review caught a real SQLite initialization race even though
the initial functional assertions passed. Initialization now serializes within
the process and retries SQLite busy/locked errors; an eight-thread regression
test and an explicit UI alert check cover it.

Several dev-server reruns exceeded the harness's 60-second boot deadline during
the native release build. The final desktop flow used separately prebuilt test
assets with the existing development hook through Vite preview, in
`tmp-test/viral-e2e-dist`. Those test assets were not embedded in the delivery.
The separate packaged-release smoke test verified the actual embedded production
assets and absence of the test hook. The release's first-use editor setup dialog
can appear in a fresh profile; it can be closed without downloading models.

## Not verified or enabled

No real YouTube key was supplied, so live API access, granted quotas, search
relevance and recovery from real platform errors remain unverified. Test
credentials were deliberately nonfunctional and were removed after testing.

Daily scheduling is prepared, not installed. It should follow a successful live
run with the user's configured key. Derived YouTube analytics remain disabled;
the applicable permission is still required. The original-plan workflow uses
editable local templates, not an AI provider. No source media was downloaded,
no paid generation requested and no video published by this module.

This was targeted verification of the new module, not a complete requalification
of the existing video editor or all previously modified files in the checkout.
