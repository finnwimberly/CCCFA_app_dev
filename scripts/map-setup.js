import { loadProfiles } from './map.js';

// Initialize the Leaflet map
const map = L.map('map', {
  center: [41.65, -70.2962], // Center on Cape Cod
  zoom: 7,                   // Initial zoom level
  crs: L.CRS.EPSG3857,       // Use standard Web Mercator CRS
  scrollWheelZoom: false,    // Disable zooming with scroll wheel
  zoomControl: true,         // Add default zoom controls
});

// Add the CartoDB Positron tile layer (base map)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
}).addTo(map);

// Initialize resize functionality
const mapContainer = document.getElementById('map-container');
const resizeHandle = document.querySelector('.resize-handle');

let isResizing = false;
let startY;
let startHeight;

resizeHandle.addEventListener('mousedown', initResize);

function initResize(e) {
  isResizing = true;
  startY = e.clientY;
  startHeight = mapContainer.offsetHeight;
  
  document.addEventListener('mousemove', resize);
  document.addEventListener('mouseup', stopResize);
}

function resize(e) {
  if (!isResizing) return;
  const deltaY = e.clientY - startY;
  const newHeight = startHeight + deltaY;
  
  // Set minimum and maximum heights
  const minHeight = 400; // Increased from 300 to 400 to provide more space for controls
  const maxHeight = window.innerHeight * 0.9;
  
  mapContainer.style.height = `${Math.min(Math.max(newHeight, minHeight), maxHeight)}px`;
  map.invalidateSize(); // Update map size
}

function stopResize(e) {
  isResizing = false;
  document.removeEventListener('mousemove', resize);
  document.removeEventListener('mouseup', stopResize);

  // Only try to prevent default if e is defined
  if (e) {
    // Prevent default behaviors
    e.preventDefault();
    e.stopPropagation();
  }
}

// Export only the map
export { map };