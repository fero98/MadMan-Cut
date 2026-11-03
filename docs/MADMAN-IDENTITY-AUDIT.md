# MadMan Cut identity audit

Baseline: Nuzky 0.1.3-alpha, commit `1461a17f143d79c6ec0a851a9b34f3978a023501`.
This is an identity and compatibility review of the fork, not a claim that
every inherited line or dependency has been independently rewritten.

## Findings and changes

| Surface | Finding | Result |
| --- | --- | --- |
| Application and installer icons | Tauri already points to `icons-madman`, which uses the MadMan M rather than the original application icon. The old source icon files still exist in the checkout. | Keep the MadMan assets configured. |
| Editor icons | Several controls used scissors icons, including timeline, speech, style and AI. | Replaced these controls with split symbols. Actions and shortcuts remain the same. |
| Main UI and AI setup | Several messages still displayed the original product name. | Changed the product references in the main UI and the selected setup, AI, audio and project surfaces. Technical names remain where they describe the real integration. |
| Recap export | The optional ending card displayed the upstream product name and domain. | Draws `MadMan Cut` without an unowned domain. Its checkbox is labelled accordingly. |
| Built-in guide | The video contained screenshots of the previous interface. | Re-rendered it using the updated isolated test screenshots. It has Czech subtitles and no audio. |
| Feedback | The existing feedback actions lead to the upstream maintainer, not a MadMan support channel. | Their menu labels now identify the upstream destination. |

## Intentionally retained or still outstanding

- The Rust editing engine, timeline, project model, export, agent interfaces,
  media libraries and significant parts of the UI remain derived from Nuzky.
  The result is a fork, not an independently created application.
- Project files use `.nuzky`; agent configuration still uses the `nuzky` MCP
  entry, internal variables, IDs and commands. Renaming these without migration
  would disrupt existing projects and connected agents.
- The plugin gallery is an upstream service; it must not be represented as a
  MadMan service. Some gallery, authentication, error and diagnostic messages
  still refer to the upstream name. OpenAI's sign-in may also show the upstream
  client identity. The source contains other internal mentions and original
  icons retained for development/compatibility, not configured for the Windows
  installer and app icon.
- The original sample asset remains for existing projects and its attribution
  remains with it. The user-facing guide opens the new instructional video.
- Upstream copyright, notices, GPL-3.0-or-later terms and third-party credits are
  preserved. A further visual redesign and migration of integrations require
  separate implementation and verification; they are not implied by a rename.

## Checks

The Windows `madman_identity` UI flow checks the fork name, icons, agent setup,
guide playback and that opening the guide leaves the current project unchanged.
The recap engine QA renders an MP4; a frame from the actual result was inspected
for the new end card. `npm run lint` and `npm run build` check the frontend.
