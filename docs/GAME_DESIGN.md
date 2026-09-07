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

## 0. Product Identity

- **Name:** Swerve
- **One-line pitch:** An endless 3-lane obstacle dash with a daily seeded
  course everyone in the world runs at the same time — dodge, jump, and slide
  your way as far as you can.
- **Genre:** Hyper-casual endless runner / reflex-dodge.
- **Platform:** Mobile-first responsive web (PWA), installable, offline-capable.
- **Session length:** 15 seconds to a few minutes per run, designed for
  single-handed portrait play in short bursts.
- **Monetization:** None at MVP (see `PRODUCT_PLAN.md`).

## 1. Game Design Document

### 1.1 Core Loop (single run, 15 seconds – a few minutes)

The player character auto-runs forward down a 3-lane track. A steady stream
of obstacle rows scrolls toward the player. For each row, the player must
either be in a lane the row leaves clear, or take the correct action (jump
over a low obstacle, slide under a high one) in the lane they're in. Missing
either — wrong lane against a wall, or the wrong/no action against a
low/high obstacle — ends the run immediately. There is no partial credit and
no lives: one mistake ends the run, matching the "high fairness, high
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

Swipe left/right to change lanes, swipe up (or a plain tap) to jump, swipe
down to slide. The whole Run screen is the input surface, not just the
canvas rectangle, so HUD margins and hint text are gesture-active too.
Arrow keys / WASD / space are wired as a full keyboard-only alternative (see
`input.js`), both for desktop play and as a motor-accessibility path that
doesn't require a touchscreen swipe gesture at all.

### 1.4 Rules & Win/Loss

- Loss: the player's current lane, at the exact distance an obstacle row is
  reached, holds an obstacle the player's current action doesn't clear. See
  `clears()` in `game.js` for the exact obstacle/action matrix.
- A **Daily Run** win is reaching `DAILY_DISTANCE_CAP` while still active.
- **Practice** has no win condition — it's an open-ended high-score chase
  that ends only in a collision.

### 1.5 Scoring & Difficulty

Distance traveled is the score. Scroll speed ramps linearly from
`BASE_SPEED` (6 units/sec) to a hard plateau `MAX_SPEED` (16 units/sec) over
`SPEED_RAMP_DISTANCE` (1600 units), then never increases further — so a
skilled player can sustain an arbitrarily long Practice run rather than
facing a guaranteed-unwinnable ramp. `VIEW_DISTANCE` (100 units) is the
fairness-critical constant: at max speed that's still roughly six seconds of
visible warning before an obstacle arrives, comfortably above human reaction
time.

### 1.6 Session & Mode Structure

Two modes only: Daily (seeded by UTC date, capped) and Practice (randomly
seeded per attempt, uncapped). There is no third "endless daily" or ranked
mode at MVP — see `PRODUCT_PLAN.md`'s Prioritization for what's deferred.

### 1.7 Randomization & Content Generation

Every obstacle row is generated deterministically from a seed via
`mulberry32` + a per-row `childSeed` derivation (`rng.js`), so a given seed
always produces the exact same sequence of rows. This is what makes the
Daily Run identical for every player on a given UTC date, and what makes the
run simulation exactly reproducible for testing.

**The fairness guarantee** lives in `createRow()` (`game.js`): each row
independently weights its three lanes between empty/low/high/wall, but if
random weighting would produce a row where every lane is an unclearable
wall, the last lane is deterministically demoted to a jumpable "low"
obstacle. This guarantees at least one survivable choice exists in every row,
regardless of the player's current lane or action state — verified
exhaustively by a 500-seed × 20-row sweep in `game.test.js`, not just argued
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
which lane you're in, what's ahead, whether you're jumping/sliding/running —
is already fully conveyed visually. A missing/blocked `AudioContext` or an
unsupported Vibration API must never break the game, only quiet it (see
`audio.js`).

### 1.13 Pause / Resume Behavior

Backgrounding or navigating away mid-run discards it without penalty — it is
not scored as a collision and never saved to Journal or streak state. There
is no explicit pause control; a single gesture vocabulary (lane/jump/slide)
has no natural "pause" gesture to spare, so backgrounding *is* the pause/quit
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

A first-time player sees a single one-line hint ("Swipe to dodge, jump, or
slide") on their very first run only, cleared the moment they make their
first input. No tutorial screen, no forced walkthrough.

### 2.3 Information Architecture

Home surfaces exactly two calls to action (Play Today's Run, Practice) plus
two secondary entry points (streak flame, Journal) and one settings icon.
The Run screen's HUD is a single distance readout — no secondary score,
combo, or timer competing for attention while dodging.

### 2.4 Microinteractions

Lane changes, jumps, and slides are instantaneous state changes reflected
immediately in both the render and the corresponding audio/haptic cue,
never gated behind a CSS transition that could desync from the actual
collision-relevant game state.

## 3. Visual Design System

### 3.1 Principles

Minimalist geometric: flat shapes and silhouettes, no illustrated character,
no textures beyond the deliberate diagonal-stripe pattern on wall obstacles.
Every obstacle type must be distinguishable by shape and position alone,
never by color alone (colorblind-safe by construction, not by an add-on
mode — see §4).

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

Three obstacle silhouettes, each shape-distinct regardless of color: a
short rounded hurdle at ground level (jump over), a suspended bar with
visible clearance beneath it (slide under), and a full-height diagonally-
striped block (change lanes — never clearable by action). The player is a
plain rounded square that visibly compresses when sliding and lifts with a
ground shadow when jumping.

### 3.5 Spacing & Layout

The run canvas is a fixed 3:5 portrait aspect ratio regardless of viewport,
so lane geometry and obstacle timing read identically across phone sizes;
everything else uses the shared 8/16/24/40px spacing scale defined as CSS
custom properties.

### 3.6 Motion Design

The lane-divider dash pattern scrolls proportionally to distance traveled,
so speed is visually legible even during an obstacle-free stretch. Under
Reduce Motion, this scroll is frozen (its distance information is
secondary, not safety-critical) while the underlying gameplay is unaffected.

## 4. Eye-Comfort & Accessibility Specification

- **Colorblind-safe by construction:** every obstacle type differs in shape
  and screen position (ground-level hurdle vs. suspended bar vs. full-height
  striped wall), never by hue alone. An earlier draft added a separate
  "Colorblind-Safe Mode" toggle with just a canvas outline; it was removed
  entirely once the shape/position encoding above made it redundant dead
  weight rather than a real accessibility feature.
- **Reduce Motion:** a dedicated setting disables the lane-scroll animation
  and all CSS transitions app-wide, independent of the OS-level
  `prefers-reduced-motion` media query (which is also honored automatically).
- **Keyboard alternative:** arrow keys / WASD / space fully replace swipe
  gestures (`input.js`), for players who can't or don't want to use touch
  gestures.
- **Contrast:** every UI and obstacle color is verified against WCAG AA
  numerically (§3.2), in both light and dark themes.

## 5. Audio & Haptic Specification

### 5.1 Philosophy

Audio and haptics are enhancement, never the sole carrier of any
gameplay-critical information (§1.12).

### 5.2 Cue Design

Five cues, each with a distinct timbre matching its action's feel: a quick
rising triangle-wave hop for jump, a falling sine whoosh for slide, a
subtle short blip for lane changes (kept quiet since it can fire rapidly), a
soft low thud for a collision (deliberately not harsh — this happens at the
end of every run, including a first-ever one), and an ascending arpeggio for
completing a Daily Run (`audio.js`).

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
