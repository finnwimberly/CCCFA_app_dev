import { loadProfiles, attachMarkerHandlers } from './map.js';

// Initialize the Leaflet map
const map = L.map('map', {
  center: [41.85, -70.2962], // Center on Cape Cod
  zoom: 9,                   // Initial zoom level
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


// Export the map for use in other modules
export { map };