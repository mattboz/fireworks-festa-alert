# Festa Fireworks Alert 🎆🐾

A shareable, mobile-first web app that tells dog owners in Malta &amp; Gozo which
village festas (with their famous *mortali* fireworks) are coming up near them,
so they can prepare in advance.

## Features

- List of the 2026 season's village festas (village, date, days-until countdown)
- Pick your town from a dropdown; festas are sorted/filtered by distance from it
- Adjustable alert radius (same locality / 3km / 5km / 8km) — fireworks noise
  carries, so nearby villages matter too
- Clear "🔴 Near you" flag for festas inside your radius
- General mortali timing pattern (typical ~8am morning round, evening round,
  both rounds on Fri/Sat/Sun) — not exact times, since those aren't reliably
  published
- Your town + radius are encoded in the URL, so you can copy the link and it
  opens pre-filtered for whoever you send it to

## Tech stack

Plain HTML/CSS/vanilla JS, no framework, no build step. Chosen because:

- **Trivial to deploy and share** — it's static files, so it runs on GitHub
  Pages, Netlify, Vercel, or literally any static host with zero config.
- **No build pipeline to break** — nothing to `npm install` for the app to
  run; open `index.html` via any local server and it works.
- **Small and fast** — appropriate for a single-purpose utility that needs to
  load quickly on mobile data in the seconds before someone wants to check
  "is there a festa near me tonight?"
- Data lives in two JSON files (`data/festas.json`, `data/localities.json`)
  so it's easy to review/correct without touching any code.

## Running locally

No dependencies to install. From this directory:

```bash
python3 -m http.server 8123
# or: npx http-server -p 8123
```

Then open http://localhost:8123/

## Deploying

Any static host works. Easiest options:

- **GitHub Pages**: enable Pages on this repo (Settings → Pages → deploy
  from `main` branch, root folder). No config needed.
- **Netlify / Vercel**: drag-and-drop this folder, or connect the repo —
  no build command needed (leave it blank / "static site").

## Data

`data/festas.json` contains the 2026 season's major village festas, compiled
from [maltainfoguide.com](https://www.maltainfoguide.com/malta-village-feasts.html),
[sceneongozo.com](https://sceneongozo.com/gozo-village-feasts-guide/), and
cross-checked against [maltavents.com](https://maltavents.com/blog/malta-village-feasts-2026-ultimate-guide)'s
fireworks-focused guide.

The raw source lists include many minor chapel/confraternity feast days
alongside each village's main titular festa (e.g. Birkirkara alone lists 7+
small devotional feasts through the year). Those were **deliberately
excluded** since they're unlikely to involve significant mortali — only the
major village festas (plus a handful of confirmed secondary ones) are
included. See `flaggedForReview` in `festas.json` and the "Villages/dates
flagged for review" section in the app for specific things worth
double-checking, including:

- A source disagreement on Għarb (Gozo)'s festa date
- Villages with two big festas in the same season (Birkirkara, Żebbuġ)
- A couple of small-village festas whose fireworks scale is unconfirmed

Each entry has a `confidence` (`high`/`medium`) and `scale`
(`major`/`secondary`) field — please review and correct as needed, especially
anything marked `medium`.

`data/localities.json` has approximate coordinates for ~70 Malta &amp; Gozo
localities, used for the distance/radius calculations and the town dropdown.
Coordinates are estimates (locality-centre level, not survey-grade) — fine
for a "is this within a few km" check, not for anything requiring precision.
