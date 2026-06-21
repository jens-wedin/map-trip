# Tesla Charging Points Along Route

**Date:** 2026-04-11
**Status:** Approved

## Overview

Display Tesla Supercharger locations near the calculated route when the car type is set to "Electric." Chargers are fetched from the Open Charge Map API by sampling points along the route polyline.

## Data Source

**Open Charge Map API** — `https://api.openchargemap.io/v3/poi`

Query parameters:
- `operatorid=23` (Tesla)
- `latitude`, `longitude` — sampled route point
- `distance=5`, `distanceunit=KM` — 5km search radius
- `maxresults=50`
- `compact=true`

No API key required for moderate usage (rate-limited).

### Data Extracted Per Charger

| Field | Source |
|-------|--------|
| Name | `AddressInfo.Title` |
| Address | `AddressInfo.AddressLine1`, `AddressInfo.Town`, `AddressInfo.Country.Title` |
| Number of points | `NumberOfPoints` |
| Connector types | `Connections[].ConnectionType.Title` |
| Location | `AddressInfo.Latitude`, `AddressInfo.Longitude` |

## Route Sampling Strategy

- Walk the route polyline geometry and sample a lat/lng point every ~50km
- For each sample point, query Open Charge Map with a 5km radius
- Fire requests in parallel for performance
- Deduplicate results by charger ID (`ID` field)

## UI Behavior

### Trigger Conditions

Chargers display when **both** conditions are met:
1. Car type is set to "Electric"
2. A route has been calculated

Chargers are cleared when:
- Car type changes away from Electric
- Route is recalculated (re-fetched if still Electric)
- Stops are cleared

### Map Markers

- Custom Tesla-styled icon (distinct from route stop markers)
- Stored in a dedicated Leaflet `LayerGroup` for clean add/remove
- No clustering library — keep simple for now

### Popup Content (on marker click)

- **Charger name** (bold)
- Address
- Number of charging points
- Connector types (comma-separated list)

### Loading State

- Brief "Loading chargers..." text displayed below route summary while fetching

## Architecture

All changes in `src/main.js`. No new files or dependencies.

### New Functions

1. **`sampleRoutePoints(geometry, intervalKm)`** — walks the route polyline, returns lat/lng points every ~50km
2. **`fetchTeslaChargers(lat, lng, radiusKm)`** — queries Open Charge Map for a single point, returns parsed charger objects
3. **`fetchChargersAlongRoute(routeGeometry)`** — orchestrates: samples points, fires parallel fetches, deduplicates by ID
4. **`displayChargers(chargers)`** — creates markers with popups, adds to `chargersLayerGroup`
5. **`clearChargers()`** — removes the layer group from the map

### Integration Points

- After `calculateRoute()` succeeds: if car type is Electric, call `fetchChargersAlongRoute()` then `displayChargers()`
- On car type `<select>` change: if route exists and type becomes Electric, fetch chargers; if type changes away, `clearChargers()`
- On route clear/recalculate: `clearChargers()` first

## Out of Scope

- Battery range estimation / automatic stop suggestions
- Other charging networks (only Tesla/Superchargers)
- Marker clustering
- Offline/static charger data
