# Wheel of Heavenly Fate

A browser-local event dashboard for **Heavenly Order Sect**, built with React, strict TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide, and Canvas. No backend, account, subscription, external fonts, or runtime CDN is required.

## Run locally

Use Node.js 24 LTS and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite, including `/spin-the-wheel-customized/`.

```sh
npm run lint          # ESLint
npm run typecheck     # strict TypeScript checks
npm test             # Vitest engine, timing, import and validation tests
npx playwright install chromium
npm run test:e2e      # actual Chromium browser tests
npm run build        # type checks, production assets, versioned offline cache
npm run preview      # serve the production build
npm run test:production # production asset paths and offline browser test
npm run format       # format source and project configuration
```

## Hosting an event

1. Review **Participants**. Add individually, bulk paste, or import CSV/TXT/JSON. Names are deduplicated case-insensitively, ignoring a leading `@`. Enable/disable entries, set display names, Discord handles, colors and avatars, save presets, or undo the most recent removal.
2. Review **Prize Pool**. Quantities, descriptions, rarity, ordering and images are editable. Presets and JSON import/export are supported.
3. Open **Event Configuration**. Choose Elimination, Winner Selection, or Survival, timing, per-round overrides, automatic/manual rounds, confirmation, scheduled start, rules and announcement text.
4. Try **a separate demo** from the dashboard before hosting. Demo records, settings and results use a different storage key and cannot be imported into official records.
5. Open **Audience view** in the same browser profile and origin, and screen-share that window through Discord. Audience view has presentation controls only. Remote viewers watch the stream; this is not internet-based state synchronization.
6. Begin the event. Participants, prizes and timing are locked. Pause/resume is available. Cancelling records the unfinished event in history.
7. The completed event is archived automatically. Copy Discord announcements, export results/audit records, or download a locally rendered champion PNG. Prizes are recorded for manual distribution; no Roblox items are transferred by this app.

Defaults: the ten specified contenders, eleven reward types totaling **350 items**, elimination mode, 30 minutes per spin, automatic rounds, 10-second intervals. Nine spins plus eight intervals total **4 hours, 31 minutes, 20 seconds**. Demo uses five-second spins and one-second intervals.

## Timing, recovery and fairness

- Web Crypto rejection sampling selects uniformly from the active pool. A Fisher–Yates shuffle also uses Web Crypto.
- The selected participant, snapshot of the selection pool, trajectory, timestamps, duration and pause accounting are committed to localStorage **before** the spin renders. The pointer and result use the same persisted selection.
- Wall-clock timestamps drive completion. Canvas rendering runs separately, is capped near 30 FPS, handles device pixel ratio and stops animation in hidden tabs. Reduced-motion users see a stationary wheel until the final result.
- Paused time is excluded. Refreshing, sleeping or closing a browser does not reroll a stored selection.
- An expired spin is reconciled exactly once when a host runs again. Automatic next rounds start from the time the host resumes processing; missed rounds are not retrospectively simulated. A paused session stays paused. A missed scheduled start begins when a host reopens.
- A powered-off computer cannot execute the application. Keep the device clock accurate; wall-clock changes affect elapsed time. Duration validation permits up to approximately 31 years per round to keep arithmetic bounded, rather than imposing a short event cap.
- Web Locks serialize all state mutations across hosts. BroadcastChannel and storage events synchronize tabs. Requires a secure context (HTTPS or localhost) and a browser supporting Web Locks.
- This is **not tamper-proof**. A person with source, developer-tools or storage access can modify client state. The local audit trail records actions and outcomes but is not an independently authenticated commitment/reveal system.
- Survival duration is a maximum estimate: the event may end sooner if the last survivor has multiple lives. Retained winners can be selected repeatedly in Winner Selection mode.

## Storage, assets and backups

Schema version 1 is validated with Zod. Unknown versions and invalid persisted state are rejected rather than silently overwritten. The original raw data remains downloadable through **Import & export → Export raw recovery data**. Restore a valid full backup or explicitly reset to recover.

Records and preferences use localStorage; images/audio use IndexedDB. Full JSON backups include asset data. A full restore replaces state after validation and confirmation. Keep regular backups outside the browser; clearing browser data removes local records. Storage failures reject the action and display an error instead of advancing a result without saving it.

Participant and prize presets are local. Uploaded assets are capped at 20 MB each; backup imports at 100 MB. CSV exports escape formula-leading characters; participant imports reverse that escape for round-tripping names. JSON event configurations contain asset references; use a **full backup** to move uploaded media to another browser.

A versioned production service worker precaches all build assets. Offline use works after the first successful load and installation. A new build waits until all existing app tabs close, avoiding a forced update during an event. No development service worker is installed. To update after deployment, close every app tab and reopen.

## Appearance and audio

Heavenly, Demonic, Celestial, Minimal Dark, Minimal Light and Custom themes; system sans/serif typography; custom accent/background, logo, centerpiece and background image; participant colors/avatars; two audience layouts; reduced-motion support and effect toggles.

Atmospheric effects use restrained glows, ornaments and transitions rather than flashing lightning or heavy particle simulations. On very large wheels, text is omitted above 100 entries to keep the Canvas readable and efficient; the contender panel remains available.

Web Audio synthesizes built-in sounds locally. Master/music/effect volumes, individual event toggles, custom effects, audio preview and looping uploaded music are available. Click to unlock audio under browser autoplay rules. Choose host **or** audience playback; a separate Web Lock prevents duplicate output across tabs. Multiple simultaneous event streams in the same workspace share that output lock.

## Project layout

```text
src/
  components/        Canvas wheel, event presentation, shared form controls
  data/              Default event, rules, participant and reward data
  engine/            Secure selection, event transitions, timer/trajectory math
  pages/             Participants, prizes, configuration, history and settings
  services/          Serialized persistence/sync, IndexedDB assets, audio, exports
  types.ts           Strict schemas and inferred TypeScript types
  App.tsx            Hash routing, shell and host/audio reconciliation
  main.tsx           React entry, error boundary and offline registration
  styles.css         Responsive dashboard themes and motion styles
scripts/offline.mjs  Content-hashed production service worker generation
tests/               Vitest unit tests
e2e/                 Playwright browser tests
.github/workflows/   GitHub Pages validation and deployment
```

## GitHub Pages

Repository: <https://github.com/VINCENT-DIGITALS/spin-the-wheel-customized>

Expected deployment: <https://vincent-digitals.github.io/spin-the-wheel-customized/>

In **Repository Settings → Pages → Build and deployment**, select **GitHub Actions**. The workflow runs on pushes to `main` and through manual dispatch. It installs with `npm ci`, runs lint/type/unit/browser checks, builds, uploads `dist`, and deploys with the official Pages actions. The deploy job requires every check to pass. Vite's base path is `/spin-the-wheel-customized/` and navigation uses hashes, so deep links work without server rewrites.

If Git authentication is unavailable, sign in using your preferred Git credential manager or GitHub CLI, then run:

```sh
git push -u origin main
```

Do not force-push. If GitHub reports newer remote history, fetch and reconcile it first. Check the repository's Actions tab for the build/deployment result. A configured workflow does not by itself mean the website is deployed.

## Verification

Validated on 26 November 2026 with Node 24 and Chromium:

- Clean `npm ci`: successful; npm audit reported zero vulnerabilities.
- ESLint and strict TypeScript: passed.
- 22 Vitest tests: passed, covering rejection sampling, all three modes, multi-hour recovery, pause/resume, nine unique eliminations, scheduling, imports and invalid backups.
- 8 Playwright application tests: passed, covering UI management, refresh recovery, two hosts, audience sync, actual Canvas stopping color, complete demo, champion PNG, backups, all modes, themes, sound settings and desktop/mobile layouts.
- 1 production Playwright test: passed, including GitHub Pages asset paths and a true offline reload/navigation after service-worker installation.
- Production build: successful.

Browser automation currently covers Chromium. Firefox, Safari, actual multi-day continuous operation and in-person listening tests have not been independently validated. Multi-hour timing is tested with simulated timestamps rather than waiting an entire day. Future storage schema versions require an explicit migration; version 1 currently preserves and rejects unknown versions safely.
