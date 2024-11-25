import { map } from './map-setup.js';

// Define the bounds for overlays
const sstBounds = [
  [22.10094038809318, -85.07147246852169],  // Southwest corner
  [46.06097789174021, -59.94347394762814], // Northeast corner
];

// SST overlay (Sea Surface Temperature)
const sstOverlay = L.tileLayer('/processed_data/SST/tiles_3day/{z}/{x}/{y}.png', {
  opacity: 0.6, // Semi-transparent layer
  attribution: 'SST Data',
  maxZoom: 10,
  bounds: sstBounds,
  noWrap: true,
});

// SSS overlay (Sea Surface Salinity)
const sssOverlay = L.tileLayer('/processed_data/SSS/tiles_mirrored/{z}/{x}/{y}.png', {
  opacity: 0.6, // Semi-transparent layer
  attribution: 'SSS Data',
  maxZoom: 10,
  bounds: sstBounds,
  noWrap: true,
});

// Bathymetry overlay
const bathymetryLayer = L.imageOverlay('/bathymetry_contours.png', sstBounds, {
  opacity: 1, // Fully opaque layer
  attribution: 'Bathymetry Data',
});

// Layer control (toggle overlays)
const overlayLayers = {
  'SST (Sea Surface Temp)': sstOverlay,
  'SSS (Sea Surface Salinity)': sssOverlay,
  'Bathymetry Contours': bathymetryLayer,
};

// Add the layer control to the map
// L.control.layers(null, overlayLayers, { collapsed: false }).addTo(map);

// Show or hide the legend when overlays are toggled
map.on('overlayadd', (event) => {
  if (event.name === 'SST (Sea Surface Temp)') {
    document.getElementById('sst-legend').style.display = 'block'; // Show SST legend
  }
  if (event.name === 'SSS (Sea Surface Salinity)') {
    document.getElementById('sss-legend').style.display = 'block'; // Show SSS legend
  }
});

map.on('overlayremove', (event) => {
  if (event.name === 'SST (Sea Surface Temp)') {
    document.getElementById('sst-legend').style.display = 'none'; // Hide SST legend
  }
  if (event.name === 'SSS (Sea Surface Salinity)') {
    document.getElementById('sss-legend').style.display = 'none'; // Hide SSS legend
  }
});

// Export layers for use in other scripts
export { sstOverlay, sssOverlay, bathymetryLayer };