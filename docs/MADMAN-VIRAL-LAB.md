# MADMAN STUDIO Viral Lab

The workspace controls, section labels, review statuses, error messages and
on-screen daily report are in Czech. Original production scripts, dialogue,
prompts, exported content and stored series identifiers remain in US English.

Viral Lab is a local workspace in the MadMan Cut home screen. The existing editor's
timeline, project format and media remain independent. `crates/discovery` owns
metadata and plans; the main webview uses the `viral_lab` Tauri command.

## Implemented scope

- Official YouTube Data API v3 searches: five comedy query groups, 7/30-day
  publication windows and view-count/date ordering (20 searches before retries).
  Details/statistics are requested in batches of up to 50 IDs.
- SQLite deduplication, nullable statistics, timestamped observations, manual
  source reviews, run history, original plans and approval of a specific revision.
- Refresh of tracked candidates, with deletion when a successful detail response
  omits a previously stored video. Manual reviews survive statistics refreshes.
- Five **local story templates, not AI generation**: original US English stories,
  four timed shots, image/video prompts, dialogue, camera/sound/music notes,
  continuity, subtitles, opening frame and publishing text. They do not assert
  that the linked source video's story has been watched or analyzed.
- Labelled editing fields and validation of contiguous 10–30-second shot timing.
  Every save increments the revision and clears approval. Old plan bodies are not
  archived in this MVP. Manual review covers language, originality, timing and rights.
- Exports of approved current revisions only, to a new package directory. Packages
  contain original material, not source metadata/footage, and cannot be overwritten.
- Reports with up to 20 source candidates, 5 original plans and 3 approved plans.
  These are shortlists from the collected sample, not platform-wide viral rankings.

## Boundaries and truthful data

No source media downloads, paid generation, AI-provider requests or publishing.
No automatic video understanding or proof of real-world virality. Missing API
fields stay N/A; zero remains zero. `videoDuration=short` means under four minutes,
not confirmed Shorts. `regionCode=US` means viewable in the US, not US audience
share; `relevanceLanguage=en` does not force English. Users confirm Shorts manually.

Derived YouTube metrics, growth and day comparisons remain disabled pending the
applicable permission. Sub-million candidates are new candidates, not claimed to
be measured fast growers. The optional human-entered MADMAN rubric scores the
original plan only: 20/20/15/15/10/10/10 for hook, humor, pacing, rewatch potential,
US fit, feasibility and series potential. It is an internal estimate, never a
probability of virality or a YouTube-provided measurement.

## Storage and security

The default database is in local application data under `madman-cut/viral-lab`,
outside the repository/OneDrive. `NUZKY_DATA_DIR` overrides it for isolated tests.
SQLite uses foreign keys, WAL, busy timeouts and transactional run/budget reservations.

Each public statistical observation expires on its own 30-day clock. Refreshing
the latest statistics does not refresh an older observation. Metadata expires
after 30 days without refresh. Deleting a source unlinks its original plan while
retaining user-authored content. No automatic database backup or report file is
created. User-exported reports/backups must respect applicable retention rules.

The YouTube key uses a separate system-keychain entry scoped to the data folder.
The UI receives presence/errors, never the saved key. Saving requires accepting
the local data notice and YouTube terms. The key is sent only to Google's HTTPS
YouTube REST endpoint; redirects are disabled and transport errors are sanitized
so request URLs cannot reach logs. Removing the key disconnects discovery.

Persisted rolling 24-hour local budgets: 30 search requests and 500 statistics
requests, including failed attempts. These are conservative application limits,
not a promise of Google quota. Three-second requests have at most three attempts
with cancellable backoff; auth/forbidden errors stop. Partial successful work is
retained. A database lease prevents concurrent workers and expires interrupted
runs after ten minutes. Desktop Stop controls its own discovery process; a separate
scheduled worker is bounded by its Windows task timeout.

## Setup and scheduling

1. Build the editor with the existing toolchain and run
   `cargo build --locked -p madman-discovery` to build the standalone worker.
2. Open **MADMAN Viral Lab** in the home sidebar. Enable YouTube Data API v3 in
   Google Cloud, review the granted quota, and restrict the key to that API.
3. Enter the key in the connection form, accept the notice/terms, and test
   **Vyhledat videa**. Do not put the key in a chat, repository or production package.
4. After a successful live run, install the optional native Windows schedule:

   ```powershell
   ./scripts/madman/viral-daily.ps1 -Action Check
   ./scripts/madman/viral-daily.ps1 -Action Install -At 09:00
   ```

The schedule uses the signed-in user's keychain at limited privilege, ignores
overlapping starts, catches up missed starts and stops a run after ten minutes.
The computer must be on and connected, and the user signed in. The script checks
Prague's Windows timezone and refuses to replace an existing task. Pass
`-Executable` for a stable installed worker instead of the development binary.
`-Action Remove` removes only the task. Builds and tests never install a task.

`madman-discovery daily` records a collection run. `madman-discovery report`
prints the current report. **Vytvořit denní přehled** in the UI does the same without
creating persistent report files.

## Dependencies, verification and limitations

The fork/module uses GPL-3.0-or-later. New database dependency: rusqlite (MIT)
with bundled SQLite (public domain); resolved versions are in Cargo.lock. Other
libraries already exist in the workspace. No scraper or extra server/runtime is
introduced. Review transitive notices when distributing a new build.

```powershell
cargo test --locked -p madman-discovery
cargo clippy --locked -p madman-discovery --all-targets -- -D warnings
node node_modules/typescript/bin/tsc --noEmit
python scripts/repro.py madman_viral
```

The TypeScript contract is generated/checked by the discovery crate's test:
`NUZKY_WRITE_VIRAL_TYPES=1 cargo test -p madman-discovery frontend_contract`.
The desktop test uses isolated storage and no YouTube requests. Live relevance,
real quota access and end-to-end API collection require the user's own key;
offline tests do not establish those results.

Reference documents reviewed 2026-11-02:
[search parameters](https://developers.google.com/youtube/data/reference/rest/v3/search/list),
[quotas](https://developers.google.com/youtube/data/determine_quota_cost),
[developer policies](https://developers.google.com/youtube/terms/developer-policies),
[derived metrics and retention](https://developers.google.com/youtube/terms/derived-metrics-policy),
[rusqlite](https://github.com/rusqlite/rusqlite),
[Task Scheduler](https://learn.microsoft.com/en-us/windows/win32/taskschd/task-scheduler-start-page).
