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

// Add resize handling
const mapContainer = document.getElementById('map-container');
const resizeHandle = document.getElementById('resize-handle');
let isResizing = false;

resizeHandle.addEventListener('mousedown', (e) => {
  isResizing = true;
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  
  const containerRect = mapContainer.getBoundingClientRect();
  const newHeight = e.clientY - containerRect.top;
  
  // Apply min/max constraints
  const minHeight = 300;
  const maxHeight = window.innerHeight * 0.9;
  const constrainedHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);
  
  mapContainer.style.height = `${constrainedHeight}px`;
  map.invalidateSize();
});

document.addEventListener('mouseup', () => {
  isResizing = false;
});

// Export the map for use in other modules
export { map, zoom };