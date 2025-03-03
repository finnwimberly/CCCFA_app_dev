import {map, zoom} from './map-setup.js';
import { activeLayerType } from './controls.js';

// Define the bounds for overlays
const sstBounds = [
  [22.10094038809318, -85.07147246852169],
  [46.06097789174021, -59.94347394762814],
];

// Initialize with null paths - we'll set these when we know the latest date
let sstOverlay = L.tileLayer('', {
  opacity: 0.6,
  attribution: 'SST Data',
  maxZoom: 10,
  bounds: sstBounds,
  noWrap: true,
});

let sssOverlay = L.tileLayer('', {
  opacity: 0.6,
  attribution: 'SSS Data',
  maxZoom: 10,
  bounds: sstBounds,
  noWrap: true,
});

let chlOverlay = L.tileLayer('', {
  opacity: 0.6,
  attribution: 'Chlorophyll-a Data',
  maxZoom: 10,
  bounds: sstBounds, // Assuming same bounds as SST/SSS
  noWrap: true,
});


// Define bathymetry tile paths
const bathymetryPaths = {
  metric: '../data/bathymetry_tiles_m/{z}/{x}/{y}.png',
  imperial: '../data/bathymetry_tiles/{z}/{x}/{y}.png'
};

// Function to determine active unit system
function getSelectedUnitSystem() {
  return document.querySelector('input[name="unit"]:checked').value === 'imperial'
    ? 'imperial'
    : 'metric';
}

function updateBathymetryLayer() {
  const unitSystem = getSelectedUnitSystem(); // Get selected unit
  const newPath = bathymetryPaths[unitSystem]; // Determine new path

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
    className: 'bathymetryLayer'
  });

  // **Only add back the bathymetry layer if it was already active**
  if (wasActive) {
    map.addLayer(bathymetryLayer);
  }
}

// Initialize bathymetry layer with the default selection
let bathymetryLayer = L.tileLayer(bathymetryPaths[getSelectedUnitSystem()], {
  minZoom: 0,
  maxZoom: 11,
  tms: false,
  opacity: 1,
  attribution: 'Bathymetry Data',
  noWrap: true,
  className: 'bathymetryLayer'
});

// Add event listener to unit selector to reload bathymetry layer when changed
document.querySelectorAll('input[name="unit"]').forEach((radio) => {
  radio.addEventListener('change', updateBathymetryLayer);
});

const overlayLayers = {
  'SST (Sea Surface Temp)': sstOverlay,
  'SSS (Sea Surface Salinity)': sssOverlay,
  'CHL (Chlorophyll-a)': chlOverlay,
  'Bathymetry Contours': bathymetryLayer,
};

// Initialize a global tileDate variable
let tileDate = null; // Default value

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

// // Helper function to generate legend
// function createLegend(layerType, date) {
//   // Get the legend container element
//   const legendContainer = document.getElementById(`${layerType.toLowerCase()}-legend`);
//   // Determine the active overlay layer
//   const overlay = layerType === 'SST' ? sstOverlay 
//                  : layerType === 'SSS' ? sssOverlay 
//                  : chlOverlay; // Add CHL overlay reference

//   const zoomLevel = map.getZoom();

//   // Check the selected unit system (metric or imperial)
//   const unitSystem = document.querySelector('input[name="unit"]:checked').value;

//   // Check if a valid date is provided
//   if (!date) {
//     // Uncheck the layer toggle box
//     const checkbox = document.getElementById(`${layerType.toLowerCase()}-toggle`);
//     if (checkbox) {
//       checkbox.checked = false; // Uncheck the checkbox
//     }

//     // Hide the legend container
//     if (legendContainer) {
//       legendContainer.style.display = 'none';
//     }

//     // Remove the layer from the map
//     if (map.hasLayer(overlay)) {
//       map.removeLayer(overlay); // Ensure the layer is not selected
//     }

//     // Show the modal message
//     showModal("Please select a date for the layer first.");
//     return; // Exit the function
//   }

//   // Dynamically determine file paths based on zoom level
//   let rangeFile;
//   if (layerType === 'SST') {
//     rangeFile = zoomLevel >= 8
//       ? `../data/SST/tiles_3day/${date}/sst_range_local.json`
//       : `../data/SST/tiles_3day/${date}/sst_range_global.json`;
//   } else if (layerType === 'SSS') {
//     rangeFile = zoomLevel >= 8
//       ? `../data/SSS/tiles_mirrored/${date}/sss_range_local.json`
//       : `../data/SSS/tiles_mirrored/${date}/sss_range_global.json`;
//   } else if (layerType === 'CHL') {
//     rangeFile = zoomLevel >= 8
//       ? `../data/CHL/tiles/${date}/chl_range_local.json`
//       : `../data/CHL/tiles/${date}/chl_range_global.json`;
//   }

//   const colormapFile = `../data/${layerType}/thermal_colormap.txt`;

//   Promise.all([
//     fetch(colormapFile).then((res) => res.text()),
//     fetch(rangeFile).then((res) => res.json()),
//   ])
//     .then(([colormapText, range]) => {
//       const rgbValues = colormapText.split('\n')
//         .filter((line) => line.trim())
//         .map((line) => line.split(' ').map(Number));

//       // Get min and max values
//       let minValue, maxValue;

//       if (layerType === 'SST') {
//         minValue = range.min_temp;
//         maxValue = range.max_temp;
//       } else if (layerType === 'SSS') {
//         minValue = range.min_SSS;
//         maxValue = range.max_SSS;
//       } else if (layerType === 'CHL') {
//         minValue = range.min_chl;
//         maxValue = range.max_chl;
//       }


//       // Convert to Fahrenheit if the unit system is imperial
//       if (unitSystem === 'imperial' && layerType === 'SST') {
//         minValue = (minValue * 9) / 5 + 32;
//         maxValue = (maxValue * 9) / 5 + 32;
//       }

//       const colorscale = rgbValues.map((rgb, i) => {
//         const [index, r, g, b, a] = rgb; // Ensure we use all 5 columns (including alpha)
//         if (i === 0 || i === rgbValues.length - 1) {
//           return [i / (rgbValues.length - 1), 'rgba(255, 255, 255, 0)'];
//         }
//         return [i / (rgbValues.length - 1), `rgba(${r}, ${g}, ${b}, ${a / 255})`];
//       });

//       // const legendData = {
//       //   z: [[minValue, maxValue]],
//       //   type: 'heatmap',
//       //   colorscale: colorscale,
//       //   showscale: true,
//       //   hoverinfo: 'none',
//       //   colorbar: {
//       //     len: 1,
//       //     thickness: 25,
//       //     tickmode: 'linear',
//       //     tick0: minValue,
//       //     dtick: (maxValue - minValue) / 5,
//       //     tickformat: '.1f',
//       //   },
//       // };

//       const legendData = {
//         z: [[minValue, maxValue]],
//         type: 'heatmap',
//         colorscale: colorscale,
//         showscale: true,
//         hoverinfo: 'none',
//         colorbar: {
//           len: 1,
//           thickness: 25,
//           tickformat: '.1f'
//         }
//       };
      
//       // Apply different tick positioning for CHL log scale
//       if (layerType === 'CHL') {
//         const logMin = Math.log10(minValue);
//         const logMax = Math.log10(maxValue);
//         const numTicks = 6; // Number of tick marks you want
      
//         // Generate log-spaced ticks
//         const logTicks = Array.from({ length: numTicks }, (_, i) => {
//           return Math.pow(10, logMin + (i / (numTicks - 1)) * (logMax - logMin));
//         });
      
//         legendData.colorbar.tickmode = 'array';
//         legendData.colorbar.tickvals = logTicks;
//         legendData.colorbar.ticktext = logTicks.map(t => t.toFixed(2)); // Format tick labels
//       } else {
//         // Default linear tick mode for SST & SSS
//         legendData.colorbar.tickmode = 'linear';
//         legendData.colorbar.tick0 = minValue;
//         legendData.colorbar.dtick = (maxValue - minValue) / 5;
//       }
      
//       // Plot legend with updated settings
//       Plotly.newPlot(`${layerType.toLowerCase()}-legend`, [legendData], layout);      

//       const layout = {
//         title: {
//           text: layerType === 'CHL' ? 'Chl (mg/m³)' 
//                 : layerType === 'SST' ? `SST (${unitSystem === 'imperial' ? '°F' : '°C'})`
//                 : 'SSS (PSU)',
//           font: {
//             size: 14, // Adjust font size here (e.g., 16px)
//             family: 'Arial, sans-serif', // Optional: Define font family
//             color: '#333' // Optional: Change title color
//           }
//         },
//         width: 100,
//         height: 300,
//         margin: { l: 0, r: 75, t: 40, b: 0 },
//         xaxis: { visible: false },
//         yaxis: { visible: false }
//       };      

//       Plotly.newPlot(`${layerType.toLowerCase()}-legend`, [legendData], layout);
//       legendContainer.style.display = 'block'; // Ensure legend is shown when data is valid
//     })
//     .catch((err) => {
//       console.error(`Error loading ${layerType} legend data:`, err);
//       // Hide the legend container on error
//       if (legendContainer) {
//         legendContainer.style.display = 'none';
//       }
//     });

//   console.log(`Creating legend for ${layerType} with date: ${date}`);
// }

// Helper function to generate legend
function createLegend(layerType, date) {
  // Get the legend container element
  const legendContainer = document.getElementById(`${layerType.toLowerCase()}-legend`);
  // Determine the active overlay layer
  const overlay = layerType === 'SST' ? sstOverlay 
                 : layerType === 'SSS' ? sssOverlay 
                 : chlOverlay; // Add CHL overlay reference

  const zoomLevel = map.getZoom();

  // Check the selected unit system (metric or imperial)
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;

  // Check if a valid date is provided
  if (!date) {
    // Uncheck the layer toggle box
    const checkbox = document.getElementById(`${layerType.toLowerCase()}-toggle`);
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
      ? `../data/SST/tiles/${date}/sst_range_local.json`
      : `../data/SST/tiles/${date}/sst_range_global.json`;
  } else if (layerType === 'SSS') {
    rangeFile = zoomLevel >= 8
      ? `../data/SSS/tiles_mirrored/${date}/sss_range_local.json`
      : `../data/SSS/tiles_mirrored/${date}/sss_range_global.json`;
  } else if (layerType === 'CHL') {
    rangeFile = zoomLevel >= 8
      ? `../data/CHL/tiles/${date}/chl_range_local.json`
      : `../data/CHL/tiles/${date}/chl_range_global.json`;
  }

  const colormapFile = `../data/${layerType}/thermal_colormap.txt`;

  Promise.all([
    fetch(colormapFile).then((res) => res.text()),
    fetch(rangeFile).then((res) => res.json()),
  ])
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
      }


      // Convert to Fahrenheit if the unit system is imperial
      if (unitSystem === 'imperial' && layerType === 'SST') {
        minValue = (minValue * 9) / 5 + 32;
        maxValue = (maxValue * 9) / 5 + 32;
      }

      const colorscale = rgbValues.map((rgb, i) => {
        const [index, r, g, b, a] = rgb; // Ensure we use all 5 columns (including alpha)
        if (i === 0 || i === rgbValues.length - 1) {
          return [i / (rgbValues.length - 1), 'rgba(255, 255, 255, 0)'];
        }
        return [i / (rgbValues.length - 1), `rgba(${r}, ${g}, ${b}, ${a / 255})`];
      });

      // const legendData = {
      //   z: [[minValue, maxValue]],
      //   type: 'heatmap',
      //   colorscale: colorscale,
      //   showscale: true,
      //   hoverinfo: 'none',
      //   colorbar: {
      //     len: 1,
      //     thickness: 25,
      //     tickmode: 'linear',
      //     tick0: minValue,
      //     dtick: (maxValue - minValue) / 5,
      //     tickformat: '.1f',
      //   },
      // };

      const layout = {
        title: {
          text: layerType === 'CHL' ? 'Chl (mg/m³)' 
                : layerType === 'SST' ? `SST (${unitSystem === 'imperial' ? '°F' : '°C'})`
                : 'SSS (PSU)',
          font: {
            size: 14, // Adjust font size here (e.g., 16px)
            family: 'Arial, sans-serif', // Optional: Define font family
            color: '#333' // Optional: Change title color
          }
        },
        width: 100,
        height: 300,
        margin: { l: 0, r: 75, t: 40, b: 0 },
        xaxis: { visible: false },
        yaxis: { visible: false }
      }; 

      const legendData = {
        z: [[minValue, maxValue]],
        type: 'heatmap',
        colorscale: colorscale,
        showscale: true,
        hoverinfo: 'none',
        colorbar: {
          len: 1,
          thickness: 25,
          tickformat: '.1f'
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
    
        console.log("CHL Log Tick Positions:", tickPositions); // Debugging
        console.log("CHL Log Tick Labels:", logValues);
      }   else {
        // Default linear tick mode for SST & SSS
        legendData.colorbar.tickmode = 'linear';
        legendData.colorbar.tick0 = minValue;
        legendData.colorbar.dtick = (maxValue - minValue) / 5;
      }
      
      // Plot legend with updated settings
      Plotly.newPlot(`${layerType.toLowerCase()}-legend`, [legendData], layout);           

      Plotly.newPlot(`${layerType.toLowerCase()}-legend`, [legendData], layout);
      legendContainer.style.display = 'block'; // Ensure legend is shown when data is valid
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
    if (activeLayerType && tileDate) {
      createLegend(activeLayerType, tileDate);
    }
  });
});

function updateLayerPaths(date) {
  tileDate = date; // Update the global tileDate variable

  const sstPath = `../data/SST/tiles/${date}/{z}/{x}/{y}.png`;
  const sssPath = `../data/SSS/tiles_mirrored/${date}/{z}/{x}/{y}.png`;
  const chlPath = `../data/CHL/tiles/${date}/{z}/{x}/{y}.png`;

  console.log('Constructed SST path:', sstPath);
  console.log('Constructed SSS path:', sssPath);
  console.log('Constructed CHL path:', chlPath);

  sstOverlay.setUrl(sstPath);
  sssOverlay.setUrl(sssPath);
  chlOverlay.setUrl(chlPath);

  console.log('Checking active layers...');
  console.log('Is SST overlay active?', map.hasLayer(sstOverlay));
  console.log('Is SSS overlay active?', map.hasLayer(sssOverlay));
  console.log('Is CHL overlay active?', map.hasLayer(chlOverlay));

  if (map.hasLayer(sstOverlay)) {
    console.log('Creating SST legend');
    createLegend('SST', date);
  } else if (map.hasLayer(sssOverlay)) {
    console.log('Creating SSS legend');
    createLegend('SSS', date);
  } else if (map.hasLayer(chlOverlay)) {
    console.log('Creating CHL legend');
    createLegend('CHL', date);
  }
}

// map.on('zoomend', () => {
//   // console.log(`Zoomend triggered in layers.js, activeLayerType: ${activeLayerType}`);
//   if (activeLayerType) {
//     // console.log(`Zoom level changed to ${zoom}, refreshing legend for: ${activeLayerType}`);
//     createLegend(activeLayerType, tileDate);
//   }
// });

map.on('zoomend', () => {
  console.log(`Zoomend triggered, activeLayerType: ${activeLayerType}`);
  if (activeLayerType && tileDate) { // Check if tileDate is valid
    console.log(`Zoom level changed to ${zoom}, refreshing legend for: ${activeLayerType}`);
    createLegend(activeLayerType, tileDate);
  } else {
    console.log("No valid date or layer selected; skipping legend update.");
  }
});

// Export necessary variables and functions
export { sstOverlay, sssOverlay, chlOverlay, bathymetryLayer, updateLayerPaths, tileDate, createLegend };
