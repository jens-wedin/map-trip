import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STOCKHOLM = { name: 'Stockholm, Sweden', lat: 59.3293, lng: 18.0686 };
const PARIS = { name: 'Paris, France', lat: 48.8566, lng: 2.3522 };

let intermediateStops = [];
let map;
let routeLayers = [];
let markerLayers = [];

function initMap() {
  map = L.map('map').setView([54.0, 10.0], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);

  addMarker(STOCKHOLM, 'A – Stockholm (Start)');
  addMarker(PARIS, 'B – Paris (Destination)');
  map.fitBounds([[STOCKHOLM.lat, STOCKHOLM.lng], [PARIS.lat, PARIS.lng]], { padding: [50, 50] });
}

function createNumberedIcon(label, color = '#0d6efd') {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      color: white;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function addMarker(stop, popupText) {
  const label = popupText.charAt(0);
  const color = (label === 'A' || label === 'B') ? '#0d6efd' : '#198754';
  const marker = L.marker([stop.lat, stop.lng], { icon: createNumberedIcon(label, color) })
    .addTo(map)
    .bindPopup(popupText);
  markerLayers.push(marker);
  return marker;
}

function clearMapOverlays() {
  routeLayers.forEach(l => map.removeLayer(l));
  markerLayers.forEach(l => map.removeLayer(l));
  routeLayers = [];
  markerLayers = [];
}

function getStopLabel(index, total) {
  return String.fromCharCode(65 + index);
}

function renderStops() {
  const container = document.getElementById('intermediate-stops');
  container.innerHTML = '';

  intermediateStops.forEach((stop, i) => {
    const label = getStopLabel(i + 1, intermediateStops.length + 2);

    const connector = document.createElement('div');
    connector.className = 'connector';
    container.appendChild(connector);

    const div = document.createElement('div');
    div.className = 'stop-item';
    div.dataset.index = i;
    div.innerHTML = `
      <span class="stop-label" style="background: #198754">${label}</span>
      <input type="text" value="${stop.name}" readonly class="stop-input" />
      <button class="stop-remove" data-index="${i}" title="Remove stop">&times;</button>
    `;
    container.appendChild(div);
  });

  // Update the destination label
  const destLabel = document.querySelector('.stop-item.destination .stop-label');
  if (destLabel) {
    destLabel.textContent = getStopLabel(intermediateStops.length + 1, intermediateStops.length + 2);
  }

  // Rebind remove buttons
  container.querySelectorAll('.stop-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      intermediateStops.splice(idx, 1);
      renderStops();
      updateMapMarkers();
    });
  });
}

function updateMapMarkers() {
  clearMapOverlays();
  const allStops = getAllStops();
  allStops.forEach((stop, i) => {
    const label = getStopLabel(i, allStops.length);
    const color = (i === 0 || i === allStops.length - 1) ? '#0d6efd' : '#198754';
    addMarker(stop, `${label} – ${stop.name}`);
  });

  if (allStops.length > 1) {
    const bounds = allStops.map(s => [s.lat, s.lng]);
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  // Hide route info when stops change
  document.getElementById('route-info').classList.add('hidden');
}

function getAllStops() {
  return [STOCKHOLM, ...intermediateStops, PARIS];
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RoadtripPlanner/1.0' }
  });
  const data = await res.json();
  if (data.length === 0) throw new Error(`Location not found: ${query}`);
  return {
    name: data[0].display_name.split(',').slice(0, 2).join(',').trim(),
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
  };
}

async function getRoute(waypoints) {
  const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('Routing failed');
  return data.routes[0];
}

async function getSegmentRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(`Routing failed: ${from.name} → ${to.name}`);
  return data.routes[0];
}

function formatDistance(meters) {
  const km = meters / 1000;
  return `${Math.round(km).toLocaleString()} km`;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

function displayRoute(geometry, color = '#0d6efd', weight = 5) {
  const coords = geometry.coordinates.map(c => [c[1], c[0]]);
  const polyline = L.polyline(coords, {
    color,
    weight,
    opacity: 0.7,
  }).addTo(map);
  routeLayers.push(polyline);
  return polyline;
}

async function calculateRoute() {
  const btn = document.getElementById('calculate-btn');
  const routeInfo = document.getElementById('route-info');
  const segmentsDiv = document.getElementById('route-segments');
  const totalDiv = document.getElementById('route-total');
  const includeReturn = document.getElementById('return-trip').checked;

  btn.disabled = true;
  btn.textContent = 'Calculating...';
  routeInfo.classList.add('hidden');

  try {
    clearMapOverlays();

    const forwardStops = getAllStops();
    const allStopsWithReturn = includeReturn
      ? [...forwardStops, ...forwardStops.slice(0, -1).reverse()]
      : forwardStops;

    // Add markers for forward trip
    forwardStops.forEach((stop, i) => {
      const label = getStopLabel(i, forwardStops.length);
      const color = (i === 0 || i === forwardStops.length - 1) ? '#0d6efd' : '#198754';
      addMarker(stop, `${label} – ${stop.name}`);
    });

    // Calculate each segment
    let segments = [];
    let totalDistance = 0;
    let totalDuration = 0;

    // Forward segments
    for (let i = 0; i < forwardStops.length - 1; i++) {
      const route = await getSegmentRoute(forwardStops[i], forwardStops[i + 1]);
      const fromLabel = getStopLabel(i, forwardStops.length);
      const toLabel = getStopLabel(i + 1, forwardStops.length);
      segments.push({
        label: `${fromLabel} → ${toLabel}`,
        from: forwardStops[i].name,
        to: forwardStops[i + 1].name,
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
        isReturn: false,
      });
      totalDistance += route.distance;
      totalDuration += route.duration;
      displayRoute(route.geometry, '#0d6efd');
    }

    // Return segments
    if (includeReturn) {
      const returnStops = [...forwardStops].reverse();
      for (let i = 0; i < returnStops.length - 1; i++) {
        const route = await getSegmentRoute(returnStops[i], returnStops[i + 1]);
        segments.push({
          label: `Return`,
          from: returnStops[i].name,
          to: returnStops[i + 1].name,
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry,
          isReturn: true,
        });
        totalDistance += route.distance;
        totalDuration += route.duration;
        displayRoute(route.geometry, '#dc3545', 4);
      }
    }

    // Render segments
    segmentsDiv.innerHTML = '';

    // Forward segments
    const forwardSegments = segments.filter(s => !s.isReturn);
    forwardSegments.forEach(seg => {
      segmentsDiv.innerHTML += `
        <div class="segment">
          <span class="segment-label">${seg.from} → ${seg.to}</span>
          <span class="segment-distance">${formatDistance(seg.distance)}</span>
          <span class="segment-time">${formatDuration(seg.duration)}</span>
        </div>
      `;
    });

    // Return segments
    if (includeReturn) {
      const returnSegments = segments.filter(s => s.isReturn);
      const returnDistance = returnSegments.reduce((a, s) => a + s.distance, 0);
      const returnDuration = returnSegments.reduce((a, s) => a + s.duration, 0);

      segmentsDiv.innerHTML += `<span class="return-label">Return trip</span>`;
      returnSegments.forEach(seg => {
        segmentsDiv.innerHTML += `
          <div class="segment">
            <span class="segment-label">${seg.from} → ${seg.to}</span>
            <span class="segment-distance">${formatDistance(seg.distance)}</span>
            <span class="segment-time">${formatDuration(seg.duration)}</span>
          </div>
        `;
      });
    }

    totalDiv.innerHTML = `
      <span>Total: ${formatDistance(totalDistance)}</span>
      <span>${formatDuration(totalDuration)}</span>
    `;

    routeInfo.classList.remove('hidden');

    // Fit map to show all routes
    const allCoords = forwardStops.map(s => [s.lat, s.lng]);
    map.fitBounds(allCoords, { padding: [50, 50] });

  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Calculate Route';
  }
}

// Event listeners
document.getElementById('add-stop-btn').addEventListener('click', async () => {
  const input = document.getElementById('new-stop-input');
  const query = input.value.trim();
  if (!query) return;

  const btn = document.getElementById('add-stop-btn');
  btn.disabled = true;
  btn.textContent = 'Finding...';

  try {
    const stop = await geocode(query);
    intermediateStops.push(stop);
    input.value = '';
    renderStops();
    updateMapMarkers();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Add Stop';
  }
});

document.getElementById('new-stop-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('add-stop-btn').click();
  }
});

document.getElementById('calculate-btn').addEventListener('click', calculateRoute);

// Initialize
initMap();
