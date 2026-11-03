# Asset sources for MadMan Cut

Research date: 2026-11-02. These are candidates for future integration, not
installed packages or a claim that every third-party asset has been verified.

## What already works

The sound library contains 46 sound effects and three music tracks in
`assets/sounds/manifest.json`, including 24 effects credited to Kenney. It can
search Openverse, and optionally Freesound with the user's key; it filters for
CC0 and CC BY. The app has thirteen transitions. The optional YouTube import uses
yt-dlp after setup and the existing rights confirmation.

Two offline tracks, Duru Rondo and Roomscene Lo-fi, are by DURU-AI /
uncle-sheepsky. The author dedicates the [recordings and compositions to CC0](https://github.com/uncle-sheepsky/duru-ai-cc0-bgm).
The manifest records the original and converted SHA-256 values, source URLs and
conversion. Both downloaded originals matched the GitHub blob hashes.

## Candidates

1. **Music: [Open Lo-Fi](https://github.com/btahir/open-lofi).** Over 150 tracks,
   grouped into categories with a machine-readable `catalog.json`. The author
   declares the tracks CC0 and says they were generated using Suno. Candidate for
   an opt-in catalog, especially background and cinematic music. Verify the track
   source and applicable generator terms before relying on the declaration; keep
   each title, author, source URL, license and hash, and allow the user to verify
   any platform claim. No integration or media download is implemented yet.
2. **Sound index: [Open Game SFX Index](https://github.com/Mcamento8/open-game-sfx-index).**
   The repository describes 1,451 effects sourced from Kenney and OpenGameArt,
   with categories, durations, download locations and SHA-256 values. It is a
   useful candidate for searching and fetching individual effects on demand.
   Verify each pack against its original author and license, and deduplicate
   against the effects already bundled with the editor.
3. **Sound effects: [Meta Open Sound](https://github.com/facebookincubator/Meta-open-sound).**
   Its Oculus pack includes 289 game and VR effects such as footsteps, doors,
   ambience and interaction sounds, with OGG previews and a searchable index.
   The Oculus collection is CC BY 4.0 and needs credit; its instrument samples
   are CC0. Preserve the collection's license and attribution, and include the
   correct credit with a video when a CC BY effect is used. Candidate for a
   curated, version-pinned pack; the catalog has not been imported.
4. **Transitions: [GL Transitions](https://github.com/gl-transitions/gl-transitions).**
   More than 100 community transitions; upstream supplies WGSL translations and
   compatibility metadata. Each transition has its own attribution/license;
   most are MIT and two are BSD. Nuzky's renderer uses wgpu and already owns
   preview/export timing, so a transition requires a two-input renderer adapter,
   project serialization, undo and preview-versus-export tests. Existing
   single-input plugin effects cannot be treated as drop-in transitions. Start
   with a small, individually reviewed selection rather than execute arbitrary
   downloaded shader code.
5. **Optional existing discovery: [Openverse](https://github.com/WordPress/openverse).**
   Already integrated. Improve search filters, credits and reliability first.
   Its data can aggregate third-party media, so retain each asset's own license,
   source page and author. The upstream app currently excludes Jamendo results
   while redistribution questions are unresolved.
6. **Additional sound catalog: [CC0 Public Domain Sounds](https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds).**
   A third-party collection including Kenney packs and other effects. It states
   CC0 at repository level, but individual files should be traced to their real
   author and original pack before import. Some Kenney sounds already ship in
   this app; compare source IDs and hashes to avoid duplicates.

For any selected item, record the exact upstream revision, original URL, title,
author, license, attribution where needed, downloaded file hash and changes.
Media licenses and API terms are separate from the GPL license of this app.
No source is a guarantee against false ownership claims or platform matches.
