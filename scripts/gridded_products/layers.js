import { map } from '../map/core.js';
import { controlsState, layerState } from '../state.js';
import { getTilePath, getRangePath, getColormapPath, BATHYMETRY_TILES } from '../config.js';

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
  // Get the legend container element
  const legendId = `${layerType.toLowerCase().replace('_', '-')}-legend`;
  console.log(`Creating legend for ${layerType}`);
  
  const legendContainer = document.getElementById(legendId);
  
  // Hide all other legend containers first and remove their styling
  const allLegendContainers = document.querySelectorAll('[id$="-legend"]');
  allLegendContainers.forEach(container => {
    if (container.id !== legendId) {
      container.style.display = 'none';
      container.innerHTML = ''; // Clear their contents
      container.style.background = 'none';
      container.style.border = 'none';
      container.style.boxShadow = 'none';
      container.style.padding = '0';
      container.style.margin = '0';
    }
  });

  // Reset the current container's styling before creating new content
  if (legendContainer) {
    legendContainer.style.background = 'white';
    legendContainer.style.border = '1px solid #ddd';
    legendContainer.style.borderRadius = '4px';
    legendContainer.style.padding = '10px';
    legendContainer.style.margin = '10px';
    legendContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0)';
  }

  // Determine the active overlay layer
  const overlay = layerType === 'SST' ? sstOverlay 
                 : layerType === 'SSS' ? sssOverlay 
                 : layerType === 'CHL' ? chlOverlay
                 : layerType === 'OSTIA_SST' ? ostiaSstOverlay
                 : layerType === 'OSTIA_anomaly' ? ostiaAnomalyOverlay
                 : layerType === 'DOPPIO' ? doppioOverlay
                 : null;

  const zoomLevel = map.getZoom();

  // Check the selected unit system (metric or imperial)
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;

  // Check if a valid date is provided
  if (!date) {
    // Uncheck the layer toggle box
    const checkbox = document.getElementById(`${layerType.toLowerCase().replace('_', '-')}-toggle`);
    if (checkbox) {
      checkbox.checked = false; // Uncheck the checkbox
    }

    // Hide the legend container
    if (legendContainer) {
      legendContainer.style.display = 'none';
    }

    // Remove the layer from the map
    if (map.hasLayer(overlay)) {
      map.removeLayer(overlay); // Ensure the layer is not selected
    }

    // Show the modal message
    showModal("Please select a date for the layer first.");
    return; // Exit the function
  }

  // Dynamically determine file paths based on zoom level
  let rangeFile;
  if (layerType === 'SST') {
    rangeFile = zoomLevel >= 8
      ? getRangePath(layerType, date, true)
      : getRangePath(layerType, date, false);
  } else if (layerType === 'SSS') {
    rangeFile = zoomLevel >= 8
      ? getRangePath(layerType, date, true)
      : getRangePath(layerType, date, false);
  } else if (layerType === 'CHL') {
    rangeFile = zoomLevel >= 8
      ? getRangePath(layerType, date, true)
      : getRangePath(layerType, date, false);
  } else if (layerType === 'OSTIA_SST') {
    rangeFile = zoomLevel >= 8
      ? getRangePath(layerType, date, true)
      : getRangePath(layerType, date, false);
  } else if (layerType === 'OSTIA_anomaly') {
    rangeFile = zoomLevel >= 8
      ? getRangePath(layerType, date, true)
      : getRangePath(layerType, date, false);
  } 

  const colormapFile = getColormapPath(layerType);

  // Handle DOPPIO separately: it uses a static min/max range and does not have a range file
  const loadLegendData = layerType === 'DOPPIO'
    ? Promise.all([
        fetch(colormapFile).then((res) => res.text()),
        Promise.resolve({ min_SST: 1.0, max_SST: 25.0 })
      ])
    : Promise.all([
        fetch(colormapFile).then((res) => res.text()),
        fetch(rangeFile).then((res) => res.json())
      ]);

  loadLegendData
    .then(([colormapText, range]) => {
      
      const rgbValues = colormapText.split('\n')
        .filter((line) => line.trim())
        .map((line) => line.split(' ').map(Number));

      // Get min and max values
      let minValue, maxValue;

      if (layerType === 'SST') {
        minValue = range.min_temp;
        maxValue = range.max_temp;
      } else if (layerType === 'SSS') {
        minValue = range.min_SSS;
        maxValue = range.max_SSS;
      } else if (layerType === 'CHL') {
        minValue = range.min_chl;
        maxValue = range.max_chl;
      } else if (layerType === 'OSTIA_SST') { 
        minValue = range.min_SST;
        maxValue = range.max_SST;
      } else if (layerType === 'OSTIA_anomaly') {
        minValue = range.min_SSTA;
        maxValue = range.max_SSTA;
      } else if (layerType === 'DOPPIO') {
        minValue = range.min_SST;
        maxValue = range.max_SST;
      }

      // Convert to Fahrenheit if the unit system is imperial
      if (unitSystem === 'imperial') {
        if (layerType === 'SST' || layerType === 'OSTIA_SST' || layerType === 'DOPPIO') {
          // For absolute temperatures, convert using the full formula
          minValue = (minValue * 9) / 5 + 32;
          maxValue = (maxValue * 9) / 5 + 32;
        } else if (layerType === 'OSTIA_anomaly') {
          // For anomalies, just multiply by 1.8 (no offset needed)
          minValue = minValue * 1.8;
          maxValue = maxValue * 1.8;
        }
      }

      const colorscale = rgbValues.map((rgb, i) => {
        const [index, r, g, b, a] = rgb; // Ensure we use all 5 columns (including alpha)
        if (i === 0 || i === rgbValues.length - 1) {
          return [i / (rgbValues.length - 1), 'rgba(255, 255, 255, 0)'];
        }
        return [i / (rgbValues.length - 1), `rgba(${r}, ${g}, ${b}, ${a / 255})`];
      });

      const layout = {
        title: {
          text: layerType === 'CHL' ? 'Chl (mg/m³)' 
                : layerType === 'SST' || layerType === 'OSTIA_SST' ? `SST (${unitSystem === 'imperial' ? '°F' : '°C'})`
                // : layerType === 'SST' || layerType === 'OSTIA_SST' || layerType === 'DOPPIO' ? `SST (${unitSystem === 'imperial' ? '°F' : '°C'})`
                : layerType === 'OSTIA_anomaly' ? `SSTA (${unitSystem === 'imperial' ? '°F' : '°C'})`
                : layerType === 'DOPPIO' ? `Bottom Temp. (${unitSystem === 'imperial' ? '°F' : '°C'})`
                : 'SSS (PSU)',
          font: {
            size: 14,
            family: 'Arial, sans-serif',
            color: '#333'
          }
        },
        width: 120,
        height: 280,
        margin: { l: 0, r: 30, t: 40, b: 20 },
        xaxis: { visible: false },
        yaxis: { visible: false },
        coloraxis: {
          colorbar: {
            len: 0.9,
            thickness: 20,
            tickformat: '.1f',
            x: 0.5,
            xanchor: 'center',
            y: 0.5,
            yanchor: 'middle'
          }
        }
      };

      const legendData = {
        z: [[minValue, maxValue]],
        type: 'heatmap',
        colorscale: colorscale,
        showscale: true,
        hoverinfo: 'none',
        colorbar: {
          len: 0.9,
          thickness: 20,
          tickformat: '.1f',
          x: 0.5,
          xanchor: 'center',
          y: 0.5,
          yanchor: 'middle'
        }
      };
      
      // Apply different tick positioning for CHL log scale
      if (layerType === 'CHL') {
        const numTicks = 6;  // Number of tick marks
        const logMin = Math.log10(minValue);
        const logMax = Math.log10(maxValue);
    
        // Step 1: Generate log-scaled values for labels
        const logValues = Array.from({ length: numTicks }, (_, i) =>
            Math.pow(10, logMin + (i / (numTicks - 1)) * (logMax - logMin))
        );
    
        // Step 2: Map log values to linear positions (0 to 1) for colorbar
        // const tickPositions = logValues.map(v => (Math.log10(v) - logMin) / (logMax - logMin));
        const minColorbar = 1;  // Min of scaled data
        const maxColorbar = 255;  // Max of scaled data
        const tickPositions = logValues.map(v =>
          minValue + ((Math.log10(v) - logMin) / (logMax - logMin)) * (maxValue - minValue)
        );

        // Step 3: Assign tick positions & labels
        legendData.colorbar.tickmode = 'array';
        legendData.colorbar.tickvals = tickPositions;  // Linear positions
        legendData.colorbar.ticktext = logValues.map(t => t.toPrecision(2)); // Logarithmic labels
    
      }   else {
        // Default linear tick mode for SST & SSS
        legendData.colorbar.tickmode = 'linear';
        legendData.colorbar.tick0 = minValue;
        legendData.colorbar.dtick = (maxValue - minValue) / 5;
      }
      
      // Plot legend with updated settings
      
      try {
        // First check if the container exists and is empty
        const container = document.getElementById(legendId);
        if (!container) {
          throw new Error(`Legend container ${legendId} not found`);
        }
        
        // Clear any existing content
        container.innerHTML = '';
        
        // Create the plot
        Plotly.newPlot(legendId, [legendData], layout)
          .then(() => {
            // Check if the plot was created
            const plotElement = container.querySelector('.plotly');
            if (plotElement) {
            } else {
              console.error(`Plot element not found in container ${legendId}`);
            }
          })
          .catch(err => {
            console.error(`Error creating Plotly plot:`, err);
            // Log the container's content after the error
          });
        
        // Ensure legend container is visible
        if (legendContainer) {
          legendContainer.style.display = 'block';
        } else {
          console.error(`Legend container ${legendId} not found!`);
        }
      } catch (err) {
        console.error(`Error in legend creation process:`, err);
      }
    })
    .catch((err) => {
      console.error(`Error loading ${layerType} legend data:`, err);
      // Hide the legend container on error
      if (legendContainer) {
        legendContainer.style.display = 'none';
      }
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
