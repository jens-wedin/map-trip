# MEMORY — map-trip

Handoff notes for picking this project back up quickly.

## What this is
An interactive **roadtrip planner** built with **Leaflet + Vite** (vanilla JS, no framework).
Single-page app: all logic in [src/main.js](src/main.js), styles in [src/style.css](src/style.css).
Deploys to GitHub Pages via Actions on push to `main`.

## Current state (2026-06-21)
- **v1.0.0**, on `main`. Clean working tree.
- Latest feature (car-type pricing + Tesla Superchargers) was merged via **PR #3** (merge commit `8296839`).
- Feature branch `claude/add-car-type-pricing-BJGTL` is merged and deleted.

## Features shipped
- Multi-stop route planning on a Leaflet map (default: Stockholm → Paris and back)
- Geocoding via OpenStreetMap **Nominatim**; routing via **OSRM** (per-segment distance + duration)
- Drag-and-drop stop reordering; optional return trip
- Vehicle settings: car type (Gasoline / Diesel / Electric) + price-per-km cost estimation
- **Tesla Supercharger** locations along the route when car type = Electric (via **Open Charge Map** API);
  markers with popups (name, address, charging points, connectors). Toggles dynamically on car-type change,
  clears on route reset. Popup HTML is sanitized to prevent XSS from the external API.
- Dark/light theme with localStorage persistence; mobile responsive sidebar (hamburger + backdrop)

## Tech stack
Leaflet · Vite · OSRM (routing) · Nominatim (geocoding) · Open Charge Map (EV chargers)

## Commands
```bash
npm run dev          # vite dev server at http://localhost:5173/map-trip/
npm run build        # vite build
npm run preview      # preview production build
npm run test:e2e     # Playwright E2E (npx playwright test)
```
First-time E2E run needs the browser: `npx playwright install chromium`.

## Tests
- 23 Playwright E2E tests in [tests/e2e/app.spec.js](tests/e2e/app.spec.js) — all passing as of 2026-06-21.
- Covers basic UI, route calculation, cost display, Tesla chargers, and stop management.

## Design docs
- Spec: [docs/superpowers/specs/2026-04-11-tesla-charging-points-design.md](docs/superpowers/specs/2026-04-11-tesla-charging-points-design.md)
- Plan: [docs/superpowers/plans/2026-04-11-tesla-charging-points.md](docs/superpowers/plans/2026-04-11-tesla-charging-points.md)

## Possible next steps
- No open work items. Ideas: charger filtering by connector/power, alternative charging networks
  (currently Tesla-only), persist trips, share/export route.
