# Ringtrue — Game Design Document

*Studio deliverable — Part 2 of 3. See also [`RESEARCH.md`](./RESEARCH.md) (market research and concept validation — read this first for *why* this design looks the way it does) and [`PRODUCT_PLAN.md`](./PRODUCT_PLAN.md) (monetization, technical architecture, production roadmap).*

> **Naming note.** "Notch" was the research codename used throughout the validation process (RESEARCH.md). It is **not** proposed as the public product name — it collides with an existing, strongly-associated nickname (Markus Persson / Minecraft) that would hurt search discoverability and could read as derivative. **Ringtrue** is the proposed public name (the idiom "that rings true" mirrors the game's fairness-first identity; "ring" is also the literal play object). Both names must clear an actual trademark/App Store name-collision check before launch — see PRODUCT_PLAN.md → Legal/Platform Requirements. This document uses Ringtrue throughout.

## 0. Product Identity

**One-sentence pitch:** Tap the exact instant a sweeping pointer lines up with a shrinking target on a ring — the same ring every player in the world faces once a day.

**Player fantasy:** You are the person who doesn't flinch — the one who can call the exact instant when everyone else jumps early or hesitates late. Every tap is a small proof of composure, and the game exists to keep testing whether you still have it.

**Positioning (stated honestly, per RESEARCH.md §12–14):** Ringtrue does not claim to have invented a new input mechanic — tap-timing-against-a-moving-target is one of the oldest primitives in games (swing meters, QTE bars, carnival reflex-test dials). What it claims, and what the research supports as a genuine, currently-unfilled gap, is being the first title in this specific mechanical family to ship a Wordle-style daily-seeded ritual with a spoiler-free share card as a first-class citizen from day one, wrapped in a monetization model that refuses the industry's most-complained-about patterns (forced ads, ads-at-death, gacha, energy timers, rental subscriptions). The moat is execution, brand, and community — not the tap itself — and the design and roadmap below are built around that honestly rather than around a false novelty claim.

---

## 1. Game Design Document

### 1.1 Core Loop (single run, 10–45 seconds)

1. A pointer sweeps around a ring. Somewhere on the ring is a nested target: a wide **Fair** band around a narrow, high-value **True** sliver.
2. The player taps anywhere on screen at the moment they believe the pointer is inside the target.
3. Instant feedback: **Miss** (outside both bands — run ends), **Fair** (continues the run), or **Perfect** (inside True — continues the run and extends a combo multiplier).
4. On any non-miss, the target relocates to a new position on the ring; the sweep speed and target width shift very slightly toward "harder," up to a hard, deliberately-tuned **master plateau** past which difficulty stops increasing (so elite play is sustainable, not a guaranteed-unwinnable ramp — see §1.5).
5. A miss ends the run instantly. Restart is a single tap, with zero loading and zero re-entry ceremony — "just one more go" is a design requirement, not a slogan.

### 1.2 Meta Loop (across runs and days)

- **Daily Ring** (primary mode, see §1.6): one shared, seeded ring per calendar day (UTC), identical for every player. Completing it produces a result summary and a shareable text card (§1.10).
- **Practice** (secondary mode): unlimited runs against the same rules, using the local device's own seeded PRNG (not the daily seed), for players who want to keep playing without diluting the daily ritual's scarcity.
- Across both modes, a **Precision Journal** (§1.8) accumulates lifetime stats that give experienced players an ever-improvable personal metric even after raw survival plateaus.
- A **streak** tracks consecutive days the Daily Ring was completed (any non-zero result counts — see §1.6 for why).

### 1.3 Controls

A single tap, anywhere on the screen, one-handed, portrait-only. "Anywhere" is literal: the tap target is the full Run screen, not just the visual ring — the HUD margins and hint-text area are equally valid places to tap, so a player never has to aim for a specific rectangle to play. Tap is deliberately the *only* gesture in the game — no swipe, hold, or drag — chosen specifically to avoid the "misregistered gesture" complaint pattern found repeatedly against swipe-driven minimalist games in the competitor research (2048, mobile Tetris; see RESEARCH.md §7). Because the entire input vocabulary is "tap," there is no tutorial-worthy control complexity to teach, and (§2.3) there is deliberately no second, differently-behaving control (like an exit button) competing with it on the same screen.

### 1.4 Rules & Win/Loss

There is no "win" state in the traditional sense — Ringtrue is a survival/scoring game, not a level-completion game. A run ends the instant a tap is judged a Miss, or the instant the player taps outside an active window (there is no time-out; the game waits for exactly one input per lap, indefinitely, so a player is never rushed by anything other than the sweep itself). The Daily Ring additionally ends (regardless of Miss/Fair/Perfect) once its fixed, seed-determined number of laps is reached, so every player's daily attempt is bounded and comparable — an unbounded daily mode would make "how far did you get" incomparable across players with different amounts of free time, undermining the fairness claim the whole mode is built on.

### 1.5 Scoring & Difficulty

- **Score** = laps survived + a combo multiplier that grows with consecutive Perfects and resets (not to zero — see below) on a Fair.
- **Difficulty ramp**: two continuous knobs only — sweep speed and target width — both increase/narrow fractionally on every successful lap, up to a **hard master plateau** (a fixed floor on target width and ceiling on speed). This is a deliberate response to red-team validation (RESEARCH.md §14): an unbounded ramp guarantees every run ends in "the game beat me," which is fine occasionally but corrosive as the *only* outcome; a plateau means a sufficiently skilled player can sustain an arbitrarily long run, converting the late game into a vigilance/consistency test rather than a guaranteed-loss countdown.
- **Non-periodic sweep** (a direct fix for the depth-ceiling risk in RESEARCH.md §14): the sweep is *not* constant angular velocity by default. It carries a gentle, seed-determined variation in speed (subtle acceleration/deceleration across a lap) so players must read the pointer's instantaneous state rather than memorize a fixed rhythm and "entrain" to it — human motor-timing research cited in the validation shows constant-velocity stimuli are rapidly, almost automatically, predicted, which is precisely what caused the original design's fast plateau. This single change is the most load-bearing fix in the whole revision.
- **Combo softening**: a Fair (not a Miss) reduces the combo multiplier by half rather than zeroing it, so a single imperfect-but-successful tap doesn't erase a long run's progress — reduces the "punishing" feeling flagged as a risk without weakening the underlying skill test (a Miss, the only truly disqualifying outcome, still fully ends the run).

### 1.6 Session & Mode Structure

The home screen shows **today's Daily Ring** front and center (mirroring the NYT Games / Wordle pattern of "today's puzzle is the whole home screen"), with **Practice** as a clearly secondary, always-available option — never competing with the daily ritual for the "first thing you see" position, per the business-viability red-team's explicit recommendation to keep "one identical ring per day" the product's primary identity rather than diluting it (RESEARCH.md §14).

- Individual runs: 10–45 seconds.
- A typical open-app session: 3–8 minutes across the Daily Ring plus a handful of Practice runs.
- The daily-ritual portion alone (one Daily Ring attempt plus viewing/sharing the result) is designed to complete in under 60 seconds, so it fits in a single spare moment even on a day with no time for more.

### 1.7 Randomization & Content Generation

- A deterministic seeded PRNG (mulberry32 or equivalent) drives all target placement and sweep-speed variation.
- **Daily seed** = a hash of the UTC calendar date. Every player worldwide who opens the game on the same UTC date gets the identical ring. This is a simple, honest, and *known* tradeoff (documented, not silently accepted): players in early time zones see "tomorrow's" puzzle before players in late time zones relative to their own local clock — the same tradeoff most Wordle-alikes accept rather than engineer away. It is not solved with per-timezone puzzle rotation in the MVP, because that complexity is disproportionate to a small team's ability to maintain it; it is revisited only if soft-launch data shows it materially damages trust (PRODUCT_PLAN.md).
- **Practice seed** = derived from the device clock at run start (genuinely fresh each time), bounded/pre-validated (target placement and speed curve are generated within ranges that are checked, at generation time, to never place an *impossible* target) so a loss never has a legitimate "that wasn't fair" objection — losses should always feel like a timing error, not a bad roll.
- No hand-authored levels, no content pipeline, no music charts — the entire game is generated from ~20 tunable parameters (sweep speed range, band widths, ramp rate, plateau thresholds, non-periodic variation range), which is the structural reason this game can be sustained by a small team (PRODUCT_PLAN.md → Cost/Complexity).

### 1.8 Progression, Rewards, Unlocks, Achievements

Deliberately thin, and deliberately never gameplay-affecting — progression exists to motivate and to give long-horizon goals, never to gate or replace the core skill test (a direct answer to the pay-to-win/gacha complaint pattern in RESEARCH.md §7):

- **Precision Journal** (the primary long-horizon progression system, and the direct fix for "nothing left to master" once raw survival plateaus): tracks lifetime median timing offset (in milliseconds from true-center), a rolling consistency/variance score, longest lap streak, and total Perfects. This is a "practice-journal" pattern borrowed from speedrunning/rhythm-game accuracy breakdowns — a player who has hit the survival plateau can still spend months tightening their median offset and variance, which is a real, legible, ever-improvable goal that doesn't require new content.
- **Cosmetic unlocks** (dial skins, pointer trails, chime packs) gated purely by skill milestones (total Perfects, longest streak, journal consistency thresholds) — never by RNG pulls, never by payment. This directly answers the "skill-gated unlocks instead of gacha" feature request found repeatedly in the competitor research (RESEARCH.md §7).
- **Achievements** are milestone call-outs on the same skill data (first Perfect, first 20-lap run, 7-day streak, sub-30ms median offset) — presented once, unobtrusively, never as a checklist that nags for completion.
- No XP treadmill on the core mechanic itself; arcade purity (the sweep and the tap never get "easier" via a purchased or leveled-up advantage) is preserved absolutely.

### 1.9 Daily / Weekly Systems

- **Streak**: consecutive days the Daily Ring was attempted and completed to any result (even a 1-lap result counts as "played," not just a "good" result) — this is a deliberate choice: gating the streak on *performance* rather than *participation* would punish a bad day twice (once on the scoreboard, once on the streak), compounding the exact streak-anxiety failure mode Wordle itself is known for (RESEARCH.md §11, §14).
- **Streak freezes**: a small number of freezes are *earned* through play (e.g., one per 7-day streak milestone), never purchasable — a missed day doesn't have to end months of habit, but the mechanism can't be bought around, keeping the "no pay-to-progress" line intact.
- **Weekly modifiers** (e.g., a reversed sweep direction, a dual-pointer variant) are explicitly a **P1 feature**, not MVP — see PRODUCT_PLAN.md → Prioritization. Shipping 2–3 hand-authored modifiers is cheap once the core loop is validated; committing to them before validating the core loop risks exactly the "unbudgeted live-ops content cadence" trap the red-team flagged (RESEARCH.md §14).

### 1.10 Leaderboards & Social

**MVP ships no server leaderboard at all** — a direct, deliberate response to the technical red-team's finding that a millisecond-precision, client-reported leaderboard is one of the easiest game mechanics in existence to script, and that building real server-side replay verification is unbudgeted, unstaffed, ongoing infrastructure work that would undercut the "provably fair" brand promise the moment it's shown to be gameable (RESEARCH.md §14). What ships instead:

- A **local personal-best** record (longest run, best Precision Journal stats), always visible, never lost as long as the device/browser storage persists.
- A **shareable text result card** (§1.11) that lets players compare informally with friends without the game itself needing to adjudicate a competition.

Global/friends leaderboards **with real server-side replay verification** are explicitly scoped to P1/P2 — gated on the MVP actually producing evidence (via the share-rate and retention KPIs in PRODUCT_PLAN.md) that this investment is worth making, rather than building trust-critical infrastructure on spec.

### 1.11 Sharing

The daily result renders as a plain, copy-pasteable text/emoji "tick-strip" — one glyph per lap (e.g., `○` miss, `◐` fair, `●` perfect — shapes, not just colors, so the card itself is colorblind-legible), plus the final lap count and current streak flame. This is deliberately **text, not a rendered image** — a direct fix for the friction gap identified in validation (an image share card requires a render/export/screenshot step; a text card pastes instantly into any chat app, matching Wordle's own actual mechanism rather than a heavier reinterpretation of it). Shared via the native Web Share API where available, with a clipboard-copy fallback everywhere else.

### 1.12 Haptics, Animation, Audio Feedback

Covered in full in §5 (Audio & Haptic Specification); the design principle stated here because it constrains the rules above: **all three feedback channels (visual, audio, haptic) independently and completely communicate Miss/Fair/Perfect** — the game is entirely playable, with no information loss, using only one of the three (e.g., muted with haptics off, for a player in a quiet room; or muted and vibration-free for a player who has disabled both, relying on visual feedback alone). See §4 for how this also serves accessibility.

### 1.13 Pause / Resume Behavior

Because a run is 10–45 seconds, "pause" mainly matters for the app being backgrounded mid-run (a call, a notification, switching apps). On any visibility-change/backgrounding event, the current run is safely voided (not scored as a Miss, not scored as a success — simply discarded) and the player returns to the pre-run state on resume. This avoids the two bad alternatives: penalizing a player for an interruption outside their control, or letting backgrounding become an exploit to "pause" an otherwise-losing run.

### 1.14 Offline Behavior

The entire game — including the Daily Ring — is fully playable offline. The daily seed is derived from the device clock, not fetched from a server, so there is no network dependency anywhere in the core loop (a genuine differentiator against most daily-challenge competitors, which typically require a round-trip to fetch the day's puzzle; see PRODUCT_PLAN.md → Technical Architecture). A share action naturally requires connectivity or another installed app to complete, but generating the shareable text does not.

---

## 2. UX/UI Specification

### 2.1 Screen Inventory

1. **Home / Today** — the app's default landing screen. Shows today's Daily Ring status (not started / in progress / completed-with-result), a prominent primary "Play Today's Ring" action, and a secondary, visually quieter "Practice" entry point. Streak flame and current Precision Journal headline stat (e.g., median offset) are visible but small — informative, not competing with the primary action.
2. **Run** — full-bleed canvas: the ring, the pointer, the target bands, and a minimal HUD (current lap count only during Daily Ring; lap count and live combo during Practice). No chrome, no ads, no interstitial of any kind between tapping "Play" and the first sweep starting.
3. **Result** — Miss/Fair/Perfect final state, lap count, combo achieved, streak status, and the share action, presented immediately (no "continue?" upsell, no ad).
4. **Precision Journal / Stats** — lifetime stats (median offset, consistency, longest streak, total Perfects), and the cosmetic-unlock gallery.
5. **Settings** — sound, haptics, reduce-motion, colorblind-safe mode, theme override (auto/light/dark), and (P1+) account/cloud-sync if ever added.

### 2.2 Onboarding — Zero Text, Progressive Disclosure

No modal tutorial, no text overlay, no "swipe to continue" carousel. The very first time the app is opened, the first lap plays with a single, subtle **hint pulse** — the target band glows slightly brighter and pulses once as the pointer approaches it, silently demonstrating "this is where you tap" through the game's own feedback language rather than through instructional text. The hint pulse appears only on the first-ever lap of the first-ever session and never again. This satisfies the brief's "understandable within seconds, taught primarily through interaction" requirement directly, and was independently confirmed as a genuine strength in validation (RESEARCH.md §11: "understandable within seconds... zero tutorial text is credible").

### 2.3 Information Architecture

Two-level navigation only: Home is the root, and Result, Journal, and Settings are each one tap away from Home and one tap back to it. There is no nested menu system, no more than 2 taps to reach any feature in the app — a direct implementation of the brief's "avoid complex menus, avoid large numbers of buttons" requirement.

The **Run** screen is the one deliberate exception, and on purpose: it has no back/exit control at all, because a single tap anywhere on it is the entire input vocabulary (§1.3) and adding a second, differently-behaving tap target (an exit button competing with the play area for the same gesture) would be exactly the kind of control-surface complexity the brief warns against. A run is short (10–45 seconds) and ends on its own; leaving mid-run (switching apps, backgrounding the tab) is handled safely by voiding the run with no penalty (§1.13), which is sufficient — a dedicated "quit" affordance isn't needed for a screen you're never stuck on for long.

### 2.4 Microinteractions

- Tapping "Play Today's Ring" transitions directly into the sweep starting — no loading screen, no fade-to-black longer than ~150ms (long enough to not feel jarring, short enough to never read as a "loading" moment).
- The Result screen's share button performs the share action in a single tap (Web Share API where available); no secondary "are you sure" or "customize your card" step that would introduce friction into the one interaction the whole business model depends on (RESEARCH.md §13).
- Settings toggles apply instantly and visibly (e.g., toggling reduce-motion immediately calms the currently-visible screen), so a player can feel the effect of a setting without needing to back out and test it in a run.

---

## 3. Visual Design System

### 3.1 Principles

Minimalist does not mean unfinished. Every visual element exists to serve gameplay legibility, comprehension, or feedback — there is no decorative element that doesn't also carry information (e.g., the ring's own subtle texture is also the sweep's motion cue).

### 3.2 Color

- **Palette**: a small, restrained set — a neutral ground (near-black slate in dark mode, warm off-white in light mode, never pure #000/#FFF, which reads harshly at both brightness extremes), one accent hue for the pointer/sweep, and two clearly distinct hues for Fair vs. True bands chosen from a colorblind-safe pair (blue/amber rather than red/green), per accessibility research (§4).
- **Redundant encoding**: Fair vs. True vs. Miss is never communicated by color alone — band width itself is different (True is visibly narrower), and the tick-strip share glyphs are distinct shapes, not just colors (§1.11). This satisfies "avoid reliance solely on color" for players with any form of color vision deficiency.
- **Both themes are first-class**, not a dark-mode-only afterthought — see §4 for the full light/dark contrast specification. The game defaults to the OS theme setting and offers a manual override in Settings.

### 3.3 Typography

A system font stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) — deliberately not a licensed/downloaded font. This avoids a network dependency (keeping the offline-first promise intact), avoids font-licensing review (see PRODUCT_PLAN.md → Legal), and matches system text rendering the player is already calibrated to read comfortably. Text is used sparingly (lap count, stats, settings labels) — this is a canvas-first game, not a text-heavy one — and every text element uses relative units (`rem`) so OS-level text-size accessibility settings are respected rather than overridden.

### 3.4 Iconography & Shape Language

A small, consistent vocabulary: circles and rings for the play space, simple geometric glyphs (not skeuomorphic icons) for settings and navigation. The tick-strip share glyphs (§1.11) reuse this same shape language so the share card visually matches the in-game feedback a recipient would recognize if they've played before.

### 3.5 Spacing & Layout

Generous whitespace around the play area at all times — the ring never touches the screen edge, preserving a comfortable one-handed thumb-reach zone on the lower half of the screen for the tap target (the entire screen is tappable, but visual weight is balanced toward reachability). Layout is portrait-only and designed to scale cleanly across phone screen sizes without a tablet-specific layout in the MVP (a P2 consideration if data shows meaningful tablet usage).

### 3.6 Motion Design

Purposeful, restrained animation only: the sweep itself, a brief (under 200ms) scale/glow pulse on Fair, a slightly larger and richer pulse plus a small particle burst on Perfect, and a soft desaturation/settle on Miss (never a jarring shake or flash — see §4 for the full motion-safety specification). Screen shake is off by default and, if added at all, capped to a very subtle amount with an explicit Settings toggle to disable it entirely — never assumed acceptable by default given the brief's eye-comfort requirements.

---

## 4. Eye-Comfort & Accessibility Specification

Accessibility is treated as a day-one architectural constraint, not a post-launch patch — every setting below is designed into the first build, not retrofitted.

| Concern | Design response |
|---|---|
| **Contrast** | Both light and dark themes are tuned to meet WCAG 2.1 AA contrast ratios (4.5:1 for text, 3:1 for the essential graphical distinction between ring, pointer, and target bands) — verified with actual computed contrast ratios (PRODUCT_PLAN.md → Testing Strategy), not assumed from a color picker. **This check caught a real bug during development**: the original light-theme True-band amber (`#c98a1c`) measured only 1.97:1 against the ring track and 2.78:1 against the background, both below the 3:1 minimum. It was replaced with a deeper amber in the same hue (`#8f6214`, 3.6:1 and 5.1:1 respectively) — evidence that "designed for accessibility" and "verified accessible" are different claims, and only the second one should be trusted. |
| **Brightness / color temperature** | Dark mode uses a near-black slate, not pure black (reduces OLED smearing and harsh contrast in low light); light mode uses a warm off-white, not pure white (reduces glare in bright/night viewing). Neither theme is presented as universally "better" — the brief explicitly warns against defaulting everything to dark, and both are full-fidelity options. |
| **Flashing / photosensitivity** | No effect in the game exceeds 3 flashes per second or covers a large fraction of the screen with a high-contrast flash, in line with photosensitive-epilepsy guidance (WCAG 2.3.1). Perfect/combo feedback is a glow and scale pulse, not a strobe. |
| **Motion sensitivity** | A **Reduce Motion** setting (and automatic respect for the OS-level `prefers-reduced-motion` signal) disables particle bursts, screen-shake-if-any, and reduces animation to simple opacity/scale changes — the game remains fully legible and fully fair with motion reduced to a minimum, since motion is never the sole carrier of a hit-judgment signal. |
| **Color blindness** | A dedicated **Colorblind-Safe Mode** strengthens the shape/pattern redundancy already present by default (§3.2) — e.g., adding a subtle texture or outline difference between bands in addition to hue — verified against protanopia, deuteranopia, and tritanopia simulation as a specific QA pass. |
| **Text scaling** | All UI text uses relative (`rem`) units and respects OS-level text-size settings; the canvas HUD text has a minimum enforced size and never shrinks below a legible floor regardless of device pixel density. |
| **One-handed / left/right-handed play** | The entire screen is a valid tap target (there is no fixed-position button the player must reach for during a run), so the game is equally playable one-handed from either hand without a handedness setting being necessary. |
| **Screen-reader compatibility** | The core timing gameplay is not meaningfully screen-reader-accessible (a hard limitation of a millisecond-precision visual/motor task, disclosed honestly rather than glossed over — see PRODUCT_PLAN.md → Risk Register), but all non-gameplay screens (Home, Settings, Journal, Result) are built with semantic HTML and proper ARIA labeling so navigation, stats, and settings are usable with a screen reader even though live play is not. |
| **Sound-independent play** | Every gameplay-critical signal (Miss/Fair/Perfect) is fully conveyed visually and haptically; audio is enhancement only. The game is validated as fully playable with sound muted (see PRODUCT_PLAN.md → Testing Strategy). |
| **Visual density** | The Run screen has effectively one visual object (the ring) plus a minimal HUD — there is no dashboard-style information overload at any point in the core loop. |

---

## 5. Audio & Haptic Specification

### 5.1 Philosophy

Sound and haptics are game feel, not decoration — each cue is tuned to make a correct read *feel* rewarding and an incorrect read feel *informative rather than punishing* (never harsh, buzzer-like, or shaming). Every cue is generated programmatically via the Web Audio API (simple oscillators — sine/triangle waveforms), not licensed audio samples, which sidesteps audio-licensing review entirely (PRODUCT_PLAN.md → Legal) and keeps the app's footprint minimal (PRODUCT_PLAN.md → Technical Architecture).

### 5.2 Cue Design

| Event | Audio | Haptic (where supported) |
|---|---|---|
| Fair | A short, pleasant single tone (a clean major-interval blip) | A single short, light tap pulse |
| Perfect | A brighter, slightly richer two-note tone (a small "sparkle") | A slightly stronger, distinct double-pulse |
| Miss | A soft, low, brief tone — deliberately *not* a harsh buzzer or negative "fail" sound, consistent with the brief's instruction to avoid punishing feedback | A single soft, low-intensity pulse — informative, not jarring |
| Streak milestone / new personal best | A short ascending arpeggio, distinct from in-run feedback so it's recognizable as a meta-level event | A short celebratory pattern, distinct from in-run pulses |

### 5.3 Music Strategy

No looping background music in the MVP. A 10–45-second run is too short for a music layer to meaningfully develop, and the research on visual/eye comfort during longer sessions (players may open the app repeatedly through a day) argues for the game staying quiet and unobtrusive by default rather than adding an audio layer that becomes fatiguing on the 20th open of the day. Ambient/optional music is a P2 experiment (PRODUCT_PLAN.md → Prioritization), not a launch requirement.

### 5.4 Haptics

Implemented via the Vibration API (`navigator.vibrate()`) on supported platforms — primarily Android/Chrome. **iOS Safari does not expose a web haptics API**, a genuine, disclosed platform limitation of the web-first MVP (PRODUCT_PLAN.md → Technical Architecture); haptics on iOS arrive when the game is wrapped natively via Capacitor's Haptics plugin (P1), which can call the Taptic Engine properly. The game never depends on haptics being present — it is confirmatory feedback layered on top of visual and (optional) audio feedback, never the sole signal.

### 5.5 Accessibility Settings

Independent toggles for **Sound** and **Haptics** (not a single combined "mute" switch), plus the Reduce Motion setting in §4 — a player can, for example, keep haptics on while muting sound in a quiet room, or vice versa. All settings persist locally and apply immediately.

---

## 6. Progression & Retention Design

Every retention mechanic below is evaluated against the brief's own test: *"Would players still want this feature if there were no notification reminding them about it?"*

| Feature | Passes the test? | Why |
|---|---|---|
| Precision Journal (median offset, consistency) | **Yes** | It's a personal-best-chasing mechanism with no notification attached at all — the motivation is purely "can I be more consistent than last week," visible only when the player chooses to look. |
| Streak counter | **Partially — by design, not accident** | Streaks have a well-documented dark side (loss-aversion-driven anxiety, and Wordle's own known failure mode of a broken streak causing abandonment rather than resumption — RESEARCH.md §14). The mitigations (participation-based, not performance-based; earned streak-freezes) are specifically there to keep this mechanic closer to "a nice-to-have ritual" than "a guilt trip," and its `streak_broken` rate is tracked as a churn-risk KPI in soft launch (PRODUCT_PLAN.md → Analytics) precisely so this can be corrected or removed if the data shows it's net-negative. |
| Skill-gated cosmetic unlocks | **Yes** | Cosmetics are discovered through play, not chased via a countdown or a notification; a player who never opens Settings/Journal still experiences them appearing naturally as milestones are hit. |
| Daily Ring itself | **Yes, if the mechanic holds up** | The core hypothesis (validated only by real soft-launch data, not assumed — PRODUCT_PLAN.md → Analytics) is that a *fresh, once-a-day, comparable-with-friends* ring is worth opening the app for on its own merits, the same way people solved Wordle before it was a habit built on push notifications. Push notifications, if added at all, are an accelerant on a mechanic that already works — never a substitute for one that doesn't (see Monetization/Retention discipline in PRODUCT_PLAN.md). |
| Weekly modifiers (P1) | **Yes, conditionally** | Designed as "a different, interesting ring to try this week," not as a FOMO-timed event — no countdown pressure, no penalty for skipping a week. |

No feature in this design relies on a countdown timer, an energy/lives system, or a "come back or lose something" penalty — a direct, deliberate contrast with the pain points named repeatedly in the competitor research (RESEARCH.md §7).
