import { map } from './map-setup.js';
import { getSelectedUnitSystem } from './layers.js';

// Global variables
let fishbotData = [];
let fishbotLayer = null;
let isImperialUnits = false;
let currentLayerDate = null;
let currentVariableType = 'temperature'; // Track current variable type
let colormapCache = {}; // Cache for different colormaps

// Variable configuration
const variableConfig = {
  temperature: {
    colormapFile: '../data/FIShBOT/thermal_colormap.txt',
    csvColumn: 'temperature',
    displayName: 'Temperature',
    units: { metric: '°C', imperial: '°F' },
    convertToImperial: (value) => (value * 9/5) + 32,
    range: { min: 4, max: 26.5 }
  },
  oxygen: {
    colormapFile: '../data/FIShBOT/oxy_colormap.txt',
    csvColumn: 'dissolved_oxygen',
    displayName: 'Oxygen',
    units: { metric: 'mg/L', imperial: 'mg/L' },
    convertToImperial: (value) => value, // No conversion needed
    range: { min: 2, max: 12 }
  },
  salinity: {
    colormapFile: '../data/FIShBOT/haline_colormap.txt',
    csvColumn: 'salinity',
    displayName: 'Salinity',
    units: { metric: 'PSU', imperial: 'PSU' },
    convertToImperial: (value) => value, // No conversion needed
    range: { min: 28, max: 36 }
  }
};

// Function to get value for display based on variable type and unit system
function getValueForDisplay(value, variableType) {
  const config = variableConfig[variableType];
  return isImperialUnits ? config.convertToImperial(value) : value;
}

// Function to get unit label for current variable
function getVariableUnit(variableType) {
  const config = variableConfig[variableType];
  return config.units[isImperialUnits ? 'imperial' : 'metric'];
}

// Function to extract value from data point based on variable type
function getVariableValue(dataPoint, variableType) {
  const config = variableConfig[variableType];
  return dataPoint[config.csvColumn];
}

// Function to load colormap data
async function loadColormapData(variable) {
  if (colormapCache[variable]) return colormapCache[variable];
  
  try {
    const response = await fetch(variableConfig[variable].colormapFile);
    const colormapText = await response.text();
    
    const colormapData = colormapText.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [index, r, g, b, a] = line.split(' ').map(Number);
        return { index, r, g, b, a };
      });
    
    colormapCache[variable] = colormapData;
    return colormapData;
  } catch (error) {
    console.error(`Error loading colormap for ${variable}:`, error);
    return null;
  }
}

// Function to get color from value using the loaded colormap
async function getVariableColor(value, variableType) {
  try {
    // Load colormap if not already loaded
    const colormap = await loadColormapData(variableType);
    if (!colormap) {
      // Fallback to simple blue-red gradient
      const normalized = Math.max(0, Math.min(1, (value - 2) / 26));
      const r = Math.round(normalized * 255);
      const b = Math.round((1 - normalized) * 255);
      return `rgb(${r}, 0, ${b})`;
    }
    
    // Use range from variable configuration
    const { min: minValue, max: maxValue } = variableConfig[variableType].range;
    
    // Normalize value to 0-1 range
    const normalized = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
    
    // Map to colormap index
    const colorIndex = Math.round(normalized * (colormap.length - 1));
    const color = colormap[colorIndex];
    
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
    
  } catch (error) {
    console.error(`Error getting color for ${variableType}:`, error);
    // Fallback to simple gradient
    const normalized = Math.max(0, Math.min(1, (value - 2) / 26));
    const r = Math.round(normalized * 255);
    const b = Math.round((1 - normalized) * 255);
    return `rgb(${r}, 0, ${b})`;
  }
}

// Function to load fishbot data
async function loadFishbotData() {
  try {
    console.log('Loading fishbot data...');
    const response = await fetch('../data/FIShBOT/fishbot.csv');
    const csvText = await response.text();
    
    // Parse CSV data using Papa Parse
          const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false // Keep as strings to handle empty fields
      });
    
    if (parseResult.errors.length > 0) {
      console.warn('CSV parsing errors:', parseResult.errors);
    }
    
          console.log(`Parsed ${parseResult.data.length} total rows from CSV`);
      
      fishbotData = parseResult.data.filter(row => {
        try {
        
        // Only include rows with valid temperature, coordinates, and time
        const hasValidCoords = row.latitude && row.latitude.trim() !== '' && 
                              row.longitude && row.longitude.trim() !== '' &&
                              !isNaN(parseFloat(row.latitude)) && !isNaN(parseFloat(row.longitude));
        const hasValidTemp = row.temperature && row.temperature.trim() !== '' && !isNaN(parseFloat(row.temperature));
                  const hasValidTime = row.time && typeof row.time === 'string' && row.time.trim() !== '';
        
        return hasValidCoords && hasValidTemp && hasValidTime;
              } catch (error) {
          console.error('Error processing row:', error.message);
          return false;
        }
    }).map(row => ({
      // Convert string values to numbers for processing
      time: row.time,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      temperature: parseFloat(row.temperature),
      dissolved_oxygen: row.dissolved_oxygen && row.dissolved_oxygen.trim() !== '' ? parseFloat(row.dissolved_oxygen) : null,
      salinity: row.salinity && row.salinity.trim() !== '' ? parseFloat(row.salinity) : null,
      depth: row.depth && row.depth.trim() !== '' ? parseFloat(row.depth) : null,
      data_provider: row.data_provider,
      grid_id: row.grid_id,
      stat_area: row.stat_area,
      fishery_dependent: row.fishery_dependent
    }));
    
          // Log some sample dates to verify format
      if (fishbotData.length > 0) {
        console.log(`Loaded ${fishbotData.length} valid fishbot data points`);
      }
    return fishbotData;
  } catch (error) {
    console.error('Error loading fishbot data:', error);
    return [];
  }
}

// Function to filter data by date (matches the satellite layer approach)
function filterDataByDate(data, layerDate, tolerance = 2) {
  if (!layerDate) return [];
  
  // Convert layer date format (YYYY_DDD) to actual date in UTC
  const year = parseInt(layerDate.split('_')[0]);
  const dayOfYear = parseInt(layerDate.split('_')[1]);
  // Set the target date to midnight UTC
  const targetDate = moment.utc().year(year).dayOfYear(dayOfYear + 1).startOf('day');
  

  
  // Filter data for the specific date (with configurable tolerance)
  const matchedPoints = data.filter(point => {
    if (!point.time) return false;
    
    // Parse the ISO date from the CSV (format: 2025-04-26T00:00:00Z)
    const pointDate = moment.utc(point.time);
    
    if (!pointDate.isValid()) {
      return false;
    }
    
    const daysDiff = Math.abs(pointDate.diff(targetDate, 'days', true));
    
    // For tolerance=0, check if dates are on the same day
    if (tolerance === 0) {
      return pointDate.isSame(targetDate, 'day');
    }
    
    return daysDiff <= tolerance;
  });
  
  if (matchedPoints.length === 0) {
    console.log(`No fishbot data points found for date ${layerDate} with ±${tolerance} day tolerance`);
  }
  
  return matchedPoints;
}

// Function to create fishbot layer
async function createFishbotLayer(layerDate, tolerance = 2, variableType = 'temperature') {
  if (fishbotLayer) {
    map.removeLayer(fishbotLayer);
  }
  
  fishbotLayer = L.layerGroup();
  currentVariableType = variableType;
  
  // Get current unit system
  isImperialUnits = document.querySelector('input[name="unit"]:checked').value === 'imperial';
  
  // Filter data by the selected date with configurable tolerance
  const filteredData = filterDataByDate(fishbotData, layerDate, tolerance);
  
  if (filteredData.length === 0) {
    console.log(`No fishbot ${variableType} data available for the selected date with ±${tolerance} day tolerance`);
    // Hide the legend if there are no points
    const legendContainer = document.getElementById('fishbot-legend');
    if (legendContainer) {
      legendContainer.style.display = 'none';
    }
    return fishbotLayer;
  }
  
  // Group data points by location to avoid overlapping markers
  const locationGroups = {};
  let validPointsCount = 0;
  
  filteredData.forEach(point => {
    // Only include points with valid data for the selected variable
    const value = getVariableValue(point, variableType);
    if (!isNaN(value) && value !== null && value !== undefined) {
      validPointsCount++;
      const key = `${point.latitude.toFixed(4)}_${point.longitude.toFixed(4)}`;
      if (!locationGroups[key]) {
        locationGroups[key] = [];
      }
      locationGroups[key].push(point);
    }
  });
  
  if (validPointsCount === 0) {
    console.log(`No valid ${variableType} values found in the filtered data`);
    const legendContainer = document.getElementById('fishbot-legend');
    if (legendContainer) {
      legendContainer.style.display = 'none';
    }
    return fishbotLayer;
  }
  
  // Create markers for each location group
  for (const group of Object.values(locationGroups)) {
    if (group.length === 0) continue;
    
    // Calculate average value for all readings at this location
    const avgValue = group.reduce((sum, point) => sum + getVariableValue(point, variableType), 0) / group.length;
    
    // Use the most recent reading for other metadata (depth, provider, date)
    const latest = group.reduce((prev, current) => 
      new Date(current.time) > new Date(prev.time) ? current : prev
    );
    
    const displayValue = getValueForDisplay(avgValue, variableType);
    const color = await getVariableColor(avgValue, variableType);
    
    // Create a rectangle marker for the variable block
    const bounds = [
      [latest.latitude - 0.03, latest.longitude - 0.03],
      [latest.latitude + 0.03, latest.longitude + 0.03]
    ];
    
    const rectangle = L.rectangle(bounds, {
      color: color,
      fillColor: color,
      fillOpacity: 0.7,
      weight: 1,
      opacity: 0.8
    });
    
    // Create tooltip content (simplified for hover)
    const tooltipContent = `
              <div style="font-family: Arial, sans-serif; font-size: 12px; padding: 4px;">
          <strong>${variableConfig[variableType].displayName}:</strong> ${displayValue.toFixed(1)}${getVariableUnit(variableType)}<br>
          <strong>Depth:</strong> ${isImperialUnits ? (latest.depth * 0.5468).toFixed(1) + ' fathoms' : latest.depth + 'm'}<br>
          <strong>Date:</strong> ${new Date(new Date(latest.time).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()}</p>

        </div>
    `;
    
    // Get unique providers from the group
    const uniqueProviders = [...new Set(group.map(point => point.data_provider))];
    const providersText = uniqueProviders.length === 1 
      ? uniqueProviders[0] 
      : uniqueProviders.join(', ');
    
    // Create popup content (more detailed for click)
    const popupContent = `
      <div style="font-family: Arial, sans-serif;">
        <h4 style="margin: 0 0 10px 0; color: #333;">FishBot ${variableConfig[variableType].displayName}</h4>
        <p style="margin: 5px 0;"><strong>${variableConfig[variableType].displayName}:</strong> ${displayValue.toFixed(1)}${getVariableUnit(variableType)}</p>
        <p style="margin: 5px 0;"><strong>Depth:</strong> ${isImperialUnits ? (latest.depth * 0.5468).toFixed(1) + ' fathoms' : latest.depth + 'm'}</p>
        <p style="margin: 5px 0;"><strong>Data Provider${uniqueProviders.length > 1 ? 's' : ''}:</strong> ${providersText}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(new Date(latest.time).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
        <p style="margin: 5px 0;"><strong>Readings at location:</strong> ${group.length}</p>
      </div>
    `;
    
    // Bind both tooltip (hover) and popup (click)
    rectangle.bindTooltip(tooltipContent, {
      permanent: false,
      direction: 'top',
      className: 'fishbot-tooltip',
      sticky: true,
      opacity: 0.9
    });
    
    rectangle.bindPopup(popupContent, {
      className: 'fishbot-popup'
    });
    
    fishbotLayer.addLayer(rectangle);
  }
  
  // Only create legend if we have valid points and at least one marker was added
  if (fishbotLayer.getLayers().length > 0) {
    createFishbotLegend(layerDate, variableType);
  } else {
    // Hide the legend if no markers were added
    const legendContainer = document.getElementById('fishbot-legend');
    if (legendContainer) {
      legendContainer.style.display = 'none';
    }
  }
  
  return fishbotLayer;
}

// Function to create professional Plotly-based legend (matching other layers)
function createFishbotLegend(layerDate, variableType = 'temperature') {
  const legendContainer = document.getElementById('fishbot-legend');
  if (!legendContainer) {
    console.error('Fishbot legend container not found');
    return;
  }
  
  // Hide other legends (matching other layer behavior)
  const allLegendContainers = document.querySelectorAll('[id$="-legend"]');
  allLegendContainers.forEach(container => {
    if (container.id !== 'fishbot-legend') {
      container.style.display = 'none';
      container.innerHTML = '';
      container.style.background = 'none';
      container.style.border = 'none';
      container.style.boxShadow = 'none';
      container.style.padding = '0';
      container.style.margin = '0';
    }
  });

  // Set up legend container styling (matching other layers)
  legendContainer.style.background = 'white';
  legendContainer.style.border = '1px solid #ddd';
  legendContainer.style.borderRadius = '4px';
  legendContainer.style.padding = '10px';
  legendContainer.style.margin = '10px';
  legendContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
  legendContainer.style.display = 'block';

  // Check if a valid date is provided
  if (!layerDate) {
    legendContainer.style.display = 'none';
    return;
  }

  // Get current unit system
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;
  
  // Use colormap file for the current variable
  const colormapFile = variableConfig[variableType].colormapFile;

  // Fetch colormap data
  fetch(colormapFile)
    .then((res) => res.text())
    .then((colormapText) => {
      
      const rgbValues = colormapText.split('\n')
        .filter((line) => line.trim())
        .map((line) => line.split(' ').map(Number));

      // Use range from variable configuration
      let { min: minValue, max: maxValue } = variableConfig[variableType].range;

      // Convert to appropriate units if needed
      if (unitSystem === 'imperial') {
        minValue = variableConfig[variableType].convertToImperial(minValue);
        maxValue = variableConfig[variableType].convertToImperial(maxValue);
      }

      // Create colorscale (matching other layer format)
      const colorscale = rgbValues.map((rgb, i) => {
        const [index, r, g, b, a] = rgb;
        if (i === 0 || i === rgbValues.length - 1) {
          return [i / (rgbValues.length - 1), 'rgba(255, 255, 255, 0)'];
        }
        return [i / (rgbValues.length - 1), `rgba(${r}, ${g}, ${b}, ${a / 255})`];
      });

      // Get appropriate unit label
      const unitLabel = variableConfig[variableType].units[unitSystem];

      // Layout configuration (matching other layers)
      const layout = {
        title: {
          text: `${variableConfig[variableType].displayName} (${unitLabel})`,
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

      // Legend data configuration (matching other layers)
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
          yanchor: 'middle',
          tickmode: 'linear',
          tick0: minValue,
          dtick: (maxValue - minValue) / 5
        }
      };

      // Create the Plotly plot (matching other layer approach)
      try {
        const container = document.getElementById('fishbot-legend');
        if (!container) {
          throw new Error('FishBot legend container not found');
        }
        
        // Clear any existing content
        container.innerHTML = '';
        
        // Create the plot
        Plotly.newPlot('fishbot-legend', [legendData], layout)
          .then(() => {
            const plotElement = container.querySelector('.plotly');
            if (plotElement) {
              console.log(`FishBot ${variableConfig[variableType].displayName} legend created successfully`);
            } else {
              console.error('Plot element not found in fishbot legend container');
            }
          })
          .catch(err => {
            console.error(`Error creating FishBot ${variableConfig[variableType].displayName} Plotly plot:`, err);
          });
        
        // Ensure legend container is visible
        legendContainer.style.display = 'block';
        
      } catch (err) {
        console.error(`Error in FishBot ${variableConfig[variableType].displayName} legend creation process:`, err);
      }
    })
    .catch((err) => {
      console.error(`Error loading FishBot ${variableConfig[variableType].displayName} legend data:`, err);
      // Hide the legend container on error
      legendContainer.style.display = 'none';
    });


}

// Function to toggle fishbot layer
async function toggleFishbotLayer(isChecked, layerDate = null, tolerance = 2, variableType = 'temperature') {
  if (isChecked) {
    // Uncheck other FishBot variable toggles
    const fishbotToggles = ['fishbot-temperature-toggle', 'fishbot-oxygen-toggle', 'fishbot-salinity-toggle'];
    fishbotToggles.forEach(toggleId => {
      if (toggleId !== `fishbot-${variableType}-toggle`) {
        const toggle = document.getElementById(toggleId);
        if (toggle && toggle.checked) {
          toggle.checked = false;
        }
      }
    });
    // Check if a layer date is selected
    if (!layerDate) {
      console.log('No layer date provided for fishbot layer');
      return;
    }
    
    // Store the current layer date and variable type
    currentLayerDate = layerDate;
    currentVariableType = variableType;
    
    // Deactivate other data layers (similar to how satellite layers work)
    const otherLayerToggles = [
      'sst-toggle', 'ostia-sst-toggle', 'ostia-anomaly-toggle', 
      'sss-toggle', 'chl-toggle'
    ];
    
    otherLayerToggles.forEach(toggleId => {
      const toggle = document.getElementById(toggleId);
      if (toggle && toggle.checked) {
        toggle.checked = false;
        // Trigger change event to properly deactivate the layer
        toggle.dispatchEvent(new Event('change'));
      }
    });
    
    // Load data if not already loaded
    if (fishbotData.length === 0) {
      await loadFishbotData();
    }
    
    // Create and add layer with date filtering, tolerance, and variable type
    const layer = await createFishbotLayer(layerDate, tolerance, variableType);
    if (layer) {
      fishbotLayer = layer;
      map.addLayer(fishbotLayer);
    }
  } else {
    // Remove layer
    if (fishbotLayer) {
      map.removeLayer(fishbotLayer);
    }
    
    // Hide legend
    const legendContainer = document.getElementById('fishbot-legend');
    if (legendContainer) {
      legendContainer.style.display = 'none';
    }
    
    currentLayerDate = null;
    currentVariableType = 'temperature';
  }
}

// Function to update fishbot layer when units change
function updateFishbotUnits() {
  // Check which fishbot variable is currently active
  const fishbotToggles = ['fishbot-temperature-toggle', 'fishbot-oxygen-toggle', 'fishbot-salinity-toggle'];
  
  for (const toggleId of fishbotToggles) {
    const toggle = document.getElementById(toggleId);
    if (toggle && toggle.checked && currentLayerDate) {
      // Get current tolerance value from slider
      const toleranceSlider = document.getElementById('date-tolerance-slider');
      const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
      
      // Determine variable type from toggle ID
      const variableType = toggleId.replace('fishbot-', '').replace('-toggle', '');
      
      // Recreate layer with new units
      toggleFishbotLayer(true, currentLayerDate, tolerance, variableType);
      break; // Only one should be active at a time
    }
  }
}

// Function to update fishbot layer when date changes (called from controls)
function updateFishbotForDate(newLayerDate) {
  // Check which fishbot variable is currently active
  const fishbotToggles = ['fishbot-temperature-toggle', 'fishbot-oxygen-toggle', 'fishbot-salinity-toggle'];
  
  for (const toggleId of fishbotToggles) {
    const toggle = document.getElementById(toggleId);
    if (toggle && toggle.checked) {
      
      currentLayerDate = newLayerDate;
      
      // Get current tolerance value from slider
      const toleranceSlider = document.getElementById('date-tolerance-slider');
      const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
      
      // Determine variable type from toggle ID
      const variableType = toggleId.replace('fishbot-', '').replace('-toggle', '');
      
      toggleFishbotLayer(true, newLayerDate, tolerance, variableType);
      break; // Only one should be active at a time
    }
  }
}

// Listen for unit system changes
document.querySelectorAll('input[name="unit"]').forEach((radio) => {
  radio.addEventListener('change', updateFishbotUnits);
});

// Expose function to global window for cross-module access
if (typeof window !== 'undefined') {
  window.updateFishbotForDate = updateFishbotForDate;
}

// Export functions for use in other modules
export { 
  toggleFishbotLayer, 
  createFishbotLegend, 
  loadFishbotData,
  updateFishbotUnits,
  updateFishbotForDate
};

// Add this CSS to the style block at the bottom of the file
const style = document.createElement('style');
style.textContent = `
    /* FishBot tooltip styling */
    .fishbot-tooltip {
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        padding: 0;
        margin: 0;
    }
    
    .fishbot-tooltip:before {
        border-top-color: #ccc;
    }
    
    .leaflet-tooltip-top:before {
        border-top-color: #ccc;
    }
    
    .leaflet-tooltip-bottom:before {
        border-bottom-color: #ccc;
    }

    /* FishBot popup styling */
    .fishbot-popup .leaflet-popup-content-wrapper {
        background: white;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .fishbot-popup .leaflet-popup-tip {
        background: white;
    }

    .fishbot-popup .leaflet-popup-content {
        margin: 12px;
    }
`;
document.head.appendChild(style);
