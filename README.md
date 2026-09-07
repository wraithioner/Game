# Ringtrue

A minimalist, one-tap precision-timing game with a Wordle-style daily challenge. Tap the instant a sweeping pointer lines up with a shrinking target on a ring — the same ring every player in the world faces once a day.

Built as a small, honestly-scoped web game (playable in any mobile or desktop browser, installable as a PWA, fully offline-capable) rather than a large content-heavy production — see [`docs/`](./docs) for the full studio process behind that decision.

## Play it

**Live**: once GitHub Pages is enabled for this repo (see "Deploying" below), the game is served at **https://wraithioner.github.io/Game/**.

To run it locally, serve the `game/` directory with any static file server and open it in a browser, e.g.:

```
cd game
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploying

`.github/workflows/deploy.yml` builds and deploys the game to GitHub Pages automatically on every push to `main` (it stages only the runtime files — `index.html`, `styles.css`, `manifest.json`, `sw.js`, `robots.txt`, `src/`, `icons/` — excluding `qa/` scripts and other dev-only files). This has been tested locally end-to-end, including serving the exact staged output from a `/Game/`-style subpath to match how GitHub Pages actually hosts a project site.

**One manual, one-time step is required** before it goes live, and it isn't something to do without the repo owner's say-so since it makes the game and its analytics-free, ad-free build publicly reachable: in this repo's **Settings → Pages**, set **Source** to **GitHub Actions**. After that, every push to `main` deploys automatically — no further action needed. You can also trigger a deploy manually from the Actions tab (`Deploy to GitHub Pages` → Run workflow) once that's set.

Merging this branch to `main` is what will trigger the first real deployment — ask if you'd like that done or a pull request opened for it.

## Documentation

This project went through a full research → validation → design → build process before any code was written:

- [`docs/RESEARCH.md`](./docs/RESEARCH.md) — market research, a 30-game competitor teardown, 12 original concepts, scoring, and adversarial validation of the finalists.
- [`docs/GAME_DESIGN.md`](./docs/GAME_DESIGN.md) — the full game design document, UX/UI spec, visual design system, accessibility spec, and audio/haptic spec for the selected concept, *Ringtrue*.
- [`docs/PRODUCT_PLAN.md`](./docs/PRODUCT_PLAN.md) — monetization strategy, technical architecture, analytics, testing, legal/platform requirements, production roadmap, and risk register.

## Project structure

```
game/               the playable web game (plain HTML/CSS/JS, no build step)
  src/              game logic, rendering, audio, storage, analytics — all unit-tested
  test/             unit tests (npm test)
  qa/               Playwright end-to-end smoke tests (dev-only, not deployed)
docs/               the studio design & research documents
.github/workflows/  CI (unit tests on every push/PR) and the GitHub Pages deploy pipeline
```
