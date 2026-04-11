# Tesla Charging Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display Tesla Supercharger markers along a calculated route when car type is "Electric," using Open Charge Map API.

**Architecture:** Sample the OSRM route polyline every ~50km, query Open Charge Map for Tesla chargers near each sample point (5km radius), deduplicate, and render as a separate Leaflet layer group with custom markers and info popups. All logic lives in `src/main.js`, styling in `src/style.css`.

**Tech Stack:** Vanilla JS, Leaflet, Open Charge Map API (no new dependencies)

---

### Task 1: Add charger layer group and state variables

**Files:**
- Modify: `src/main.js:18-21` (state variables section)

- [ ] **Step 1: Add state variables after existing ones**

Add these lines after `let tileLayer = null;` (line 22):

```javascript
let chargersLayerGroup = null;
let lastRouteGeometry = null;
```

- [ ] **Step 2: Initialize the layer group in initMap**

In `initMap()` (line 25-31), add after `updateMapTiles();`:

```javascript
chargersLayerGroup = L.layerGroup().addTo(map);
```

- [ ] **Step 3: Verify the app still loads**

Run: `npm run dev` and confirm the map loads without errors in the browser console.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: add charger layer group and route geometry state"
```

---

### Task 2: Implement route polyline sampling

**Files:**
- Modify: `src/main.js` (add new function after `formatDuration`, before `displayRoute`)

- [ ] **Step 1: Add the sampleRoutePoints function**

Insert after `formatDuration` (after line 264):

```javascript
function sampleRoutePoints(geometry, intervalKm = 50) {
  const coords = geometry.coordinates; // [lng, lat] pairs
  const points = [];
  let accumulated = 0;

  points.push({ lat: coords[0][1], lng: coords[0][0] });

  for (let i = 1; i < coords.length; i++) {
    const prevLat = coords[i - 1][1];
    const prevLng = coords[i - 1][0];
    const currLat = coords[i][1];
    const currLng = coords[i][0];

    const segmentKm = haversineKm(prevLat, prevLng, currLat, currLng);
    accumulated += segmentKm;

    if (accumulated >= intervalKm) {
      points.push({ lat: currLat, lng: currLng });
      accumulated = 0;
    }
  }

  // Always include the last point
  const last = coords[coords.length - 1];
  const lastPoint = { lat: last[1], lng: last[0] };
  const alreadyIncluded = points.some(
    (p) => p.lat === lastPoint.lat && p.lng === lastPoint.lng
  );
  if (!alreadyIncluded) {
    points.push(lastPoint);
  }

  return points;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `npm run dev` — confirm the app loads without console errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: add route polyline sampling with haversine distance"
```

---

### Task 3: Implement Open Charge Map API fetch

**Files:**
- Modify: `src/main.js` (add after `sampleRoutePoints` and `haversineKm`)

- [ ] **Step 1: Add fetchTeslaChargers function**

```javascript
async function fetchTeslaChargers(lat, lng, radiusKm = 5) {
  const url = `https://api.openchargemap.io/v3/poi?output=json&latitude=${lat}&longitude=${lng}&distance=${radiusKm}&distanceunit=KM&operatorid=23&maxresults=50&compact=true`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "RoadtripPlanner/1.0" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((poi) => ({
      id: poi.ID,
      name: poi.AddressInfo?.Title || "Tesla Supercharger",
      address: [
        poi.AddressInfo?.AddressLine1,
        poi.AddressInfo?.Town,
        poi.AddressInfo?.Country?.Title,
      ]
        .filter(Boolean)
        .join(", "),
      lat: poi.AddressInfo?.Latitude,
      lng: poi.AddressInfo?.Longitude,
      numberOfPoints: poi.NumberOfPoints || "N/A",
      connectorTypes: (poi.Connections || [])
        .map((c) => c.ConnectionType?.Title)
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ") || "Unknown",
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Add fetchChargersAlongRoute function**

```javascript
async function fetchChargersAlongRoute(geometry) {
  const points = sampleRoutePoints(geometry, 50);
  const allChargers = await Promise.all(
    points.map((p) => fetchTeslaChargers(p.lat, p.lng, 5))
  );

  // Deduplicate by charger ID
  const seen = new Set();
  const unique = [];
  for (const chargers of allChargers) {
    for (const charger of chargers) {
      if (!seen.has(charger.id)) {
        seen.add(charger.id);
        unique.push(charger);
      }
    }
  }
  return unique;
}
```

- [ ] **Step 3: Verify no syntax errors**

Run: `npm run dev` — confirm the app loads without console errors.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: add Open Charge Map API integration for Tesla chargers"
```

---

### Task 4: Implement charger marker display and clearing

**Files:**
- Modify: `src/main.js` (add after `fetchChargersAlongRoute`)
- Modify: `src/style.css` (add charger marker and popup styles)

- [ ] **Step 1: Add createChargerIcon function**

```javascript
function createChargerIcon() {
  return L.divIcon({
    className: "charger-marker",
    html: `<div style="
      background: #e82127;
      color: white;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">&#9889;</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
  });
}
```

- [ ] **Step 2: Add displayChargers function**

```javascript
function displayChargers(chargers) {
  clearChargers();
  chargers.forEach((charger) => {
    if (!charger.lat || !charger.lng) return;
    const marker = L.marker([charger.lat, charger.lng], {
      icon: createChargerIcon(),
    }).bindPopup(`
      <div class="charger-popup">
        <strong>${charger.name}</strong>
        <span>${charger.address}</span>
        <span>Charging points: ${charger.numberOfPoints}</span>
        <span>Connectors: ${charger.connectorTypes}</span>
      </div>
    `);
    chargersLayerGroup.addLayer(marker);
  });
}
```

- [ ] **Step 3: Add clearChargers function**

```javascript
function clearChargers() {
  if (chargersLayerGroup) {
    chargersLayerGroup.clearLayers();
  }
}
```

- [ ] **Step 4: Add CSS for charger popup**

Append to `src/style.css` (before the mobile media query):

```css
/* Charger popup */
.charger-popup {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
    line-height: 1.4;
}

.charger-popup strong {
    font-size: 0.9rem;
}

/* Charger loading status */
.charger-status {
    font-size: 0.8rem;
    color: var(--text-secondary);
    padding: 8px 0 0;
}
```

- [ ] **Step 5: Verify no syntax errors**

Run: `npm run dev` — confirm the app loads without console errors.

- [ ] **Step 6: Commit**

```bash
git add src/main.js src/style.css
git commit -m "feat: add charger marker display with popups and styling"
```

---

### Task 5: Integrate charger loading into route calculation

**Files:**
- Modify: `src/main.js` — `calculateRoute()` function and car-type event listener
- Modify: `index.html` — add charger status element

- [ ] **Step 1: Add charger status element to HTML**

In `index.html`, after the `route-cost` div (line 79), add:

```html
<div id="charger-status" class="charger-status hidden"></div>
```

- [ ] **Step 2: Store route geometry and trigger charger fetch in calculateRoute**

In `src/main.js`, inside `calculateRoute()`, after the line `routeInfo.classList.remove("hidden");` (line 393), add:

```javascript
    // Store combined route geometry for charger lookup
    const allGeometryCoords = segments.flatMap((s) => s.geometry.coordinates);
    lastRouteGeometry = { type: "LineString", coordinates: allGeometryCoords };

    // Fetch Tesla chargers if electric car type selected
    if (carType === "electric") {
      const chargerStatus = document.getElementById("charger-status");
      chargerStatus.textContent = "Loading Tesla chargers...";
      chargerStatus.classList.remove("hidden");
      try {
        const chargers = await fetchChargersAlongRoute(lastRouteGeometry);
        displayChargers(chargers);
        chargerStatus.textContent = `${chargers.length} Tesla Supercharger${chargers.length !== 1 ? "s" : ""} found along route`;
      } catch {
        chargerStatus.textContent = "Could not load chargers";
      }
    } else {
      clearChargers();
      document.getElementById("charger-status").classList.add("hidden");
    }
```

- [ ] **Step 3: Also clear chargers at the start of calculateRoute**

In `calculateRoute()`, right after `clearMapOverlays();` (line 297), add:

```javascript
    clearChargers();
```

- [ ] **Step 4: Verify end-to-end**

Run: `npm run dev`
1. Set car type to "Electric"
2. Click "Calculate Route"
3. Confirm Tesla charger markers appear along the route with red lightning bolt icons
4. Click a charger marker — confirm popup shows name, address, charging points, connectors
5. Confirm "X Tesla Superchargers found along route" text appears

- [ ] **Step 5: Commit**

```bash
git add src/main.js index.html
git commit -m "feat: integrate Tesla charger fetching into route calculation"
```

---

### Task 6: Add car-type change listener for dynamic charger toggle

**Files:**
- Modify: `src/main.js` — add event listener section (after existing event listeners, around line 437)

- [ ] **Step 1: Add car-type change event listener**

Add after the calculate-btn event listener (after line 437):

```javascript
// Toggle Tesla chargers when car type changes
document.getElementById("car-type").addEventListener("change", async (e) => {
  const chargerStatus = document.getElementById("charger-status");
  if (e.target.value === "electric" && lastRouteGeometry) {
    chargerStatus.textContent = "Loading Tesla chargers...";
    chargerStatus.classList.remove("hidden");
    try {
      const chargers = await fetchChargersAlongRoute(lastRouteGeometry);
      displayChargers(chargers);
      chargerStatus.textContent = `${chargers.length} Tesla Supercharger${chargers.length !== 1 ? "s" : ""} found along route`;
    } catch {
      chargerStatus.textContent = "Could not load chargers";
    }
  } else {
    clearChargers();
    chargerStatus.classList.add("hidden");
  }
});
```

- [ ] **Step 2: Verify dynamic toggle**

Run: `npm run dev`
1. Calculate a route with "Gasoline" selected — no charger markers
2. Switch to "Electric" — charger markers appear
3. Switch back to "Diesel" — charger markers disappear
4. Switch to "Electric" again — charger markers reappear

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: toggle chargers dynamically on car-type change"
```

---

### Task 7: Clear chargers on route reset and update docs

**Files:**
- Modify: `src/main.js` — `updateMapMarkers()` function
- Modify: `README.md` (if exists) or create it
- Modify: `CHANGELOG.md` (if exists) or create it

- [ ] **Step 1: Clear chargers when map markers are reset**

In `updateMapMarkers()` (line 212), add `clearChargers();` and reset geometry after `clearMapOverlays();`:

```javascript
function updateMapMarkers() {
  clearMapOverlays();
  clearChargers();
  lastRouteGeometry = null;
  const chargerStatus = document.getElementById("charger-status");
  if (chargerStatus) chargerStatus.classList.add("hidden");
```

- [ ] **Step 2: Verify stops change clears chargers**

Run: `npm run dev`
1. Calculate a route with "Electric"
2. Chargers appear
3. Remove a stop or add a new stop
4. Charger markers disappear, status text hidden

- [ ] **Step 3: Update README.md with charger feature**

Add a section about Tesla charging points to the README.

- [ ] **Step 4: Update CHANGELOG.md**

Add an entry for the Tesla charging points feature.

- [ ] **Step 5: Commit**

```bash
git add src/main.js README.md CHANGELOG.md
git commit -m "feat: clear chargers on route reset, update docs"
```
