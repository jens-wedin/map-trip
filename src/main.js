import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

let stops = [
  { name: "Stockholm, Sweden", lat: 59.3293, lng: 18.0686 },
  { name: "Paris, France", lat: 48.8566, lng: 2.3522 },
];

let map;
let routeLayers = [];
let markerLayers = [];
let dragSrcIndex = null;
let tileLayer = null;
let currentTheme = localStorage.getItem("theme") || "light";

function initMap() {
  map = L.map("map").setView([54.0, 10.0], 5);
  updateMapTiles();

  renderStops();
  updateMapMarkers();
}

function updateMapTiles() {
  if (tileLayer) {
    map.removeLayer(tileLayer);
  }

  if (currentTheme === "dark") {
    tileLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
    );
  } else {
    tileLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      },
    );
  }

  tileLayer.addTo(map);
}

function createNumberedIcon(label, color = "#0d6efd") {
  return L.divIcon({
    className: "custom-marker",
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

function addMarker(stop, popupText, label, color) {
  const marker = L.marker([stop.lat, stop.lng], {
    icon: createNumberedIcon(label, color),
  })
    .addTo(map)
    .bindPopup(popupText);
  markerLayers.push(marker);
  return marker;
}

function clearMapOverlays() {
  routeLayers.forEach((l) => map.removeLayer(l));
  markerLayers.forEach((l) => map.removeLayer(l));
  routeLayers = [];
  markerLayers = [];
}

function getStopLabel(index) {
  return String.fromCharCode(65 + index);
}

function updateSubtitle() {
  const el = document.getElementById("subtitle");
  if (stops.length >= 2) {
    el.textContent = `${stops[0].name} \u2192 ${stops[stops.length - 1].name}`;
  } else if (stops.length === 1) {
    el.textContent = stops[0].name;
  } else {
    el.textContent = "Add stops to plan your trip";
  }
}

function renderStops() {
  const container = document.getElementById("stops-container");
  container.innerHTML = "";

  stops.forEach((stop, i) => {
    const label = getStopLabel(i);
    const isEndpoint = i === 0 || i === stops.length - 1;

    if (i > 0) {
      const connector = document.createElement("div");
      connector.className = "connector";
      container.appendChild(connector);
    }

    const div = document.createElement("div");
    div.className = "stop-item" + (isEndpoint ? " endpoint" : "");
    div.draggable = true;
    div.dataset.index = i;

    div.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">&#x2630;</span>
      <span class="stop-label" style="background: ${isEndpoint ? "#0d6efd" : "#198754"}">${label}</span>
      <input type="text" value="${stop.name}" readonly class="stop-input" />
      <button class="stop-remove" data-index="${i}" title="Remove stop">&times;</button>
    `;

    // Drag events
    div.addEventListener("dragstart", handleDragStart);
    div.addEventListener("dragover", handleDragOver);
    div.addEventListener("dragenter", handleDragEnter);
    div.addEventListener("dragleave", handleDragLeave);
    div.addEventListener("drop", handleDrop);
    div.addEventListener("dragend", handleDragEnd);

    container.appendChild(div);
  });

  // Rebind remove buttons
  container.querySelectorAll(".stop-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      stops.splice(idx, 1);
      renderStops();
      updateMapMarkers();
    });
  });

  updateSubtitle();
}

// Drag and drop handlers
function handleDragStart(e) {
  dragSrcIndex = parseInt(this.dataset.index);
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragSrcIndex);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function handleDragEnter(e) {
  e.preventDefault();
  const item = e.currentTarget;
  if (parseInt(item.dataset.index) !== dragSrcIndex) {
    item.classList.add("drag-over");
  }
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  const targetIndex = parseInt(e.currentTarget.dataset.index);
  if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;

  const [moved] = stops.splice(dragSrcIndex, 1);
  stops.splice(targetIndex, 0, moved);

  renderStops();
  updateMapMarkers();
}

function handleDragEnd() {
  this.classList.remove("dragging");
  document.querySelectorAll(".stop-item").forEach((item) => {
    item.classList.remove("drag-over");
  });
  dragSrcIndex = null;
}

function updateMapMarkers() {
  clearMapOverlays();
  stops.forEach((stop, i) => {
    const label = getStopLabel(i);
    const isEndpoint = i === 0 || i === stops.length - 1;
    const color = isEndpoint ? "#0d6efd" : "#198754";
    addMarker(stop, `${label} \u2013 ${stop.name}`, label, color);
  });

  if (stops.length > 1) {
    const bounds = stops.map((s) => [s.lat, s.lng]);
    map.fitBounds(bounds, { padding: [50, 50] });
  } else if (stops.length === 1) {
    map.setView([stops[0].lat, stops[0].lng], 8);
  }

  document.getElementById("route-info").classList.add("hidden");
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "RoadtripPlanner/1.0" },
  });
  const data = await res.json();
  if (data.length === 0) throw new Error(`Location not found: ${query}`);
  return {
    name: data[0].display_name.split(",").slice(0, 2).join(",").trim(),
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
  };
}

async function getSegmentRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== "Ok")
    throw new Error(`Routing failed: ${from.name} \u2192 ${to.name}`);
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

function displayRoute(geometry, color = "#0d6efd", weight = 5) {
  const coords = geometry.coordinates.map((c) => [c[1], c[0]]);
  const polyline = L.polyline(coords, {
    color,
    weight,
    opacity: 0.7,
  }).addTo(map);
  routeLayers.push(polyline);
  return polyline;
}

async function calculateRoute() {
  if (stops.length < 2) {
    alert("Add at least 2 stops to calculate a route.");
    return;
  }

  const btn = document.getElementById("calculate-btn");
  const routeInfo = document.getElementById("route-info");
  const segmentsDiv = document.getElementById("route-segments");
  const totalDiv = document.getElementById("route-total");
  const costDiv = document.getElementById("route-cost");
  const includeReturn = document.getElementById("return-trip").checked;
  const carType = document.getElementById("car-type").value;
  const pricePerKm = parseFloat(document.getElementById("price-per-km").value);

  btn.disabled = true;
  btn.textContent = "Calculating...";
  routeInfo.classList.add("hidden");

  try {
    clearMapOverlays();

    // Add markers
    stops.forEach((stop, i) => {
      const label = getStopLabel(i);
      const isEndpoint = i === 0 || i === stops.length - 1;
      const color = isEndpoint ? "#0d6efd" : "#198754";
      addMarker(stop, `${label} \u2013 ${stop.name}`, label, color);
    });

    let segments = [];
    let totalDistance = 0;
    let totalDuration = 0;

    // Forward segments
    for (let i = 0; i < stops.length - 1; i++) {
      const route = await getSegmentRoute(stops[i], stops[i + 1]);
      segments.push({
        from: stops[i].name,
        to: stops[i + 1].name,
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
        isReturn: false,
      });
      totalDistance += route.distance;
      totalDuration += route.duration;
      displayRoute(route.geometry, "#0d6efd");
    }

    // Return segments
    if (includeReturn) {
      const returnStops = [...stops].reverse();
      for (let i = 0; i < returnStops.length - 1; i++) {
        const route = await getSegmentRoute(returnStops[i], returnStops[i + 1]);
        segments.push({
          from: returnStops[i].name,
          to: returnStops[i + 1].name,
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry,
          isReturn: true,
        });
        totalDistance += route.distance;
        totalDuration += route.duration;
        displayRoute(route.geometry, "#dc3545", 4);
      }
    }

    // Render segments
    segmentsDiv.innerHTML = "";

    const forwardSegments = segments.filter((s) => !s.isReturn);
    forwardSegments.forEach((seg) => {
      segmentsDiv.innerHTML += `
        <div class="segment">
          <span class="segment-label">${seg.from} \u2192 ${seg.to}</span>
          <span class="segment-distance">${formatDistance(seg.distance)}</span>
          <span class="segment-time">${formatDuration(seg.duration)}</span>
        </div>
      `;
    });

    if (includeReturn) {
      const returnSegments = segments.filter((s) => s.isReturn);
      segmentsDiv.innerHTML += `<span class="return-label">Return trip</span>`;
      returnSegments.forEach((seg) => {
        segmentsDiv.innerHTML += `
          <div class="segment">
            <span class="segment-label">${seg.from} \u2192 ${seg.to}</span>
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

    // Display estimated cost if a price per km was entered
    if (!isNaN(pricePerKm) && pricePerKm > 0) {
      const totalKm = totalDistance / 1000;
      const totalCost = totalKm * pricePerKm;
      const carTypeLabel = carType.charAt(0).toUpperCase() + carType.slice(1);
      costDiv.innerHTML = `
        <span class="cost-label">${carTypeLabel} &mdash; Est. cost</span>
        <span class="cost-value">$${totalCost.toFixed(2)}</span>
      `;
      costDiv.classList.remove("hidden");
    } else {
      costDiv.classList.add("hidden");
    }

    routeInfo.classList.remove("hidden");

    const allCoords = stops.map((s) => [s.lat, s.lng]);
    map.fitBounds(allCoords, { padding: [50, 50] });
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Calculate Route";
  }
}

// Event listeners
document.getElementById("add-stop-btn").addEventListener("click", async () => {
  const input = document.getElementById("new-stop-input");
  const query = input.value.trim();
  if (!query) return;

  const btn = document.getElementById("add-stop-btn");
  btn.disabled = true;
  btn.textContent = "Finding...";

  try {
    const stop = await geocode(query);
    stops.push(stop);
    input.value = "";
    renderStops();
    updateMapMarkers();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "+ Add Stop";
  }
});

document.getElementById("new-stop-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    document.getElementById("add-stop-btn").click();
  }
});

document
  .getElementById("calculate-btn")
  .addEventListener("click", calculateRoute);

// Theme toggle
function toggleTheme() {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  localStorage.setItem("theme", currentTheme);

  const icon = document.querySelector(".theme-icon");
  icon.textContent = currentTheme === "dark" ? "☀️" : "🌙";

  if (map) {
    updateMapTiles();
  }
}

document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

// Initialize theme
document.documentElement.setAttribute("data-theme", currentTheme);
const themeIcon = document.querySelector(".theme-icon");
if (themeIcon) {
  themeIcon.textContent = currentTheme === "dark" ? "☀️" : "🌙";
}

// Mobile sidebar toggle
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("backdrop");
  const isOpen = sidebar.classList.contains("open");

  if (isOpen) {
    sidebar.classList.remove("open");
    backdrop.classList.remove("active");
    document.body.style.overflow = "";
  } else {
    sidebar.classList.add("open");
    backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

document.getElementById("menu-toggle").addEventListener("click", toggleSidebar);
document.getElementById("backdrop").addEventListener("click", toggleSidebar);

// Close sidebar after calculating route on mobile
const originalCalculateRoute = calculateRoute;
async function calculateRouteWithSidebarClose() {
  await originalCalculateRoute();
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById("sidebar");
    if (sidebar.classList.contains("open")) {
      toggleSidebar();
    }
  }
}
document
  .getElementById("calculate-btn")
  .removeEventListener("click", calculateRoute);
document
  .getElementById("calculate-btn")
  .addEventListener("click", calculateRouteWithSidebarClose);

// Initialize
initMap();
