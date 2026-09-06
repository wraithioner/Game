# QA scripts

Manual/ad-hoc Playwright smoke tests for the real, rendered game — separate from the fast unit suite in `../test/` (`npm test`), which covers pure logic only and has no browser dependency.

These require the optional `playwright` dev dependency and a running static server for the game:

```
npm install          # pulls in Playwright (browser binary must already be available locally)
python3 -m http.server 8837 &
npm run qa:smoke      # basic flow: home, practice, a run, share, journal, settings, offline
npm run qa:skilled    # uses a debug hook (?debug=1) to tap with exact timing and verify
                      # the difficulty ramp, combo system, and the daily 20-lap cap
npm run qa:network    # checks for failed requests and correct service-worker registration
npm run qa:analytics  # verifies every docs/PRODUCT_PLAN.md analytics event actually fires
```

`BASE_URL` env var overrides the default `http://127.0.0.1:8837`.
