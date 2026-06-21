# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-11

### Added
- Interactive route planning with multi-stop support on a Leaflet map
- Geocoding-based stop search using OpenStreetMap Nominatim
- Route calculation via OSRM with per-segment distance and duration breakdown
- Drag-and-drop stop reordering
- Optional return trip calculation
- Vehicle settings with car type selection (Gasoline, Diesel, Electric) and price-per-km cost estimation
- Tesla Supercharger locations displayed along calculated routes when car type is Electric, powered by Open Charge Map API
- Charger markers with popups showing name, address, charging points, and connector types
- Dynamic charger toggle when switching car type without recalculating the route
- Dark and light theme with localStorage persistence
- Mobile responsive sidebar with hamburger menu and backdrop overlay
- 23 Playwright E2E tests covering UI, routing, Tesla chargers, and stop management
- GitHub Pages deployment via Actions workflow

### Security
- HTML sanitization on charger popup content to prevent XSS from external API data
