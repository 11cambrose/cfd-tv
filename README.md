# CFD TV

A 24/7 channel-surfing guide for coffeefordessert.com. Static files only, no build step.
Built 2026-10-06 from the Grok thread "CFD Chess Zone Channel Surfer" plus public YouTube and Spotify data.

## Files
- `index.html`, `style.css`, `app.js`: the TV.
- `channels.json`: every channel, the CFD daily clock, the TCZ 4:45 rail titles on file, and the song-of-the-day map (empty until songs are logged).
- `data/highlights.json`: the born-on-this-day data for channels 70 to 73.
- `verify/`: the 2026-10-06 checks behind every ID (YouTube page + RSS + oEmbed, Spotify oEmbed).

## Two lanes
- Coach Chad / The Chess Zone: CH 02 to 10, 72, 73.
- Brose / Coffee for Dessert: CH 11 to 43, 70, 71.

## Channels
- CH 02 to 29: YouTube. Joins mid-video on a shared clock, so two people on `?ch=19` see the same moment.
- CH 30 to 43: Spotify, folder-as-channel. A new playlist each hour on the CFD clock. CH 31 DJ Brose carries the morning commute forecast from 7:00 to 8:30 am CT. CH 43 follows the 2026-09-24 DJ Brose dice plan.
- CH 70 to 73: born-on-this-day highlights from Instagram exports and the TCZ archive index.

## Tonight grid (Central time)
4:35 to 5:05 am alarm study · 7:00 to 8:30 am DJ Brose forecast · 11:14 am to 1:14 pm Chess Master vs Chess Villain · 3:00 to 3:30 pm song of the day (only on days with a logged song) · 7:00 pm to midnight ICYMI.

## Controls
Up/Down or PageUp/PageDown to surf · type a channel number · G guide · E tonight · M sound · Esc closes panels · swipe up/down on phones · `?ch=19` deep link · `?epg` opens the grid.

## Run locally
`python3 -m http.server 8000` in this folder, then open http://localhost:8000/?ch=19

## Rebuild data
`python3 build/build.py` (run from repo root; needs network for YouTube/Spotify checks).
