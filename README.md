# Ringtrue

A minimalist, one-tap precision-timing game with a Wordle-style daily challenge. Tap the instant a sweeping pointer lines up with a shrinking target on a ring — the same ring every player in the world faces once a day.

Built as a small, honestly-scoped web game (playable in any mobile or desktop browser, installable as a PWA, fully offline-capable) rather than a large content-heavy production — see [`docs/`](./docs) for the full studio process behind that decision.

## Play it

Serve the `game/` directory with any static file server and open it in a browser, e.g.:

```
cd game
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Documentation

This project went through a full research → validation → design → build process before any code was written:

- [`docs/RESEARCH.md`](./docs/RESEARCH.md) — market research, a 30-game competitor teardown, 12 original concepts, scoring, and adversarial validation of the finalists.
- [`docs/GAME_DESIGN.md`](./docs/GAME_DESIGN.md) — the full game design document, UX/UI spec, visual design system, accessibility spec, and audio/haptic spec for the selected concept, *Ringtrue*.
- [`docs/PRODUCT_PLAN.md`](./docs/PRODUCT_PLAN.md) — monetization strategy, technical architecture, analytics, testing, legal/platform requirements, production roadmap, and risk register.

## Project structure

```
game/           the playable web game (plain HTML/CSS/JS, no build step)
docs/           the studio design & research documents
```
