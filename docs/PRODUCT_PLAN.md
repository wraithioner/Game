# Product Plan: Monetization, Technical Architecture, Testing, Legal & Roadmap

*Studio deliverable — Part 3 of 3. See also [`RESEARCH.md`](./RESEARCH.md) (market research and concept validation) and [`GAME_DESIGN.md`](./GAME_DESIGN.md) (the design spec).*

## Monetization Strategy

### What players currently accept vs. reject (evidence base)

Research (RESEARCH.md §3–5, §7) converges cleanly: players tolerate monetization they control and understand (opt-in rewarded ads, a single clearly-priced one-time purchase) and reject monetization that is forced, deceptive, or extractive (interstitials, ads gated behind failure, pay-to-win IAP, weekly-rental subscriptions, opaque energy timers, RNG loot boxes). The clearest quoted evidence: rhythm/reflex nostalgia players are in open, documented revolt against weekly subscription pricing on games they already love, while fully premium peers in the same cluster post far higher sentiment scores.

### The MVP monetization decision: none

**The MVP ships with zero monetization** — no ads, no IAP, no subscription. This is not a values statement made in place of a business model; it is a sequencing decision made for a specific, falsifiable reason: every validation pass on this concept (RESEARCH.md §11–14) converged on the same conclusion — the entire business case depends on an unproven assumption (does a daily-seed-plus-share-card loop actually drive organic virality for *this* mechanic, the way it did for Wordle and did *not* for most Wordle-alikes that tried it). Optimizing monetization before that question is answered risks the exact trap the brief warns against: "a metric improvement that damages player experience is not automatically a product improvement," compounded here by the fact that the metric wouldn't even be measuring the right thing yet. The MVP's only job is to produce a real answer — via the share-rate and retention KPIs in the Analytics section — before a single monetization decision is locked in.

### The P1/P2 monetization plan (once validated)

If soft-launch data (Production Roadmap, Phase 8) shows the retention/virality hypothesis holds:

| Lever | Design | Rationale |
|---|---|---|
| **One-time "Supporter" purchase** | A single, consistently-priced (adjusted per App Store/Play regional pricing tiers, not a single global price that over/under-monetizes by market) unlock for the full cosmetic set (dial skins, pointer trails, chime packs) plus a small number of extra streak-freezes | Matches the strongest-performing, least-complained-about monetization lever found across all 30 competitors (RESEARCH.md §7) — a single clear price, never a subscription |
| **Opt-in rewarded video** | Strictly player-initiated — e.g., preview a locked cosmetic, or reveal a global percentile stat — never shown automatically, never gating a retry or continue | Directly avoids the "ads at the moment of failure" complaint pattern that is the single most severe recurring complaint in the competitor research |
| **No forced interstitials, ever** | Not deferred, not "maybe later" — structurally absent from the design | The brief's core instruction ("clearly separate monetization from difficulty manipulation... don't destroy the gameplay loop with advertising") is treated as a hard constraint, not a soft preference |
| **No gacha, no loot boxes, no energy timers, no pay-to-win** | Structurally impossible — there is no premium currency, no randomized reward, no session-gating timer anywhere in the design | Direct response to the single most consistent negative-sentiment driver across the competitor teardown |

### Expected conversion mechanism, honestly assessed

This model is **explicitly not** optimized for maximum near-term ARPDAU — it forgoes the two levers (forced interstitials, ad-gated continues) that fund most of this genre's revenue at scale, a tradeoff the business-viability red-team named directly (RESEARCH.md §14: "a plan that openly says 'we forgo the aggressive levers, so we're betting on virality instead' is naming its own single point of failure, not mitigating it"). The honest expectation, stated plainly rather than oversold: this is a small/indie-scale revenue model most comparable to Threes! or A Dance of Fire and Ice (critically loved, modest but sustainable revenue for a small team) rather than a venture-scale hit — and the roadmap and team-sizing in this plan are calibrated to that expectation, not to a larger one (see Production Roadmap, "picking a lane on ambition"). If soft-launch data shows a materially larger opportunity than expected, monetization intensity can be revisited deliberately — but the plan is built to be sustainable at the honest, smaller scale first.

### Pricing architecture (P1/P2, once added)

- Supporter Pack: a single mid-single-digit-dollar price point (regionally adjusted via the platform's own pricing tiers), never a subscription.
- No consumable currency, no "gems," no secondary purchasable resource — one purchase, one durable unlock.

### Long-term sustainability

Sustainable at the honest small/indie scale described above requires low, largely-fixed ongoing costs (no server leaderboard to operate in the MVP/early phases, no live-ops content treadmill beyond occasional P1 weekly modifiers) — the monetization plan and the technical architecture (PRODUCT_PLAN.md → Technical Architecture) are deliberately sized to match each other, rather than a lean monetization plan sitting underneath an expensive live-service backend it can't fund.
## Technical Architecture

### Stack comparison

| Option | Fit for this game | Verdict |
|---|---|---|
| **Native iOS (Swift/SpriteKit) + Native Android (Kotlin)** | Best possible input latency and platform polish, but doubles engineering effort for a single-screen, low-content minimalist game where the whole point is a fast, cheap MVP. Two codebases to keep in sync for a game this small is disproportionate. | Rejected for MVP; reconsider only if the game validates and needs frame-perfect competitive esports-grade timing. |
| **Unity** | Industry-standard for 2D/3D mobile games, excellent tooling for juice (particles, animation, physics), huge asset/plugin ecosystem, one codebase → both platforms. Overhead: larger app size (typically 30–80MB+ baseline), a full editor/build pipeline that's arguably heavier machinery than a single-screen tap game needs, and (relevant to *this* build) no Unity Editor is available in this development environment. | Strong production-scale candidate; not usable for the prototype built in this session. |
| **Godot** | Free, open-source, lighter-weight than Unity, good 2D pipeline, smaller app size, GDScript is fast to write in. Smaller plugin ecosystem and hiring pool than Unity. | Solid alternative to Unity for a v2 native rebuild; not usable for the prototype built in this session (no Godot binary available here either). |
| **Flutter** | Single codebase, good performance for UI-driven apps, but its rendering model is a less natural fit for a physically-simulated, timing-critical canvas game than a game engine or raw canvas/WebGL. | Not chosen — better suited to app-shaped products than a twitch-timing game loop. |
| **React Native** | Same UI-app framing issue as Flutter, plus historically weaker support for tight animation-loop timing without dropping to native modules anyway. | Not chosen. |
| **Web (HTML5 Canvas + vanilla JS) → PWA now, Capacitor-wrapped native later** | Zero install friction (playable via a URL — directly de-risks the daily-share-card virality loop the whole concept depends on, see RESEARCH.md §11–14), fully offline-capable via a service worker, tiny footprint, trivial to test headlessly (Playwright/Chromium), and the exact toolchain actually available in this environment (Node 22, Chromium pre-installed, no engine binaries). Ships as a static site; the *same* static assets later drop into a Capacitor shell for App Store / Play Store submission with zero rewrite, only added native plugins (Haptics, StoreKit/Billing). Real costs: worse haptic fidelity than a true-native app until wrapped, and a hand-rolled rendering/input layer instead of an engine's battle-tested one. | **Selected**, for both the MVP validation phase and — because it converts a real environment constraint into the exact go-to-market strategy the red-team validation independently recommended — the actual soft-launch plan (see PRODUCT_PLAN.md → Production Roadmap, Phase 8). |

### Why web-first is not just an environment workaround

This decision would be defensible even with a full Unity/Xcode/Android Studio toolchain available, for three independent reasons converging on the same answer:

1. **The retention/virality hypothesis needs to be tested before it's expensive to test.** The single biggest open risk flagged in every validation pass (RESEARCH.md §11–14) is whether a Wordle-style daily-share-card loop actually drives organic growth for *this* mechanic — an outcome that failed for most "Wordle-likes" that tried it. A free, install-less web build is the cheapest possible way to get a real answer before committing a native build's engineering budget.
2. **Zero-install-friction is load-bearing for the daily-ritual hook itself**, not just a nice-to-have — Wordle's own growth curve depended on being a URL, not an app-store listing.
3. **A native store submission adds real, non-engineering lead time** (App Store review, age-rating questionnaires, privacy nutrition labels, Data Safety forms — see Legal/Platform section below) that a pre-launch web validation phase sidesteps entirely.

### Client architecture (MVP)

Plain ES modules, no bundler, no framework, no TypeScript — deliberately matching the game's own minimalist design philosophy and avoiding build-step overhead disproportionate to a small codebase. (A bundler and/or TypeScript is a reasonable, low-risk addition once the codebase grows past the MVP — noted as a P2 engineering task, not a blocker.)

- `index.html` — shell, canvas element, minimal semantic HUD (score, streak, settings button).
- `src/rng.js` — deterministic seeded PRNG (mulberry32) + daily-seed derivation from a UTC calendar date.
- `src/game.js` — core simulation: fixed-timestep update loop, state machine (idle → playing → result), scoring.
- `src/input.js` — pointer input, reading raw event timestamps (`event.timeStamp` / high-res `PointerEvent`) rather than "state at last rendered frame," so a slow frame never silently shifts a hit judgment.
- `src/render.js` — canvas 2D rendering, reduced-motion-aware. Reads its palette live from the page's CSS custom properties (`getComputedStyle(document.documentElement)`) rather than keeping a second, duplicated color table — a duplicated palette is exactly how a light-mode contrast bug (see GAME_DESIGN.md §4) shipped unnoticed during development; there is now exactly one place the color tokens are defined.
- `src/audio.js` — Web Audio API synthesized tones (oscillators, no licensed audio files — sidesteps audio-licensing review entirely, see Legal section) + `navigator.vibrate()` haptics wrapper (no-ops gracefully where unsupported, e.g. iOS Safari).
- `src/share.js` — text/emoji result-card generator + Web Share API / clipboard fallback.
- `src/storage.js` — `localStorage`-backed personal stats, streak, and settings (no account, no login, no server in the MVP — see Monetization/Retention design for why this is a deliberate scope cut, not an oversight).
- `src/analytics.js` — the event taxonomy below (Analytics Specification), instrumented at every call site now so a real provider is a one-line swap later rather than a re-audit of the whole app; in the MVP it only buffers events in memory (nothing is sent anywhere - no SDK, no network call).
- `manifest.json` + `sw.js` — PWA installability and full offline play (the daily seed is derived from the device clock; nothing requires a network round-trip).
- `styles.css` — the visual design system (see GAME_DESIGN.md), with `prefers-color-scheme` and `prefers-reduced-motion` support baked in from day one.

### Backend (deliberately none in the MVP)

The MVP ships **no server component at all**: no accounts, no server-authoritative leaderboard, no live-ops backend. This is a direct response to the red-team finding that a millisecond-precision, client-reported leaderboard is trivially bot-able, and that a "provably fair" brand promise built on an unbudgeted anti-cheat pipeline is a reputational liability, not a differentiator, until it's actually funded and staffed. Global/friends leaderboards with real server-side replay verification are scoped as a P1/P2 feature, once the free web MVP has produced real evidence that the retention loop justifies that investment (see Production Roadmap).

### Hosting

**GitHub Pages**, deployed automatically from this repo via `.github/workflows/deploy.yml`. This is a deliberate match to the "no backend" architecture above, not just a convenient default: the entire game is static files, GitHub Pages is free for a public repo, and it keeps deployment inside the same repo/CI the code already lives in rather than introducing a separate hosting account and its own credentials to manage — proportionate infrastructure for a small, honestly-scoped MVP, per the brief's instruction not to overengineer. The deploy workflow runs the full unit test suite before every deploy (a bad build cannot ship), stages only runtime files (excluding `qa/` scripts and other dev tooling from the published site), and auto-versions the service worker's cache name with the deployed commit's SHA so a stale-cache bug can never ship because someone forgot to bump a version string by hand. If traffic or reliability needs ever outgrow GitHub Pages, the identical static output moves to any CDN/static host with no code changes.

### Performance targets

| Target | Value | Rationale |
|---|---|---|
| Frame rate | 60fps sustained on a mid-range 2022-class Android device; uncapped up to device refresh rate (90/120Hz) where available | A timing-precision game is uniquely sensitive to frame pacing; dropped frames directly corrupt the core mechanic, not just visual smoothness. |
| Input-to-judgment latency | Judged against the raw input event timestamp, not the next rendered frame | Removes render-pacing jitter from the fairness-critical path (see GAME_DESIGN.md fairness notes). |
| Cold start | Under 2 seconds to interactive on a mid-range device over a real-world 4G connection; near-instant on repeat visits via service-worker cache | First-session drop-off is unforgiving in casual mobile; this is table stakes, not aspirational. |
| App/page weight | Under 2MB total transferred on first load (no engine runtime, no licensed audio/font assets) | A genuine structural advantage of the chosen stack — directly relevant to low-end-device and emerging-market reach. |
| Memory | Under 100MB active heap on low-end devices | Canvas 2D + no engine overhead makes this comfortably achievable; stated as a regression-test budget, not a stretch goal. |
| Battery | No sustained background work; simulation and rendering both pause fully on tab/app backgrounding | Directly addresses the "battery drain" complaint pattern found in review-mining research (RESEARCH.md §4/§7). |
| Offline | 100% of core gameplay (including the daily challenge) fully functional with no network connection | A genuine differentiator against most "daily challenge" competitors, which typically require a server round-trip to fetch the day's puzzle. |

Device compatibility floor: the last 4 years of mid-range Android devices (Android 10+) and iOS 15+, tested explicitly on at least one budget-tier Android device given the research finding that Android audio/haptic latency varies 100–300ms versus iPhone's <20ms — the game's audio/haptic feedback is designed as pure enhancement (see GAME_DESIGN.md), never as the sole source of truth for a hit judgment, specifically to keep the game fair on that hardware tier.
## Analytics Specification

### Privacy-first design principle

No personally identifying data is collected in the MVP. There is no login, no account, no device advertising identifier requested, and no third-party ad/attribution SDK in the MVP build (there is nothing to advertise around — monetization is deferred, see Monetization Strategy). Where analytics are added, they will use a privacy-respecting, cookie-less, aggregate-only provider (e.g. Plausible-style page analytics) rather than an individual-level tracking SDK, and every event schema below is designed to answer a product question without needing to identify a person. This is a genuine constraint the design should keep even after monetization is added — an ad/attribution SDK's own data practices become part of the App Store Privacy Nutrition Label and Google Play Data Safety disclosure regardless of what the game itself collects (see Legal/Platform Requirements), so minimizing SDK surface area is a compliance simplification, not just an ethical stance.

### Core event taxonomy

Every event below is implemented and firing (`src/analytics.js`, wired into `src/main.js` at each call site; verified end-to-end by `qa/analytics-check.mjs`) — not aspirational. In the MVP they are only buffered in memory and never transmitted anywhere, per the privacy-first principle above; pointing them at a real provider later is a one-line change in `analytics.js`, not a re-audit of the app.

| Event | Fires when | Key properties | Answers |
|---|---|---|---|
| `session_start` | App/page opens | is_pwa_install, referrer_type (organic/share-link/direct), device_tier | Acquisition channel mix |
| `first_run_demo_seen` | The zero-text onboarding hint plays | — | Onboarding reach |
| `first_lap_result` | The player's very first scored attempt | result (miss/fair/perfect), ms_offset | Time-to-first-fun; is the first attempt frustrating |
| `run_started` / `run_ended` | Each practice/endless run | mode, duration_ms, laps_survived, result_sequence | Session shape, difficulty perception |
| `daily_challenge_started` / `daily_challenge_completed` | The daily mode | day_index, completed (bool), result_summary | Daily engagement — the single most important funnel in this game |
| `streak_extended` / `streak_broken` / `streak_freeze_used` | Streak state changes | streak_length_at_break | Validates or invalidates the streak-anxiety risk flagged in validation |
| `share_card_generated` / `share_card_shared` | Result card created / actually shared via OS share sheet or copy | destination (if resolvable, e.g. "clipboard" vs OS share target class) | The core virality hypothesis this whole concept is betting on — the most important metric in the whole spec |
| `settings_changed` | Any accessibility/audio/haptic/motion setting toggled | setting_name, new_value | Real-world accessibility feature usage — validates whether the feature is worth its maintenance cost |
| `pwa_install_prompt_shown` / `pwa_install_accepted` | Install prompt lifecycle | — | Install-less-to-installed conversion |
| `error_boundary_hit` | Any unhandled exception, caught and reported | error_type, stack_hash (not full stack, to avoid accidentally capturing anything sensitive) | Crash/quality signal without a full crash-reporting SDK |

Deliberately **not** collected in the MVP: precise geolocation, contact/social-graph data, anything from the clipboard other than what the game itself writes to it, raw device identifiers.

### Pre-launch KPI targets (hypotheses to validate, not promises)

| KPI | MVP target | Why this number | Confidence |
|---|---|---|---|
| Time-to-first-fun (open → first completed lap) | Under 10 seconds | Brief requirement: near-zero onboarding friction | Design target |
| D1 retention | 25–35% | Reasonable range for a genuinely no-friction, no-login casual daily-puzzle-adjacent web game; NYT-scale daily games (with a large existing owned audience) run higher — this is a cold-start, unbacked launch and should be judged against comparable indie daily-puzzle debuts, not against Wordle's post-acquisition numbers | **Hypothesis — to be tested, not assumed** |
| D7 retention | 10–15% | Streak-driven daily games see a real cliff around day 7 (habit-formation window); this is the number that tells us whether the daily ritual is working at all | **Hypothesis** |
| D30 retention | 4–8% | The number that actually determines whether this is a viable long-term product versus a fun toy that gets abandoned | **Hypothesis** |
| Share rate (shares / daily-challenge completions) | 3–8% | Wordle-scale virality (the load-bearing assumption in every finalist concept, see RESEARCH.md) would show meaningfully higher; most "Wordle-likes" that failed to break out plateaued well under this | **This is the single number the whole business case lives or dies on — treat as the primary soft-launch go/no-go metric, not a vanity metric** |
| Sessions/DAU | 1.3–2.5 | Distinguishes "opened once for the daily puzzle and left" from "also played practice mode" | Design target |

No monetization KPIs (ARPDAU, LTV, conversion) are defined for the MVP, because monetization is deliberately not present in the MVP (see Monetization Strategy). Defining and chasing a revenue metric before the retention/virality hypothesis is validated is exactly the "optimizing a metric that damages player experience" trap the brief warns against.

## Testing Strategy

| Phase | What's tested | Method | Key hypotheses |
|---|---|---|---|
| Concept testing | Is the pitch understood and appealing in one sentence, sight unseen | 5–10 informal outside readers of the one-line pitch + a static mockup, before any code | "Can a cold reader guess how to play from the pitch alone?" |
| Prototype testing (this session's build) | Core loop feel, input fairness, first-session comprehension | Self-play + automated Playwright interaction tests (see below) | "Does the core mechanic feel good within the first 10 seconds?" |
| First-time-user testing | Zero-text onboarding actually works | Watch 5+ people who have never seen the game open it cold, with no instruction, observe (not ask) whether they complete a first successful lap unprompted | "Do people need the text we deliberately didn't write?" |
| Usability / accessibility | Settings discoverability, colorblind-safe legibility, reduced-motion correctness, one-handed play | Manual pass against WCAG 2.1 AA contrast ratios, a colorblindness simulator (protanopia/deuteranopia/tritanopia), and testing with sound fully muted and with `prefers-reduced-motion` forced on | "Is the game still fully playable and fair with every accessibility setting engaged simultaneously?" |
| Game feel / difficulty | Is the difficulty ramp fair-feeling vs. frustrating; is the "master plateau" placed correctly | Instrumented playtesting sessions with a small external group across a skill range (not just the internal team, who will be unrepresentatively skilled by the time of testing) | "Where do casual players actually give up, and does that match where the design intends the ramp to be gentle?" |
| Visual comfort | No flashing/strobing, comfortable in both themes, comfortable in a dark room at night | Manual review against photosensitive-epilepsy guidance (no more than 3 flashes/second, no large-area high-contrast flashing), plus real-device testing in a dark room at both minimum and maximum brightness | "Would this be comfortable in a 20-minute session late at night?" |
| Monetization (once added, P2) | Does any monetization surface change perceived fairness or difficulty | A/B on conversion **and** a parallel check that D7 retention does not regress versus the pre-monetization baseline | "Did adding monetization hurt the game, even if it made money?" |
| Retention (soft launch) | Real D1/D7/D30, real share rate | Live soft-launch cohort in 1–2 smaller English-speaking markets before wider release (see Production Roadmap, Phase 8) | "Do the KPI hypotheses above hold with real, unbiased users?" |

### Automated testing (built alongside the code, not after)

This is implemented, not just planned: `game/test/` holds 41 unit tests (`npm test`, also run automatically on every push and pull request via `.github/workflows/test.yml`) and `game/qa/` holds the Playwright scripts described below, runnable against a local static server (see `game/qa/README.md`).

- **Unit tests** for the deterministic core: the PRNG, the daily-seed derivation (same UTC date → same seed, always), the hit-detection math (given a known sweep state and a known input timestamp, the judged result is exact and reproducible), the combo/max-combo bookkeeping, and the streak/freeze state machine — this is the fairness-critical and retention-critical logic flagged repeatedly in validation, and it is the cheapest place in the whole project to catch a bug. One of these tests (a streak-freeze milestone edge case) caught a real bug during development: milestones were tracked over the player's lifetime instead of per-streak, so rebuilding a fresh streak back up to a milestone already reached — and reset — by an earlier, broken streak silently withheld the freeze it should have re-granted.
- **Playwright end-to-end tests** (`qa/browser-check.mjs`, `qa/network-check.mjs`, `qa/analytics-check.mjs`), run headlessly against a real Chromium instance: page loads without console errors or failed network requests, a full play-through produces a populated (not empty) result screen, settings and theme persist across a reload, share-to-clipboard actually writes the expected text, offline mode works after the service worker has cached the app shell, and every analytics event in the spec above actually fires at the right moment. One of these runs caught a real bug during development: a CSS specificity tie meant `[hidden]` screens weren't actually hidden, so a test believed a run had "ended" on the very first frame.
- **`qa/skilled-play.mjs`** goes further than a smoke test: using a read-only debug hook (`?debug=1`, docs/GAME_DESIGN.md's controls section — exposes no write access, since this is a single-player client-only game with nothing server-authoritative to protect), it computes the exact dead-center tap time for the live lap and taps there, confirming end-to-end (real browser, real event timestamps, not a mocked clock) that precisely-timed taps land Perfect, the combo climbs correctly, and the Daily Ring's 20-lap cap ends the run as "completed."
- **Cross-device manual QA matrix**: at minimum one flagship iOS device, one flagship Android device, and one budget Android device (2–3 year old, sub-$200 tier), specifically to catch the touch-sampling-rate and audio-latency fairness issues named in validation before they reach real users. Not yet performed — this requires physical devices this environment doesn't have — and is a named blocker before Production Roadmap Phase 6 (Internal Testing) can be considered complete.
- **Accessibility contrast verification**: computed actual WCAG contrast ratios for every color-token pair used in the UI (not just eyeballed) — see GAME_DESIGN.md §4 for the real bug this caught in the light theme's True-band color.

## Security, Privacy & Platform Requirements

*None of this constitutes legal advice — items marked for professional review should get it before submission or launch in the relevant market.*

### Why the MVP's scope is a genuine compliance simplification

Because the web MVP has no login, no account, no server, no ad SDK, and no attribution SDK, it starts from a materially smaller compliance surface than a typical F2P mobile game — there is very little third-party SDK data-sharing to audit in the first place (see RESEARCH.md §3–5 for why 2026's compliance bar for a "simple casual game" is heavier than it was even a year or two ago: mandatory SDK-by-SDK privacy audits, stricter children's-privacy rules, DMA-driven fee/store changes, and expanding age-verification requirements). This section documents what still applies, and what changes once native distribution and any monetization SDK are added in P1/P2.

### Privacy

- **MVP**: `localStorage` only, on-device, never transmitted. If a lightweight, privacy-respecting analytics provider is added (PRODUCT_PLAN.md → Analytics), it must be cookie-less/aggregate and disclosed in a plain-language privacy notice — no cross-site tracking, no advertising identifier.
- **P1/P2 (native + any ad/attribution SDK)**: every third-party SDK added (ad network, attribution, crash reporting) must be individually audited for its own data practices before submission — required for Apple's Privacy Nutrition Labels and signed Privacy Manifests, and for Google Play's Data Safety section. **Flag for professional review**: the exact SDK-by-SDK disclosure once specific ad/analytics vendors are chosen.

### Children's privacy

The game's minimalist, non-violent, all-ages-legible art style could plausibly be read as "likely to be accessed by children" under COPPA (US) or the UK Children's Code, regardless of whether it is deliberately marketed at children. **Flag for professional review**: whether the specific final art direction and store listing trigger child-directed obligations (US COPPA's amended, broader personal-information definition and mandatory retention limits took effect in 2025; the UK ICO has an active enforcement programme specifically watching casual mobile games) — this determination should be made before submission, not assumed either way.

### Regional consent & age verification

GDPR's children's-consent age is not harmonized across the EU (13–16 depending on member state); several jurisdictions (Australia, Brazil, Singapore per Apple's 2026 enforcement; specific US states via "App Store Accountability Act"-style laws) now require age-category handling or verification flows. **Flag for professional review**: which specific launch markets trigger which of these requirements at the time of actual submission, since this list changed multiple times within 2025–2026 alone and should be treated as a live compliance checklist, not a one-time decision.

### EU Digital Markets Act / store fees

The EU DMA has forced Apple and Google to allow alternative payment processing and third-party app distribution in the EU, with fee structures that were still being actively renegotiated as of mid-2026. **Flag for professional review**: current fee terms at the time of any EU App Store submission, since this is explicitly a moving target.

### Age rating & content

The game contains no violence, no gambling-adjacent real-money mechanics, and (per the Monetization Strategy) no loot boxes or randomized paid rewards — this keeps it clear of the sharply-tightened 2026 EU/PEGI loot-box rules (loot-box content now triggers PEGI 16) and the reported EU "Digital Fairness Act" pipeline targeting addictive/loot-box design, by construction rather than by later mitigation. Expected rating: the lowest available tier on both stores (e.g., 4+/PEGI 3), pending the standard platform questionnaire.

### Intellectual property

- **Game mechanic**: not protectable by copyright or (realistically) patent — this is stated plainly in RESEARCH.md's own validation (the Threes!/2048 precedent is directly on point: Threes!'s creator publicly confirmed he had no legal recourse against 2048 because rules aren't protectable, only specific expression is). The defensible assets are the *brand* — name, visual identity, the specific dial/pointer art style, the "tick-strip" share-card format's visual treatment — which should be trademarked/protected as such, not relied on as a mechanic-level moat.
- **Naming**: both "Ringtrue" and any other candidate public name **must clear an actual trademark and App Store/Play Store name-collision search before commitment** — this was not performed as part of this research process (no live trademark-database access) and is flagged as a required pre-launch task, not assumed clear.
- **Audio**: all sound is originally synthesized in-engine (Web Audio oscillators, §5 of GAME_DESIGN.md) specifically to avoid any licensed-audio review burden.
- **Open-source licenses**: any third-party library added during production (a bundler, a testing framework) should be tracked in a simple attribution file; none are used in the MVP itself (plain ES modules, no dependencies).

### Refunds & purchase expectations

Once IAP is added (P1/P2), both platforms' standard refund mechanisms apply automatically (Apple's self-service refund request flow; Google Play's policy-driven refund window) — no custom refund logic is required, but store-review guidelines around "clearly describe what the purchase unlocks before purchase" apply directly to the Supporter Pack's store-listing copy.

---

## Launch & ASO Strategy

### Naming, icon, screenshots (evidence-based, RESEARCH.md §5)

- **Name**: front-load the strongest genre/mechanic keyword within the platform's title-length limit; avoid a name (like the research codename "Notch") that collides with an unrelated, strongly-associated existing term.
- **Icon**: simple but *gameplay-forward* — 2025–2026 best practice for minimalist games favors an icon that reads as a small "mini-poster" of the actual play object (the ring, the pointer, the target bands) over pure flat abstraction, since a completely abstract icon under-communicates genre and mechanic at browsing size.
- **Screenshots/preview video**: the sweeping ring and instant Miss/Fair/Perfect feedback is a genuine strength here — it reads clearly in a silent, 3-second clip, matching short-form-video and App-Store-preview norms identified in the research. The daily-ritual/share-card hook is harder to convey in a screenshot than the moment-to-moment mechanic is — marketing assets should lead with the tap-timing feel first, and use video specifically (not static screenshots) to convey the daily/social layer.

### Distribution sequencing (this is the concept's actual go-to-market strategy, not just an environment convenience)

1. **Free web build first** (see Production Roadmap, Phase 8) — a URL, zero install friction, directly de-risking the central open question (does the daily-seed-plus-share-card loop actually spread) before any app-store submission, review cycle, or paid UA spend.
2. **Native wrapper (Capacitor) only after web validation** — submitted to both stores once the web data justifies the investment, with the identical static assets (no rewrite).
3. **No paid user acquisition planned for the MVP or soft-launch phase** — per the Monetization Strategy, this concept's unit economics don't support profitable paid UA at typical casual-game CPIs; growth in the validation phase is organic/share-driven or not at all, and that result *is the data point* that determines whether to invest further.
4. **Launch markets**: English-language markets first (no localization burden in the MVP — all UI is minimal text plus universal iconography, and the core mechanic itself is language-independent, a genuine international-portability strength). Broader localization is a P2+ consideration once there's a validated audience to localize for.
5. **Organic/creator potential**: the instant restart, satisfying Miss/Fair/Perfect feedback, and shareable daily result are well-suited to short-form video and streamer "daily puzzle" content formats identified as effective in the research — but this is a hoped-for outcome to measure (via the `share_card_shared` KPI), not a plan component to bank on before evidence arrives.
## Production Roadmap

Each phase names objectives, deliverables, success criteria, the tests that gate moving on, key metrics, risks, and an explicit go/no-go call. **A weak result at any phase is a reason to revise or stop, not a reason already-sunk effort should push through** — per the brief's explicit instruction not to keep investing in a weak concept merely because development has already started.

**Status as of this writing.** Phases 2–4 were compressed in practice — building the MVP directly, rather than staging three literally-separate deliverables, was the pragmatic call for a solo/tiny-team effort with automated testing standing in for each phase's live-tester gate. That compression is a real, disclosed limitation: the "outside tester" and "cold first-time tester" checks in Phases 3–4 have not been run with actual humans, only simulated via Playwright (see the MVP Specification checklist above for exactly what has and hasn't been verified). Phase 5 (MVP) is complete and code-reviewed. The public web build and its deployment pipeline (`.github/workflows/deploy.yml`, GitHub Pages) now exist, which is the *infrastructure* Phase 8 depends on — but Phase 8 itself (real users, real retention/share data) has not started, because that requires a human decision to merge this branch and actually do the outreach; it isn't something to do unprompted, since it starts collecting data from real people. See README.md for the one remaining manual step (enabling Pages in repo settings) and this document's Cost/Complexity and Risk Register sections for what's genuinely still open.

| Phase | Objectives | Deliverables | Success Criteria / Tests | Key Risks | Go/No-Go |
|---|---|---|---|---|---|
| **0 — Market Research** | Understand the landscape before choosing anything | `RESEARCH.md` §1–8 | Evidence triangulated across multiple independent sources; gaps disclosed, not filled with invented data | Research staleness (mobile market data moves fast — re-verify before major decisions if significant time has passed) | **Done** (this deliverable) |
| **1 — Concept Validation** | Generate, score, and adversarially validate concepts before committing to one | `RESEARCH.md` §9–14 | Top concept and a real runner-up both survive equal adversarial scrutiny; a documented, evidence-based reason for the final pick | Confirmation bias toward the first appealing idea | **Done** — Ringtrue selected |
| **2 — Paper / Interactive Prototype** | Prove the core tap-timing feel is fun *before* building the full system | A throwaway single-file HTML page: one ring, one target, tap-to-judge, no daily seed, no journal, no menus | Internal playtesters voluntarily play "one more" at least 3 times in a row unprompted | The mechanic could feel worse in the hand than on paper — this phase exists specifically to catch that cheaply | If the core tap feel isn't fun here, **stop and return to Phase 1** — no amount of daily-ritual/social scaffolding fixes an unfun core loop |
| **3 — Core Gameplay Prototype** | Build the real, tuned core loop: non-periodic sweep, master plateau, combo/scoring, fairness-correct hit detection | The MVP's `game.js`/`rng.js`/`input.js`, unit-tested | Hit detection is provably fair (unit tests pass on known seed→outcome pairs); difficulty ramp feels fair, not punishing, to outside testers across a skill range | The plateau or ramp tuning is a real design-skill task, not a one-shot parameter guess | Proceed once outside testers stop describing losses as "unfair" |
| **4 — Vertical Slice** | One fully-polished mode end-to-end: Home → Run → Result → Share, with real visual/audio/haptic design | Practice mode only, full visual design system applied, no Daily Ring/streak yet | A cold first-time tester completes a full loop unprompted, using only the zero-text onboarding hint | Onboarding might still need more than a single hint pulse for some users | Proceed if ≥4/5 cold testers succeed with zero verbal help |
| **5 — MVP** | Add the Daily Ring, streak, Precision Journal, share card, settings/accessibility — the full P0 scope (see Prioritization) | This document's full P0 feature list, shippable as a PWA | All P0 features present; automated Playwright suite passes; manual accessibility pass (contrast, colorblind sim, reduced-motion, sound-off) passes | Scope creep into P1 features (weekly modifiers, server leaderboard) — actively resist | **Done.** All P0 items present and verified (see MVP Specification checklist above); a code-review pass caught and fixed two real bugs and one accessibility failure before this was called complete |
| **6 — Internal Testing** | Find bugs and rough edges before any outside eyes | Bug list, a short internal "does this feel good" writeup | Zero known fairness-breaking bugs (a wrong hit judgment); stable across the device-tier QA matrix (PRODUCT_PLAN.md → Testing Strategy) | Team is by now too skilled at the game to judge difficulty for a newcomer — recruit at least a few genuinely fresh internal testers | Proceed once the device matrix passes and no fairness bugs remain open |
| **7 — Closed Beta** | Real outside users, small scale, direct feedback channel | A shared URL to a small (20–50 person) external group, a lightweight feedback form | Qualitative signal that the daily ritual and share card are actually used voluntarily, not just when asked to | Small-sample noise — treat this as qualitative signal, not statistically decisive | Proceed if feedback doesn't surface a fundamental "this isn't fun" signal |
| **8 — Soft Launch** | Get real, unbiased retention/virality data at small scale, before any wider release or native investment | Public web build, no paid promotion, 1–2 modest organic-only launch touchpoints (e.g., a niche community post, a small press pitch) | The Analytics KPI targets (PRODUCT_PLAN.md → Analytics): D1/D7/D30 retention and — the single most important number — share rate | This is the phase that actually answers the concept's central open question; a disappointing result here is real information, not a testing artifact to explain away | **Infrastructure ready, not yet launched.** The deployable build, CI, and GitHub Pages pipeline exist; going live requires merging to `main`, a one-time Pages setting, and an actual decision to start collecting data from real people — none of which should happen without the repo owner's go-ahead. **This remains the concept's real go/no-go gate**: if share rate and D7 retention land meaningfully below target once it does launch, with no clear, fixable cause, do not proceed to native investment — revisit positioning or return to Phase 1 rather than sinking further budget |
| **9 — Optimization** | Fix whatever soft-launch data reveals; tune difficulty/onboarding/share-friction based on real behavior, not internal guesses | A revised build addressing the specific soft-launch findings | Move the previously-weak KPI(s) toward target in a follow-up measurement window | Chasing a vanity metric instead of the retention/share fundamentals | Proceed to native/global investment only once the core retention+share hypothesis is confirmed, not merely "improved" |
| **10 — Global Launch** | Native app-store submission (Capacitor wrap), broader distribution | App Store + Google Play listings, ASO assets (PRODUCT_PLAN.md → Launch/ASO) | Store review passed; privacy/compliance requirements (PRODUCT_PLAN.md → Legal) cleared for each launch market | Store review delays; a compliance requirement discovered late | Proceed once the compliance checklist (Legal section) is fully cleared, not just "probably fine" |
| **11 — Post-Launch Iteration** | P1/P2 features, guided by real usage data | Weekly modifiers, verified server leaderboard, cosmetic monetization (see Post-Launch Roadmap below) | Each addition individually evaluated against the retention-feature test in GAME_DESIGN.md §6 | Feature creep eroding the minimalist identity that made the game work in the first place | Each P1/P2 item gets its own go/no-go, not a blanket "continue building" |

## Prioritization

**P0 — essential for the MVP (Phase 5), nothing else ships before these:**
- Core ring/sweep/tap mechanic with fair, timestamp-based hit detection
- Non-periodic sweep variation and the hard master plateau
- Daily Ring (device-clock-derived UTC seed) as the primary mode
- Practice/Endless mode as a clearly secondary mode
- Miss/Fair/Perfect scoring with combo multiplier and combo-softening on Fair
- Local Precision Journal (median offset, consistency, longest streak, total Perfects)
- Streak counter with a small number of earned streak-freezes
- Text/emoji shareable result card with Web Share API / clipboard fallback
- Zero-text, single-hint-pulse onboarding
- Settings: sound, haptics, reduce motion, colorblind-safe mode, theme override
- Full offline playability via PWA/service worker
- Zero monetization, zero server backend, zero server leaderboard

**P1 — important, pursued once the MVP validates (post soft-launch):**
- 2–3 hand-authored weekly modifiers
- Server-side, replay-verified daily leaderboard (global + friends)
- Native app wrapping via Capacitor for App Store/Play submission
- Native haptics (Taptic Engine via Capacitor plugin) on iOS
- One-time Supporter Pack IAP + cosmetic unlock set
- Opt-in rewarded video (cosmetic preview / stat reveal only)

**P2 — valuable after further validation:**
- Rendered-image share card as an *additional* option alongside the default text card
- Skill-tiered leaderboard brackets
- Ambient/optional music layer
- Regionally-tuned pricing refinements
- Composable ("build your own") difficulty modifiers

**P3 — future experiments, not committed to:**
- Community-submitted or community-voted weekly modifiers
- Speedrunning/rhythm-game streaming community partnerships
- Adaptive per-player calibration (Elo-like personal window tuning)
- Additional platforms (tablet-specific layout, desktop web)

**The minimalist philosophy is protected explicitly**: no roadmap item above P1 is scheduled by default — each P2/P3 item requires its own fresh justification against real post-launch data before it is built, specifically to prevent the gradual feature creep the brief warns against.

## Cost / Complexity Assessment

| Workstream | Complexity | Notes |
|---|---|---|
| Core mechanic (ring, sweep, hit detection, scoring) | Low | No physics engine, no content pipeline; the hardest part is *tuning* (difficulty curve, plateau placement), a design-time cost, not an engineering one |
| Daily seed + determinism | Low-Medium | The MVP's biggest technical risk is subtle, not big: floating-point/timing edge cases in fairness-critical hit detection need real unit-test discipline, not exotic infrastructure |
| Visual/audio/haptic system | Low-Medium | Synthesized audio and canvas rendering keep this cheap; the accessibility pass (contrast, colorblind sim, reduced motion) is real, budgeted work, not free |
| PWA/offline packaging | Low | Standard, well-documented web platform features |
| P1 server leaderboard + anti-cheat | **Medium-High** | The single most expensive item on the entire roadmap — deliberately deferred past the MVP specifically because it requires real backend/replay-verification engineering that a small team can't casually bolt on, per the technical red-team's core finding |
| P1 native wrapping (Capacitor) | Low-Medium | The static assets carry over unchanged; the added work is store submission mechanics, native plugin wiring, and platform-specific QA |
| Ongoing live-ops (P1 weekly modifiers) | Low, if kept small | Explicitly scoped to 2–3 modifiers at a time, not an open-ended content commitment — a direct lesson taken from both finalist concepts' red-team findings about unbudgeted content cadences |

**Team**: a genuinely small team can carry the MVP — one generalist engineer/designer and, ideally, one dedicated visual/audio-feel pass (even part-time) given how much of this game's quality lives in "juice" rather than content volume. A backend/live-ops engineer is **not** needed for the MVP and should be added only when P1's server leaderboard work is actually scheduled.

## Risk Register

*(Consolidated from RESEARCH.md §14; severities re-stated here in production-planning terms with an owner-facing next action rather than repeated in full — see RESEARCH.md for full reasoning.)*

| Risk | Likelihood | Impact | Next action |
|---|---|---|---|
| Core mechanic plateaus faster than expected even with non-periodic sweep mitigation | Medium | High | Instrument the Precision Journal data itself as an early warning system — if median-offset improvement flatlines for most players within weeks, that's a direct, measurable signal, not a guess |
| Share rate underperforms the Wordle-scale assumption | Medium-High | High (this is the concept's central bet) | Soft-launch phase (Phase 8) is designed specifically to surface this early and cheaply, before native investment |
| A capitalized competitor clones the mechanic quickly after any visible traction | Medium | Medium | Move fast through soft-launch specifically to establish brand/community before a clone can (per red-team mitigation); protect brand assets (name, visual identity) via trademark once a name is cleared |
| Cross-device timing fairness (touch/audio latency) undermines the fairness claim on budget hardware | Medium | Medium-High | Timestamp-based hit detection (not last-rendered-frame) implemented from day one; budget-Android device explicitly in the QA matrix |
| Streak mechanic causes abandonment on a broken streak | Medium | Medium | Participation-based (not performance-based) streak + earned freezes; `streak_broken` tracked as an explicit churn KPI |
| Naming collision ("Notch") or an uncleared trademark on the proposed name ("Ringtrue") | Low probability of the first (already caught), Medium for the second (unverified) | Medium | Trademark/App-Store-name-collision search is a named pre-launch task, not assumed clear |
| Scope creep past P0 before validation | Medium (a natural pull for any small team excited about their own concept) | Medium-High | Explicit P0–P3 prioritization above, revisited at every phase gate |

## Important Things You Didn't Ask About

Genuinely non-obvious items an experienced studio would flag that a first-time non-developer commissioning this project likely wouldn't think to ask — each is real, specific to this project, and actioned somewhere in this plan (or explicitly flagged as an open task).

1. **iOS Safari doesn't support automatic PWA install prompts the way Android Chrome does.** Android shows a native "Install app" banner; on iOS, installing to the home screen requires the user to manually tap Share → "Add to Home Screen" — a genuinely obscure flow most users never discover on their own. Since the entire go-to-market strategy (PRODUCT_PLAN.md → Launch/ASO) leans on a frictionless web-first launch, and a large share of any casual-game audience is on iPhones, this is a real, structural asymmetry in the plan: Android users get a near-native experience for free, iOS users functionally get "a website" unless separately taught how to install it (or until the P1 native wrapper ships). **Mitigation already reflected in the design**: nothing in the MVP requires installation — the Daily Ring works perfectly as a bookmarked or re-visited URL — so this caps *convenience* on iOS, not functionality, but it's worth knowing going in rather than discovering during soft launch.

2. **Emoji render differently across platforms — a real risk to the share card's whole purpose.** Wordle's colored-square emoji happen to render nearly identically across iOS/Android/desktop; many other emoji do not (different OS emoji sets can differ meaningfully in appearance). GAME_DESIGN.md §1.11 specifies simple geometric Unicode glyphs (●○◐) rather than complex emoji for exactly this reason — verify this rendering consistency explicitly during Testing (cross-device QA matrix) before launch, since a share card that looks broken or inconsistent on a recipient's phone defeats the entire virality mechanism it exists for.

3. **A lightweight remote-config layer is worth building even into an otherwise server-less MVP.** The single hardest design problem in this whole project — where exactly to place the difficulty ramp and master plateau — cannot be gotten right on the first try, and a native app-store update to fix bad tuning can take days of review. A small JSON config file, fetched once at startup from a static host (with the last-known-good version cached locally so the game still works offline), lets difficulty/ramp constants be tuned post-launch without touching the app binary at all. This adds real value without contradicting the "no backend" MVP principle (a static config file is not a server).
4. **A domain, HTTPS hosting, and basic app packaging housekeeping are real pre-launch tasks, easy to leave until too late.** A short domain name, a static host with HTTPS (required for both PWA installability and the Web Share/Vibration APIs to function at all), a proper PWA manifest with icons at multiple resolutions, and Apple touch icons/favicons are unglamorous but load-bearing — several core APIs this design depends on (service workers, Web Share, haptics) simply refuse to run over plain HTTP.
5. **Where does the daily seed's "quality" get checked?** A purely algorithmic daily generator can, in principle, produce an unusually easy or unusually punishing day purely by chance of the date hash — and because every player faces that exact day at once (that's the whole point), a single bad day is a bad day for everyone simultaneously, all sharing result cards about it at once. Before launch, generate and spot-check a rolling window of upcoming daily seeds against the same fairness bounds used for Practice mode (GAME_DESIGN.md §1.7), rather than trusting the generator blindly — this is a cheap, one-time validation script, not an ongoing burden.
6. **Community/negative-review response plan.** Even a well-designed game gets some 1-star reviews, and the first few matter disproportionately for a small, unbacked launch's App Store conversion. Decide in advance who monitors and responds to reviews and support requests (both stores require a visible support contact) — this is a real, recurring task, not a one-time setup step.
7. **Solo/small-team pace discipline.** If this is built by one or two people, the biggest practical risk isn't any single design decision in this document — it's scope creep eroding the MVP boundary before Phase 8's data actually arrives to justify it. The P0/P1/P2/P3 split (Prioritization) is written to be a forcing function against this, but it only works if it's actually enforced turn by turn, not just agreed to once.
8. **Store listing localization is cheaper than in-game localization and often worth doing first.** Because the core mechanic and UI text are minimal and language-independent (GAME_DESIGN.md §3.3, PRODUCT_PLAN.md → Launch/ASO), translating just the App Store/Play Store *listing* text (title, description, keywords) into a handful of major languages can meaningfully widen organic discovery at near-zero cost, well before any in-game localization work is justified by data.
9. **Practical publishing logistics.** An Apple Developer Program account costs $99/year and a Google Play Console account costs a one-time $25 fee, and Apple's review process in particular can take from under a day to over a week depending on flags raised — both are worth budgeting for as real lead time in the Production Roadmap's Phase 10, not assumed instantaneous.
10. **A quick internal ethics/dark-patterns self-review before shipping, not just at the design stage.** The design intent throughout this document explicitly avoids the manipulative patterns named in the FTC's dark-patterns guidance and the loot-box/variable-reward research (RESEARCH.md §4, §14) — but intent and implementation can drift during actual production (a "just this once" forced ad, a streak mechanic that gets tuned to feel naggier under pressure to hit a retention number). A short, explicit checklist re-review against RESEARCH.md §4's dark-patterns findings immediately before each release is worth doing as a standing habit, not a one-time design promise.
11. **Local-only data loss is a real, disclosed limitation the player should be told about, not surprised by.** Because the MVP stores all progress in `localStorage` with no account or cloud sync (a deliberate scope decision, PRODUCT_PLAN.md → Technical Architecture), clearing browser data, switching devices, or reinstalling loses a player's streak and Precision Journal permanently. A brief, honest note in Settings ("Your stats are saved on this device only") costs nothing and converts a nasty surprise into an understood tradeoff — this exact "I lost my streak/collection" pattern was independently flagged as a common 1-star-review driver in the competitor and validation research.
12. **Re-verify the market research before major follow-on investment decisions, not just once at the start.** The mobile games market moved measurably within the single year covered by this research (RESEARCH.md §3); if significant time passes between this document and the Phase 8/10 investment decisions it informs, a quick re-check of the load-bearing claims (genre trend direction, monetization sentiment, any new direct competitors) is cheap insurance against acting on stale data.

## MVP Specification

The MVP is precisely the P0 list above — restated here as a single acceptance checklist for "is this done." Status reflects what has actually been verified, not what was merely intended — see the evidence noted on each line.

- [x] A player can open the app (or PWA) cold, with zero prior instruction, and complete a correctly-judged first lap within 10 seconds, guided only by the single first-run hint pulse. *Verified by `qa/browser-check.mjs` (cold load → first lap) and `qa/skilled-play.mjs` (precisely-timed taps land Perfect as designed).*
- [x] The Daily Ring is identical for every player on the same UTC calendar date, fully playable offline, with no server dependency. *Verified by unit tests (`dailySeed` is stable across times of day, differs across dates) and `qa/network-check.mjs` (service worker activates, zero network requests required after first load).*
- [x] Practice mode is available, clearly secondary to the Daily Ring on the Home screen.
- [x] Hit detection is judged against the raw input event timestamp, verified correct by unit tests against known seed→outcome pairs. *`test/game.test.js`; cross-checked live in a real browser by `qa/skilled-play.mjs`, which independently computes the ideal tap time and confirms it lands Perfect.*
- [x] The sweep is non-periodic (not constant angular velocity) by default. *`test/game.test.js`.*
- [x] Difficulty ramps on exactly two knobs (speed, band width) up to a hard, tuned plateau. *`test/game.test.js`.*
- [x] A Fair result halves rather than zeroes the combo multiplier; only a Miss ends a run. *`test/game.test.js`, including a maxCombo regression test added after code review caught the result screen under-reporting a run's peak combo.*
- [x] The Precision Journal persists locally and displays median offset, consistency, longest streak, and total Perfects. *`test/storage.test.js`; `qa/browser-check.mjs` reads the rendered values back.*
- [x] A streak counter persists locally, counts participation (not performance), and a small number of freezes are earned (never purchasable). *`test/storage.test.js`, including a regression test for a real bug caught in review: streak-freeze milestones were tracked over the player's lifetime instead of per-streak.*
- [x] The Result screen offers a plain text/emoji share card via Web Share API with a clipboard fallback — no rendered image, no extra confirmation step. *`test/share.test.js`; `qa/browser-check.mjs` confirms the actual clipboard contents after a share.*
- [x] Settings include independent Sound, Haptics, Reduce Motion, Colorblind-Safe Mode, and Theme (auto/light/dark) toggles, all applying instantly. *`qa/browser-check.mjs` toggles each and confirms both the DOM state and persistence across reload.*
- [x] The app is installable as a PWA and fully playable offline after first load. *Verified both at the domain root and staged under a `/Game/`-style subpath (matching how GitHub Pages actually serves a project site) — service worker registers, activates, and serves the app shell with the network disabled in both cases.*
- [x] Zero ads, zero IAP, zero server backend, zero server leaderboard are present anywhere in the build. *`qa/network-check.mjs` confirms zero outbound requests beyond the static asset fetches for the app shell itself.*
- [x] The full automated (Playwright + unit) test suite passes (41 unit tests + 4 Playwright scripts, all green; wired into CI via `.github/workflows/test.yml`).
- [ ] **Not yet done — a real environment limitation, not an oversight**: the manual cross-device QA matrix (flagship iOS, flagship Android, budget Android) has not been run, because this development environment has no physical devices. Headless Chromium testing and computed WCAG contrast ratios substitute for, but do not replace, real-device verification of touch latency, audio/haptic behavior, and Safari-specific quirks (in particular, iOS Safari's lack of a `beforeinstallprompt`/automatic PWA install flow, noted in "Things You Didn't Ask About"). **This is the one item standing between "code-complete" and "verified launch-ready"** — do this pass on real hardware before or immediately after the initial public soft launch.

## Post-Launch Roadmap

Sequenced strictly by the data gathered in Phase 8 (Soft Launch) — not pre-committed:

1. **If retention/share KPIs hit target**: proceed to native wrapping (Capacitor), P1 server leaderboard with real replay verification, and the Supporter Pack IAP — in that order, because the leaderboard's trust claim and the monetization ask both depend on the game already having proven it's worth that investment.
2. **If retention holds but share rate underperforms**: iterate on the share-card format and Result-screen framing specifically (the identified friction point) before investing further elsewhere — this is a targeted fix, not a reason to add unrelated features.
2b. **If share rate holds but retention underperforms**: revisit the difficulty ramp and onboarding (Phases 3–4 assumptions) before adding new content — a retention problem is rarely solved by adding more of what didn't retain players in the first place.
3. **If both underperform with no clear fixable cause**: this is the honest failure case the brief explicitly asks to plan for. Do not keep investing past this point merely because a build exists — return to `RESEARCH.md`'s concept portfolio (§9) and consider whether Nerve, Kinfuse (with its own red-team's mitigations applied), or a fresh concept-generation pass better fits what was actually learned.
4. **Ongoing, regardless of outcome**: every P1/P2/P3 feature (GAME_DESIGN.md §6, Prioritization above) is individually gated on the "would players still want this without a notification reminding them" test before it's built — the roadmap's job past this point is to keep the game small and excellent, not to keep adding to it by default.
