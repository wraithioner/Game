# Product Plan: Monetization, Technical Architecture, Testing, Legal & Roadmap

> **Provenance note:** this is Swerve's product plan, written after a direct
> product override replaced the researched-and-validated concept (Ringtrue)
> with an endless obstacle-dodge runner. See `GAME_DESIGN.md`'s provenance
> note and `RESEARCH.md`'s pivot addendum for the full context, including a
> second revision: the first Swerve build used discrete lanes, which turned
> out not to match the real Dookey Dash (continuous 2D steering in a tunnel,
> no lanes at all) once actually researched - `GAME_DESIGN.md` describes the
> corrected design. Sections here that describe decisions independent of the
> specific core mechanic — the zero-backend architecture, the
> monetization-free MVP scope, the analytics/privacy design, the legal
> posture on synthesized audio and unprotectable game mechanics — carry over
> essentially unchanged across both revisions, because neither pivot touched
> those decisions' underlying reasoning.

## Monetization Strategy

### What players currently accept vs. reject (evidence base)

Unchanged from the original research (`RESEARCH.md` §6-8): forced/failure-
gated interstitial ads and pay-to-win RNG are the most common, most severe
complaint patterns across torn-down competitors, regardless of core
mechanic.

### The MVP monetization decision: none

No ads, no IAP, no accounts. This is a direct, evidence-based response to
the plurality complaint pattern above, not merely an ethical preference, and
it holds regardless of which core mechanic the game uses.

### The P1/P2 monetization plan (once validated)

Deferred until the Daily Run + share-card retention hypothesis is actually
validated with real usage data (see Analytics below) — a cosmetic supporter
pack (alternate player/obstacle palettes) is the most likely first lever,
since it doesn't touch fairness (no purchasable gameplay advantage is
possible in a game with no persistent stats besides distance).

## Technical Architecture

### Stack comparison

Unchanged conclusion from the original research: a web-first PWA beats a
native app for a game whose central unproven hypothesis (does the daily-seed
+ share-card loop actually drive retention?) needs testing before any native
development investment is justified.

### Why web-first is not just an environment workaround

Ship the daily challenge as a free web page first, like Wordle did — the
single highest-leverage way to de-risk the concept's central retention
assumption before committing to app-store distribution and native tooling.

### Client architecture (MVP)

Plain ES modules, no build step, no framework, no bundler. One real runtime
dependency — three.js, for actual WebGL 3D rendering — vendored locally
(`vendor/three/`) rather than pulled from a CDN or package manager at build
time, so it stays within the "no build step" architecture and, critically,
so the service worker can cache it for full offline play (see Backend
below and `GAME_DESIGN.md` §1.14):

- `game.js` — pure deterministic simulation (`SwerveRun`, `createCheckpoint`,
  `speedAtDistance`). No DOM access, no rendering-library dependency, fully
  unit-testable in plain Node.
- `rng.js` — seeded PRNG and seed derivation (`mulberry32`, `dailySeed`,
  `practiceSeed`, `childSeed`).
- `render.js` — the only module that imports three.js. Builds and updates a
  real WebGL scene each frame; reads game state, never decides outcomes.
  Colors are read live from CSS custom properties (single source of truth —
  a duplicated-palette bug in an earlier revision's light theme is exactly
  why this indirection exists).
- `input.js` — continuous drag-to-steer pointer tracking and keyboard event
  handling, translated to plain position/callback values.
- `audio.js` — synthesized Web Audio tones + Vibration API haptics.
- `share.js` — plain-text share-card construction and the native
  share/clipboard fallback chain.
- `storage.js` — localStorage-backed settings/stats/streak persistence, with
  every read/write wrapped in try/catch (private-browsing modes can throw).
- `analytics.js` — in-memory event buffer; no third-party SDK, no network
  transmission in the MVP.
- `main.js` — the only file with DOM/state-machine logic, wiring the pure
  modules above together.

### Backend (deliberately none in the MVP)

No server, no accounts, no sync. The Daily Run's fairness (every player gets
the identical seeded course) comes from deriving the seed from the UTC
calendar date client-side, not from a server call — this is what lets the
entire game work fully offline after first load.

### Hosting

GitHub Pages, deployed via GitHub Actions
(`actions/upload-pages-artifact` + `actions/deploy-pages`), staging only the
runtime files actually needed to serve the game.

### Performance targets

60fps WebGL rendering on mid-tier mobile hardware; the scene is deliberately
cheap (a dozen pooled untextured primitive meshes, simple line geometry for
the tunnel, no shadows) specifically so it stays comfortably within that
budget rather than needing later optimization. The difficulty ramp's hard
speed ceiling (`MAX_SPEED`) and the `VIEW_DISTANCE` fairness margin are both
tuned assuming worst-case input latency, not best-case.

## Analytics Specification

### Privacy-first design principle

No personally identifying data is collected in the MVP. Events are kept in a
small in-memory ring buffer (useful for QA) and never transmitted anywhere;
every call site only ever passes gameplay/settings values, never device or
user identifiers.

### Core event taxonomy

`session_start`, `run_started`, `run_ended`, `first_run_demo_seen`,
`daily_challenge_started`, `daily_challenge_completed`, `streak_extended`,
`streak_broken`, `streak_freeze_used`, `share_card_generated`,
`share_card_shared`, `settings_changed`, `pwa_install_prompt_shown`,
`pwa_install_accepted`, `error_boundary_hit`.

### Pre-launch KPI targets (hypotheses to validate, not promises)

Share rate on a completed Daily Run remains the single primary soft-launch
go/no-go metric, unchanged from the original research's conclusion that
Wordle-scale share-card virality is the concept's central unproven bet
regardless of core mechanic.

## Testing Strategy

Two layers, matching the two kinds of thing that can break:

- **Unit tests** (`test/`, run via `node --test`) cover every pure module —
  the simulation's obstacle-clearing rules, the fairness guarantee
  (exhaustively, across a 500-seed × 20-row sweep), the streak/journal math,
  and the share-card text format. Fast, deterministic, no browser needed.
- **QA scripts** (`qa/`, Playwright-driven, not part of `npm test`) exercise
  the real rendered game in a real headless browser: a general smoke test
  across every screen and setting (`browser-check.mjs`), a scripted "skilled
  player" that reads the debug hook's exposed run state to dodge every
  obstacle correctly and verify the daily distance cap actually ends a run
  as completed (`skilled-play.mjs`), a network/service-worker check
  (`network-check.mjs`), and an analytics-event-firing check
  (`analytics-check.mjs`).

### Automated testing (built alongside the code, not after)

The read-only `window.__swerveDebug` hook (attached only behind an explicit
`?debug=1` query flag) exposes the active run and recent analytics events for
QA scripts to drive and inspect — never write access beyond the same public
methods a real gesture would call, since this is a single-player, offline,
client-only game with no server-authoritative state to protect.

## Security, Privacy & Platform Requirements

### Why the MVP's scope is a genuine compliance simplification

No accounts, no server, no data collection beyond an in-memory,
never-transmitted analytics buffer — this keeps the MVP outside the scope of
most privacy/consent regulation by construction, not by later mitigation.

### Privacy

All persisted state (settings, stats, streak) lives in `localStorage` only,
on-device, never transmitted.

### Children's privacy

No account creation, no data collection, no ads — COPPA/GDPR-K concerns
that apply to those mechanisms don't arise.

### Regional consent & age verification

Not applicable at MVP scope (no data collection requiring consent).

### EU Digital Markets Act / store fees

Deferred until any store distribution or IAP is added (P1/P2) — the MVP
ships as a web page, outside store-fee scope entirely.

### Age rating & content

No violence, no gambling-adjacent mechanics, no loot boxes. Expected rating:
the lowest available tier on any platform this is eventually distributed
through.

### Intellectual property

- **Game mechanic:** not protectable by copyright or (realistically) patent
  — endless obstacle-dodge runners are a well-established, unowned genre
  primitive. The defensible assets are the brand (name, visual identity,
  the checkpoint-strip share-card format) — protect those, don't rely on
  mechanic-level novelty as a moat.
- **Naming:** "Swerve" must clear an actual trademark and app-store
  name-collision search before any commercial distribution — not performed
  as part of this build, flagged as a required pre-launch task.
- **Audio:** all sound is originally synthesized in-engine (Web Audio
  oscillators, `GAME_DESIGN.md` §5), specifically to avoid any
  licensed-audio review burden.
- **Open-source licenses:** the game ships one runtime dependency, three.js
  (MIT licensed), vendored at `game/vendor/three/` with its license file
  alongside it. Playwright is a QA-only dev dependency, not shipped.

### Refunds & purchase expectations

Not applicable — no purchases exist in the MVP.

## Launch & ASO Strategy

### Naming, icon, screenshots

Re-skinned for Swerve's tunnel visual identity (see `game/icons/`); the
underlying ASO best-practices conclusions from the original research
(`RESEARCH.md` §5) — clear, literal iconography over abstract branding —
still apply and were followed in the icon redesign.

### Distribution sequencing

Ship as a free web page first (GitHub Pages), exactly as the original
research concluded, before any native-app or store-distribution investment.

## Production Roadmap

MVP (this build): core loop, daily challenge, streak, share card, PWA/
offline support, accessibility pass, GitHub Pages deploy. P1/P2 (deferred,
not committed): cosmetic supporter pack, server-verified leaderboards,
additional obstacle types.

## Prioritization

Everything not listed under Production Roadmap's MVP scope is explicitly
deferred, not silently dropped — see the Post-Launch Roadmap below for the
specific list.

## Cost / Complexity Assessment

Zero infrastructure cost (static hosting, no backend, no third-party SDK).
The only ongoing cost is engineering time for future feature work.

## Risk Register

- **A client-reported leaderboard would be trivially game-able** — this is
  exactly why no leaderboard ships in the MVP; a server-verified version is
  explicitly gated on the MVP first validating that the investment is worth
  making.
- **The share-card's virality hypothesis may simply not hold** for this
  mechanic the way it held for Wordle — tracked directly via the
  `share_card_generated`/`share_card_shared` event pair as the primary
  soft-launch signal, not assumed to succeed.
- **A broken streak historically drives abandonment, not resumption**
  (Wordle's own known failure mode) — mitigated with earned, never-purchased
  streak freezes and explicit `streak_broken` tracking as a churn-risk
  signal.

## Important Things You Didn't Ask About

1. **The fairness guarantee is enforced algorithmically, not just tuned
   probabilistically** — `createCheckpoint()` deterministically clears the
   last of the tunnel's 4 quadrants whenever all four would otherwise be
   blocked, guaranteeing a survivable path always exists, verified by an
   exhaustive test sweep rather than trusted on the strength of the
   probability distribution alone.
2. **Emoji rendering is inconsistent across platforms** — the share card
   deliberately uses simple, load-bearing Unicode glyphs (`■`/`□`) rather
   than complex emoji, for maximum cross-platform and plain-text-paste
   consistency.
3. **A duplicated color palette caused a real contrast bug in the previous
   concept's light theme** — this is why `render.js` reads colors live from
   CSS custom properties instead of hardcoding a second copy of the palette
   in canvas-drawing code.

## MVP Specification

Everything described in `GAME_DESIGN.md` §0-6 and implemented in `game/src/`
as of this document's writing. No feature described anywhere in this
document beyond that scope has been built.

## Post-Launch Roadmap

Cosmetic supporter pack; server-verified leaderboards (global + friends);
additional obstacle archetypes and rarity-tiered collectibles; deeper
per-run replay/analysis in the Journal screen. None of these are committed —
all are gated on real usage data from the MVP validating the core retention
hypothesis first.
