import { map } from '../map/core.js';
import { controlsState, layerState } from '../state.js';
import { getTilePath, getColormapPath, BATHYMETRY_TILES, SEASONAL_LIMITS_GLOBAL, SEASONAL_LIMITS_LOCAL, ZOOM_THRESHOLD, getSeasonFromDate } from '../config.js';
import { createColorbarLegend } from './legend.js';

// Define the bounds for overlays
const sstBounds = [
  [22.10094038809318, -85.07147246852169],
  [46.06097789174021, -59.94347394762814],
];

// Initialize with null paths - we'll set these when we know the latest date
let sstOverlay = L.tileLayer('', {
  opacity: 0.9,
  attribution: 'SST Data',
  maxZoom: 10,
  bounds: sstBounds,
  noWrap: true,
});

let sssOverlay = L.tileLayer('', {
  opacity: 0.9,
  attribution: 'SSS Data',
  maxZoom: 10,
  bounds: sstBounds,
  noWrap: true,
});

let chlOverlay = L.tileLayer('', {
  opacity: 0.9,
  attribution: 'Chlorophyll-a Data',
  maxZoom: 10,
  bounds: sstBounds, // Assuming same bounds as SST/SSS
  noWrap: true,
});

// Add OSTIA SST and anomaly layers
let ostiaSstOverlay = L.tileLayer('', {
  opacity: 0.9,
  attribution: 'OSTIA SST Data',
  maxZoom: 10,
  bounds: sstBounds,
  noWrap: true,
});

let ostiaAnomalyOverlay = L.tileLayer('', {
  opacity: 0.9,
  attribution: 'OSTIA SST Anomaly Data',
  maxZoom: 10,
  bounds: sstBounds,
  noWrap: true,
});

const doppioBounds = [
  [20, -85],
  [50, -40],
];

let doppioOverlay = L.tileLayer('', {
  opacity: 0.9,
  attribution: 'Doppio Forecast',
  maxZoom: 10,
  bounds: doppioBounds, 
  noWrap: true,
});

// Define bathymetry tile paths (centralized in config)
const bathymetryLayers = BATHYMETRY_TILES;

// Function to determine active unit system
function getSelectedUnitSystem() {
  return document.querySelector('input[name="unit"]:checked').value === 'imperial'
    ? 'imperial'
    : 'metric';
}

function updateBathymetryLayer() {
  const unitSystem = getSelectedUnitSystem(); // Get selected unit
  const newPath = bathymetryLayers[unitSystem]; // Determine new path

  console.log(`Updating bathymetry layer: ${unitSystem} -> ${newPath}`);

  // Check if bathymetry layer is currently active
  const wasActive = map.hasLayer(bathymetryLayer);

  // Remove the old layer
  if (wasActive) {
    map.removeLayer(bathymetryLayer);
  }

  // Create a new bathymetry layer with the correct unit-based tiles
  bathymetryLayer = L.tileLayer(newPath, {
    minZoom: 0,
    maxZoom: 11,
    tms: false,
    opacity: 1,
    attribution: 'Bathymetry Data',
    noWrap: true,
    className: 'bathymetryLayer',
    zIndex: 1000
  });

  // **Only add back the bathymetry layer if it was already active**
  if (wasActive) {
    map.addLayer(bathymetryLayer);
  }
}

// Initialize bathymetry layer with the default selection
let bathymetryLayer = L.tileLayer(bathymetryLayers[getSelectedUnitSystem()], {
  minZoom: 0,
  maxZoom: 11,
  tms: false,
  opacity: 1,
  attribution: 'Bathymetry Data',
  noWrap: true,
  className: 'bathymetryLayer',
  zIndex: 1000
});

// Bathymetry layer is now controlled by checkbox toggle only
// map.addLayer(bathymetryLayer);

// Add event listener to unit selector to reload bathymetry layer when changed
document.querySelectorAll('input[name="unit"]').forEach((radio) => {
  radio.addEventListener('change', updateBathymetryLayer);
});

function showModal(message) {
  // Create modal elements
  const modal = document.createElement('div');
  modal.id = 'layer-modal';
  modal.innerHTML = `
    <div id="layer-overlay"></div>
    <div id="layer-modal-content">
      <span id="layer-modal-close">&times;</span>
      <p>${message}</p>
    </div>
  `;

  // Append modal to the map container
  const mapContainer = document.getElementById('map');
  mapContainer.appendChild(modal);

  // Close modal logic
  document.getElementById('layer-modal-close').addEventListener('click', () => {
    mapContainer.removeChild(modal);
  });

  document.getElementById('layer-overlay').addEventListener('click', () => {
    mapContainer.removeChild(modal);
  });
}


// Helper function to generate legend
function createLegend(layerType, date) {
  const legendId = `${layerType.toLowerCase().replace('_', '-')}-legend`;
  console.log(`Creating legend for ${layerType}`);

  // Determine the active overlay layer
  const overlay = layerType === 'SST' ? sstOverlay
                 : layerType === 'SSS' ? sssOverlay
                 : layerType === 'CHL' ? chlOverlay
                 : layerType === 'OSTIA_SST' ? ostiaSstOverlay
                 : layerType === 'OSTIA_anomaly' ? ostiaAnomalyOverlay
                 : layerType === 'DOPPIO' ? doppioOverlay
                 : null;

  // Check if a valid date is provided
  if (!date) {
    const checkbox = document.getElementById(`${layerType.toLowerCase().replace('_', '-')}-toggle`);
    if (checkbox) checkbox.checked = false;

    const legendContainer = document.getElementById(legendId);
    if (legendContainer) legendContainer.style.display = 'none';

    if (map.hasLayer(overlay)) map.removeLayer(overlay);

    showModal("Please select a date for the layer first.");
    return;
  }

  // Check the selected unit system (metric or imperial)
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;

  // Look up seasonal min/max from config, switching limits at zoom threshold
  const season = getSeasonFromDate(date);
  const limits = map.getZoom() >= ZOOM_THRESHOLD ? SEASONAL_LIMITS_LOCAL : SEASONAL_LIMITS_GLOBAL;
  let [minValue, maxValue] = limits[layerType][season];

  // Convert to imperial units if needed
  if (unitSystem === 'imperial') {
    if (layerType === 'SST' || layerType === 'OSTIA_SST' || layerType === 'DOPPIO') {
      minValue = (minValue * 9) / 5 + 32;
      maxValue = (maxValue * 9) / 5 + 32;
    } else if (layerType === 'OSTIA_anomaly') {
      minValue = minValue * 1.8;
      maxValue = maxValue * 1.8;
    }
  }

  // Build title
  const title = layerType === 'CHL' ? 'Chl (mg/m³)'
    : layerType === 'SST' || layerType === 'OSTIA_SST' ? `SST (${unitSystem === 'imperial' ? '°F' : '°C'})`
    : layerType === 'OSTIA_anomaly' ? `SSTA (${unitSystem === 'imperial' ? '°F' : '°C'})`
    : layerType === 'DOPPIO' ? `Bottom Temp. (${unitSystem === 'imperial' ? '°F' : '°C'})`
    : 'SSS (PSU)';

  // Build tick config — CHL uses log-scale ticks
  let tickOverride = null;
  if (layerType === 'CHL') {
    const numTicks = 6;
    const logMin = Math.log10(minValue);
    const logMax = Math.log10(maxValue);

    const logValues = Array.from({ length: numTicks }, (_, i) =>
      Math.pow(10, logMin + (i / (numTicks - 1)) * (logMax - logMin))
    );

    const tickPositions = logValues.map(v =>
      minValue + ((Math.log10(v) - logMin) / (logMax - logMin)) * (maxValue - minValue)
    );

    tickOverride = {
      tickmode: 'array',
      tickvals: tickPositions,
      ticktext: logValues.map(t => t.toPrecision(2))
    };
  }

  createColorbarLegend({
    legendId,
    colormapUrl: getColormapPath(layerType, date),
    minValue,
    maxValue,
    title,
    tickOverride
  });

  console.log(`Creating legend for ${layerType} with date: ${date}`);
}

document.querySelectorAll('input[name="unit"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    // Recreate the legend for the active layer if one is selected
    if (controlsState.activeLayerType && layerState.tileDate) {
      createLegend(controlsState.activeLayerType, layerState.tileDate);
    }
  });
});

function updateLayerPaths(date) {
  layerState.tileDate = date; // Update the global tileDate variable

  const sstPath = getTilePath('SST', date);
  const sssPath = getTilePath('SSS', date);
  const chlPath = getTilePath('CHL', date);
  const ostiaSstPath = getTilePath('OSTIA_SST', date);
  const ostiaAnomalyPath = getTilePath('OSTIA_anomaly', date);
  const doppioPath = getTilePath('DOPPIO', date);

  console.log('Constructed SST path:', sstPath);
  console.log('Constructed SSS path:', sssPath);
  console.log('Constructed CHL path:', chlPath);
  console.log('Constructed OSTIA SST path:', ostiaSstPath);
  console.log('Constructed OSTIA Anomaly path:', ostiaAnomalyPath);
  console.log('Constructed Doppio path:', doppioPath);

  sstOverlay.setUrl(sstPath);
  sssOverlay.setUrl(sssPath);
  chlOverlay.setUrl(chlPath);
  ostiaSstOverlay.setUrl(ostiaSstPath);
  ostiaAnomalyOverlay.setUrl(ostiaAnomalyPath);
  doppioOverlay.setUrl(doppioPath);

  console.log('Checking active layers...');
  console.log('Is SST overlay active?', map.hasLayer(sstOverlay));
  console.log('Is SSS overlay active?', map.hasLayer(sssOverlay));
  console.log('Is CHL overlay active?', map.hasLayer(chlOverlay));
  console.log('Is OSTIA SST overlay active?', map.hasLayer(ostiaSstOverlay));
  console.log('Is OSTIA Anomaly overlay active?', map.hasLayer(ostiaAnomalyOverlay));
  console.log('Is Doppio overlay active?', map.hasLayer(doppioOverlay));

  if (map.hasLayer(sstOverlay)) {
    createLegend('SST', date);
  } else if (map.hasLayer(sssOverlay)) {
    createLegend('SSS', date);
  } else if (map.hasLayer(chlOverlay)) {
    createLegend('CHL', date);
  } else if (map.hasLayer(ostiaSstOverlay)) {
    createLegend('OSTIA_SST', date);
  } else if (map.hasLayer(ostiaAnomalyOverlay)) {
    createLegend('OSTIA_anomaly', date);
  } else if (map.hasLayer(doppioOverlay)) {
    createLegend('DOPPIO', date);
  }

  // Update fishbot layer if it's active (using dynamic import to avoid circular dependency)
  if (typeof window !== 'undefined' && window.updateFishbotForDate) {
    window.updateFishbotForDate(date);
  }
}

map.on('zoomend', () => {
  console.log(`Zoomend triggered, activeLayerType: ${controlsState.activeLayerType}`);
  if (controlsState.activeLayerType && layerState.tileDate) {
    console.log(`Zoom level changed to ${map.getZoom()}, refreshing legend for: ${controlsState.activeLayerType}`);
    createLegend(controlsState.activeLayerType, layerState.tileDate);
  } else {
    console.log("No valid date or layer selected; skipping legend update.");
  }
});

// Export necessary variables and functions
export { sstOverlay, sssOverlay, chlOverlay, ostiaSstOverlay, ostiaAnomalyOverlay, doppioOverlay, bathymetryLayer, updateLayerPaths, createLegend, getSelectedUnitSystem };
