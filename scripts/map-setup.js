import { loadProfiles, attachMarkerHandlers } from './map.js';

// Initialize the Leaflet map
const map = L.map('map', {
  center: [41.85, -70.2962], // Center on Cape Cod
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
  
  const newHeight = startHeight + (e.clientY - startY);
  // Set minimum and maximum heights
  const minHeight = 300;
  const maxHeight = window.innerHeight * 0.9;
  
  mapContainer.style.height = `${Math.min(Math.max(newHeight, minHeight), maxHeight)}px`;
  map.invalidateSize(); // Update map size
}

function stopResize() {
  isResizing = false;
  document.removeEventListener('mousemove', resize);
  document.removeEventListener('mouseup', stopResize);
}

// Initialize with a default date range (e.g., from August 1, 2024, to today)
const startDate = moment('2024-08-01', 'YYYY-MM-DD');
const endDate = moment();
loadProfiles(startDate, endDate);
attachMarkerHandlers();

let zoom = map.getZoom(); 

// Add test zoom listener
map.on('zoomend', () => {
  // console.log('Zoom event fired - current zoom level:', map.getZoom());
  zoom = map.getZoom(); 
});

// Export the map for use in other modules
export { map, zoom };