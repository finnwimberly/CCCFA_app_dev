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

// Bathymetry overlay
const bathymetryLayer = L.imageOverlay('../bathymetry_contours.png', sstBounds, {
  opacity: 1, // Fully opaque layer
  attribution: 'Bathymetry Data',
});

// Layer control (toggle overlays)
const overlayLayers = {
  'SST (Sea Surface Temp)': sstOverlay,
  'SSS (Sea Surface Salinity)': sssOverlay,
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
// Helper function to generate legend
function createLegend(layerType, date) {
  // Get the legend container element
  const legendContainer = document.getElementById(`${layerType.toLowerCase()}-legend`);
  const overlay = layerType === 'SST' ? sstOverlay : sssOverlay; // Get the correct layer overlay

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
  const rangeFile = zoom >= 8
    ? `../data/${layerType}/${layerType === 'SST' ? 'tiles_3day' : 'tiles_mirrored'}/${date}/${layerType === 'SST' ? 'sst_range_local.json' : 'sss_range_local.json'}`
    : `../data/${layerType}/${layerType === 'SST' ? 'tiles_3day' : 'tiles_mirrored'}/${date}/${layerType === 'SST' ? 'sst_range_global.json' : 'sss_range_global.json'}`;

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
      let minValue = layerType === 'SST' ? range.min_temp : range.min_SSS;
      let maxValue = layerType === 'SST' ? range.max_temp : range.max_SSS;

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

      const legendData = {
        z: [[minValue, maxValue]],
        type: 'heatmap',
        colorscale: colorscale,
        showscale: true,
        hoverinfo: 'none',
        colorbar: {
          len: 1,
          thickness: 25,
          tickmode: 'linear',
          tick0: minValue,
          dtick: (maxValue - minValue) / 5,
          tickformat: '.1f',
        },
      };

      const layout = {
        title: layerType === 'SST'
          ? `SST (${unitSystem === 'imperial' ? '°F' : '°C'})`
          : 'SSS (PSU)',
        width: 100,
        height: 300,
        margin: { l: 0, r: 75, t: 40, b: 0 },
        xaxis: { visible: false },
        yaxis: { visible: false },
      };

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

// Update tile layer paths and update tileDate
function updateLayerPaths(date) {
  tileDate = date; // Update the global tileDate variable
  const sstPath = `../data/SST/tiles_3day/${date}/{z}/{x}/{y}.png`;
  console.log('Constructed SST path:', sstPath);
  const sssPath = `../data/SSS/tiles_mirrored/${date}/{z}/{x}/{y}.png`;

  sstOverlay.setUrl(sstPath);
  sssOverlay.setUrl(sssPath);

  console.log('Checking active layers...');
  console.log('Is SST overlay active?', map.hasLayer(sstOverlay));
  console.log('Is SSS overlay active?', map.hasLayer(sssOverlay));

  if (map.hasLayer(sstOverlay)) {
    console.log('Creating SST legend');
    createLegend('SST', date);
  } else if (map.hasLayer(sssOverlay)) {
    console.log('Creating SSS legend');
    createLegend('SSS', date);
  }
}

map.on('zoomend', () => {
  // console.log(`Zoomend triggered in layers.js, activeLayerType: ${activeLayerType}`);
  if (activeLayerType) {
    // console.log(`Zoom level changed to ${zoom}, refreshing legend for: ${activeLayerType}`);
    createLegend(activeLayerType, tileDate);
  }
});

// Export necessary variables and functions
export { sstOverlay, sssOverlay, bathymetryLayer, updateLayerPaths, tileDate, createLegend };
