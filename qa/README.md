# CFD TV QA kit

Runs the same way on the box, a Mac, and GitHub Actions (`.github/workflows/qa.yml`). Node 22, Python 3.12, Google Chrome.

```bash
cd qa && npm ci && cd ..
python3 -m http.server 8000 --bind 127.0.0.1 &          # serve the site from the repo root

node qa/validate.mjs . qa/channels.schema.json            # schema + lane contract + 24h clock coverage
for tz in America/Chicago UTC Asia/Tokyo America/Los_Angeles; do TZ=$tz node qa/dst-check.mjs .; done
python3 qa/check_ids.py --root .                          # every ID vs verify/ snapshots (add --live to re-hit oEmbed)

cd qa
CHROME_PATH=/usr/bin/google-chrome node smoke.mjs http://127.0.0.1:8000 --known known-fails.json
CHROME_PATH=/usr/bin/google-chrome node smoke.mjs http://127.0.0.1:8000 --block-embeds --known known-fails.json
```

On a Mac set `CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

- `smoke.mjs`: headless Chrome: channel flip and wrap, number entry, deep links (`?ch=`, `?epg`), guide lanes, Tonight grid, Central clock from a Tokyo-zoned browser, mobile 390×844 (swipe, number pad, 44 px tap targets), axe-core WCAG A/AA, payload size. `--block-embeds` blocks YouTube, Spotify, and Instagram and also black-holes the YouTube script to prove the 8 s timeout and the "YouTube is blocked on this network" card.
- `dst-check.mjs`: Central-time helpers on both 2026–27 DST switch days, plus a round-trip sweep of every clock block from Oct 2026 to Dec 2027.
- `known-fails.json`: tests listed here report KNOWN instead of failing CI. Keep it empty unless a bug is accepted on purpose.
