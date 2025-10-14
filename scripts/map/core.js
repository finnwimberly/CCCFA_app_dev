// map/core.js

// Initialize the Leaflet map
const map = L.map('map', {
  center: [41.65, -70.2962], // Center on Cape Cod
  zoom: 7,                   // Initial zoom level
  crs: L.CRS.EPSG3857,       // Use standard Web Mercator CRS
  scrollWheelZoom: false,    // Disable zooming with scroll wheel
  zoomControl: false,        // Disable default zoom controls (we'll add them manually)
  attributionControl: false  // Disable default attribution control (we'll add it manually)
});

// New Esri Ocean basemap as the main basemap
const oceanBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
    maxZoom: 13
}).addTo(map);

// Add zoom control to top right
L.control.zoom({
  position: 'topright'
}).addTo(map);

// Create custom attribution control and add it to the attribution container
const attributionContainer = document.getElementById('map-attribution-container');
if (attributionContainer) {
  const attribution = L.control.attribution({
    position: 'bottomleft'
  });
  attribution.addAttribution('Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri');
  attribution.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
  attribution.addAttribution(' | <strong>Data Layers:</strong>');
  attribution.addTo(map);
  const attributionElement = attribution.getContainer();
  attributionContainer.appendChild(attributionElement);
}

// Initialize resize functionality
const mapContainer = document.getElementById('map-container');
const resizeHandle = document.querySelector('.resize-handle');

let isResizing = false;
let startY;
let startHeight;

// Add touch event support for mobile devices
resizeHandle.addEventListener('touchstart', initResize);
resizeHandle.addEventListener('touchmove', resize);
resizeHandle.addEventListener('touchend', stopResize);

resizeHandle.addEventListener('mousedown', initResize);
document.addEventListener('mousemove', resize);
document.addEventListener('mouseup', stopResize);

function initResize(e) {
  isResizing = true;
  startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
  startHeight = mapContainer.offsetHeight;
  e.preventDefault();
}

function resize(e) {
  if (!isResizing) return;
  const currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
  const deltaY = currentY - startY;
  const newHeight = startHeight + deltaY;
  const minHeight = Math.min(400, window.innerHeight * 0.3);
  const maxHeight = window.innerHeight * 0.9;
  requestAnimationFrame(() => {
    mapContainer.style.height = `${Math.min(Math.max(newHeight, minHeight), maxHeight)}px`;
    map.invalidateSize();
  });
}

function stopResize() {
  isResizing = false;
}

// Add window resize handler
window.addEventListener('resize', () => {
  clearTimeout(window.resizeTimeout);
  window.resizeTimeout = setTimeout(() => {
    map.invalidateSize();
  }, 250);
});

// Fix for Safari height issues
if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
  const updateMapHeight = () => {
    const vh = window.innerHeight * 0.8;
    mapContainer.style.height = `${vh}px`;
    map.invalidateSize();
  };
  window.addEventListener('resize', updateMapHeight);
  updateMapHeight();
}

export { map };


