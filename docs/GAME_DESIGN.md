# Swerve — Game Design Document

> **Provenance note:** this document describes *Swerve*, which replaced the
> originally-researched-and-shipped concept, *Ringtrue* (research codename
> "Notch"). Ringtrue was a one-tap precision-timing dial game, selected
> through the full research/validation process recorded in `RESEARCH.md`.
> After that MVP was built and polished, the person directing this project
> reviewed it and issued a direct, explicit override: they wanted an endless
> obstacle-dodge runner in the style of *Dookey Dash* (Yuga Labs/BAYC), not a
> circular timing mechanic — a request market research alone hadn't surfaced
> as a concept option. See `RESEARCH.md`'s pivot addendum for the full
> account of what carried over from the original research (the daily-seed +
> spoiler-free share-card retention mechanic, the zero-backend architecture,
> the accessibility/fairness engineering discipline) and what didn't (the
> ring-mechanic-specific competitor analysis and risk register). This
> document intentionally mirrors the original's section numbering (§1.9,
> §1.12, §3-4, §5.5, etc.) because those exact references are cited in code
> comments across `game/src/`.
>
> **Second revision note:** the first Swerve build (a 3-lane, swipe-to-snap
> runner) turned out not to actually resemble Dookey Dash once compared
> against real research on that game (see `RESEARCH.md`'s Dookey Dash
> addendum) — the real game has no lanes at all; it's continuous 2D steering
> within a circular tunnel cross-section, viewed from a 3rd-person chase
> camera, with a boost as the one special move (no jump/slide). This document
> now describes that corrected design, which is what's actually implemented.

## 0. Product Identity

- **Name:** Swerve
- **One-line pitch:** An endless tunnel dash with a daily seeded course
  everyone in the world runs at the same time — steer, dodge, and boost your
  way as far as you can.
- **Genre:** Hyper-casual endless runner / reflex-dodge.
- **Platform:** Mobile-first responsive web (PWA), installable, offline-capable.
- **Session length:** 15 seconds to a few minutes per run, designed for
  single-handed portrait play in short bursts.
- **Monetization:** None at MVP (see `PRODUCT_PLAN.md`).

## 1. Game Design Document

### 1.1 Core Loop (single run, 15 seconds – a few minutes)

The player is auto-scrolled forward down an endless tunnel, free to steer
continuously anywhere within its circular cross-section (not locked to
lanes). A steady stream of checkpoints scrolls toward the player, each
holding zero to a few obstacles floating at various positions within that
cross-section. Colliding with an obstacle the player hasn't cleared — a
hazard (never clearable, must be steered around) or a barrier (clearable
only while boosting) — ends the run immediately. There is no partial credit
and no lives: one mistake ends the run, matching the "high fairness, high
stakes" feel of the genre.

### 1.2 Meta Loop (across runs and days)

- **Daily Run** — one seeded course per UTC calendar day, identical for every
  player, capped at `DAILY_DISTANCE_CAP` (1000 distance units). Reaching the
  cap ends the run as a clean "cleared" outcome rather than open-ended
  survival, so every player's daily attempt is directly comparable (see 1.9).
- **Practice** — an uncapped, freshly-seeded run any time, for skill-building
  and idle play between daily resets.
- **Journal** — lifetime and recent-form stats (best distance ever, recent
  average and best, obstacles cleared, runs played, current streak).

### 1.3 Controls

Drag (touch or mouse) to steer: the player's position eases continuously
toward wherever the pointer currently is, via exponential smoothing
(`STEER_EASE_RATE`), not an instant snap — this is a real analog-feeling
steer, not a discrete gesture-per-move like a lane-swap runner. A dedicated
on-screen boost button (plus Space/Shift on keyboard) triggers a timed
boost: faster forward speed, sloppier steering (`BOOST_STEER_MULTIPLIER`),
and the only way through a barrier obstacle. The whole Run screen is the
drag surface, not just the canvas rectangle, but the drag position always
maps into the canvas's own coordinate frame, so steering feels consistent
regardless of where on screen a drag started. Arrow keys / WASD continuously
move the steering target while held, as a full keyboard-only alternative
(see `input.js`), both for desktop play and as a motor-accessibility path
that doesn't require a touchscreen drag gesture at all.

### 1.4 Rules & Win/Loss

- Loss: at the exact distance a checkpoint is reached, the player's current
  position overlaps an obstacle their current boost state doesn't clear. See
  `clears()` in `game.js` for the exact obstacle/boost-state matrix.
- A **Daily Run** win is reaching `DAILY_DISTANCE_CAP` while still active.
- **Practice** has no win condition — it's an open-ended high-score chase
  that ends only in a collision.

### 1.5 Scoring & Difficulty

Distance traveled is the score. Scroll speed ramps linearly from
`BASE_SPEED` (6 units/sec) to a hard plateau `MAX_SPEED` (16 units/sec) over
`SPEED_RAMP_DISTANCE` (1600 units), then never increases further outside a
boost — so a skilled player can sustain an arbitrarily long Practice run
rather than facing a guaranteed-unwinnable ramp. `VIEW_DISTANCE` (100 units)
is the fairness-critical constant: at max speed that's still roughly six
seconds of visible warning before an obstacle arrives, comfortably above
human reaction time and far more than enough time to steer anywhere in the
tunnel's cross-section given the steering ease rate.

### 1.6 Session & Mode Structure

Two modes only: Daily (seeded by UTC date, capped) and Practice (randomly
seeded per attempt, uncapped). There is no third "endless daily" or ranked
mode at MVP — see `PRODUCT_PLAN.md`'s Prioritization for what's deferred.

### 1.7 Randomization & Content Generation

Every checkpoint's obstacles are generated deterministically from a seed via
`mulberry32` + a per-checkpoint `childSeed` derivation (`rng.js`), so a given
seed always produces the exact same sequence of checkpoints. This is what
makes the Daily Run identical for every player on a given UTC date, and what
makes the run simulation exactly reproducible for testing.

**The fairness guarantee** lives in `createCheckpoint()` (`game.js`): the
tunnel's circular cross-section is divided into 4 quadrants, and at most 3
of them may hold an obstacle — the 4th is always left completely clear, so a
full quarter of the tunnel (any radius, that quadrant's whole 90° arc) is
always a safe, reachable escape route regardless of where the player
currently is or what they're mid-boost doing. This guarantees at least one
survivable path exists at every checkpoint — verified exhaustively by a
500-seed × 20-checkpoint sweep in `game.test.js`, not just argued
probabilistically.

### 1.8 Progression, Rewards, Unlocks, Achievements

None at MVP beyond the Journal's own personal-best tracking and the streak
system (1.9). No purchasable or unlockable cosmetics, no achievement badges —
kept out deliberately to match the MVP's zero-monetization, zero-account
scope (`PRODUCT_PLAN.md`).

### 1.9 Daily / Weekly Systems

The streak counts **participation, not performance** — any Daily Run
attempt, even one ending in an immediate collision, extends the streak,
specifically to avoid punishing a bad run twice. A gap of exactly one missed
UTC day consumes an earned freeze if one is available; freezes are earned
(never purchased) at every 7-day streak milestone, tracked relative to the
*current* streak so a freshly-rebuilt streak can re-earn a freeze an earlier,
broken streak already spent (see `storage.js`'s `updateStreakOnDailyAttempt`
and its dedicated regression test).

### 1.10 Leaderboards & Social

None at MVP — no server, no accounts, so no server-verified leaderboard is
possible without a scope change (see `PRODUCT_PLAN.md` Risk Register on why
a client-reported leaderboard is a bad idea to ship at all).

### 1.11 Sharing

A Wordle-style, spoiler-free, plain-text share card: a 10-glyph checkpoint
strip (`■`/`□`) showing proportional progress toward the day's distance cap,
plus the distance reached or "cleared the course," plus the current streak
if above 1 day. Deliberately plain Unicode rather than a rendered image or
complex emoji, for maximum copy-paste compatibility across chat apps (see
`share.js`).

### 1.12 Haptics, Animation, Audio Feedback

Audio (synthesized Web Audio tones, no licensed samples) and haptics
(Vibration API) are pure enhancement. Every gameplay-critical signal —
where you are in the tunnel, what's ahead, whether you're boosting — is
already fully conveyed visually. A missing/blocked `AudioContext` or an
unsupported Vibration API must never break the game, only quiet it (see
`audio.js`).

### 1.13 Pause / Resume Behavior

Backgrounding or navigating away mid-run discards it without penalty — it is
not scored as a collision and never saved to Journal or streak state. There
is no explicit pause control; the steer/boost input vocabulary has no
natural "pause" gesture to spare, so backgrounding *is* the pause/quit
action (see `main.js`'s `voidCurrentRun`).

### 1.14 Offline Behavior

The entire game — including the Daily Run, which derives its seed from the
device clock rather than a server call — needs zero network access after
first load. A service worker caches the full app shell with a commit-SHA
cache key, so a stale deploy never leaves a client silently stuck on old
code (see `sw.js` and `PRODUCT_PLAN.md` Technical Architecture).

## 2. UX/UI Specification

### 2.1 Screen Inventory

Home, Run, Result, Journal, Settings. Five screens total, matching the
two-mode, no-account scope — there is deliberately no separate onboarding
flow, leaderboard screen, or store screen.

### 2.2 Onboarding — Zero Text, Progressive Disclosure

A first-time player sees a single one-line hint ("Drag to steer · tap ⚡ to
boost") on their very first run only, cleared the moment they make their
first input. No tutorial screen, no forced walkthrough.

### 2.3 Information Architecture

Home surfaces exactly two calls to action (Play Today's Run, Practice) plus
two secondary entry points (streak flame, Journal) and one settings icon.
The Run screen's HUD is a single distance readout — no secondary score,
combo, or timer competing for attention while dodging.

### 2.4 Microinteractions

Steering is a continuous, live-updating render every frame, never gated
behind a CSS transition. Boosting triggers an immediate visual (a glow
around the player) and audio/haptic cue, reflected the instant the input
fires, so it never desyncs from the actual collision-relevant game state.

## 3. Visual Design System

### 3.1 Principles

Minimalist geometric: flat shapes and silhouettes, no illustrated character,
no textures. Every obstacle type must be distinguishable by shape alone,
never by color alone (colorblind-safe by construction, not by an add-on
mode — see §4). The camera itself is a pseudo-3D chase view down a receding
tunnel (see §3.6) — a real perspective-divide projection drawn with plain 2D
canvas primitives (arcs, lines, simple polygons), not a 3D engine or any
textured/lit rendering, so the "minimalist geometric" mandate extends to the
camera trick itself, not just to individual sprites.

### 3.2 Color

A single source of truth: CSS custom properties in `styles.css`, read live
via `getComputedStyle` inside `render.js` rather than duplicated as
hardcoded hex values in canvas drawing code (a bug class the previous
concept hit once already — see the contrast-bug comment history in
`styles.css`). Every new color is verified against WCAG's 3:1 non-text
contrast minimum computationally (a small script, not eyeballing) before
shipping — `--accent-danger`'s violet was chosen this way, verified at 5.5:1
(light) / 8.5:1 (dark) against the background.

### 3.3 Typography

System font stack only (`system-ui, -apple-system, "Segoe UI", Roboto,
sans-serif`) — no webfont download blocks first paint, and every platform
renders in its own native, most-legible system face.

### 3.4 Iconography & Shape Language

Two obstacle silhouettes, each shape-distinct regardless of color: a
spinning 4-pointed cross for a hazard (never clearable — must be steered
around), and a plain rectangular plank for a barrier (clearable only while
boosting). The player is a plain rounded square that gains a soft glow when
boosting.

### 3.5 Spacing & Layout

The run canvas is a fixed 3:5 portrait aspect ratio regardless of viewport,
so tunnel geometry and obstacle timing read identically across phone sizes;
everything else uses the shared 8/16/24/40px spacing scale defined as CSS
custom properties.

### 3.6 Motion Design

The camera is a pseudo-3D chase view: a perspective-divide projection
(`scale = CAMERA_Z / (CAMERA_Z + aheadDistance)`) maps every obstacle's
tunnel-relative position and the tunnel's own concentric depth rings onto
screen space, so distant obstacles shrink toward a vanishing point near the
top of the screen and grow as they approach — a real "flying down a tube"
depth cue built entirely from 2D canvas arcs and lines, not a 3D engine (see
`render.js`). The tunnel's depth-ring phase scrolls proportionally to
distance traveled, so speed is visually legible even during an
obstacle-free stretch. Under Reduce Motion, that scroll is frozen and
obstacle spin animation is disabled (this information is secondary, not
safety-critical) while the underlying gameplay and the boost glow indicator
remain fully visible.

## 4. Eye-Comfort & Accessibility Specification

- **Colorblind-safe by construction:** the two obstacle types differ in
  shape (spinning cross vs. plank), never by hue alone. An earlier draft
  added a separate "Colorblind-Safe Mode" toggle with just a canvas outline;
  it was removed entirely once shape-based encoding made it redundant dead
  weight rather than a real accessibility feature.
- **Reduce Motion:** a dedicated setting disables the tunnel's depth-ring
  scroll, obstacle spin, and all CSS transitions app-wide, independent of
  the OS-level `prefers-reduced-motion` media query (which is also honored
  automatically). The boost glow stays a static (non-pulsing) indicator
  under this setting rather than disappearing, so boost state is never
  conveyed by animation alone.
- **Keyboard alternative:** arrow keys / WASD continuously steer, and
  Space/Shift boosts, fully replacing drag gestures (`input.js`), for
  players who can't or don't want to use touch/pointer input.
- **Contrast:** every UI and obstacle color is verified against WCAG AA
  numerically (§3.2), in both light and dark themes.

## 5. Audio & Haptic Specification

### 5.1 Philosophy

Audio and haptics are enhancement, never the sole carrier of any
gameplay-critical information (§1.12).

### 5.2 Cue Design

Three cues, each with a distinct timbre matching its meaning: a quick rising
sawtooth surge for boost, a soft low thud for a collision (deliberately not
harsh — this happens at the end of every run, including a first-ever one),
and an ascending arpeggio for completing a Daily Run (`audio.js`). Steering
itself is continuous and silent - there's no discrete "move" event left to
cue, unlike a lane-swap runner's per-move blip.

### 5.3 Music Strategy

No background music at MVP — a deliberate scope cut, not an oversight,
consistent with the zero-licensed-asset policy (`PRODUCT_PLAN.md` -
Intellectual property).

### 5.4 Haptics

Short, distinct vibration patterns paired to each audio cue via the
Vibration API, silently no-op on platforms without support (notably iOS
Safari).

### 5.5 Accessibility Settings

Sound and haptics are independent toggles — a player can keep haptics while
muting sound, or vice versa, rather than one combined "effects" switch.

## 6. Progression & Retention Design

The single retention mechanic is the Daily Run + streak system (§1.9),
carried over unchanged in mechanism from the original research
(`RESEARCH.md` §13's daily-seed-plus-share-card finding), only re-skinned
from a ring-timing result to a distance/checkpoint-strip result. No other
progression system (levels, unlocks, battle pass) ships at MVP.
