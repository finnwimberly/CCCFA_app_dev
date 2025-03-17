import { map } from './map-setup.js';
import { plotCTDMeasurements, initializePlots, removeCTDMeasurements, handleUnitChange} from './plots.js';
import { loadProfilesMetadata, loadMeasurementData } from './data-loading.js';
import { generateColor } from './utils.js';
import { state } from './state.js';

// Function to load profiles based on selected date range
function loadProfiles(startDate, endDate, selectedSources = []) {
  // If no sources are selected, just clear the map and return
  if (selectedSources.length === 0) {
    console.log('No profile sources selected, clearing map only');
    clearMarkers();
    initializePlots();
    return;
  }
  
  // Clear existing markers and plots
  clearMarkers();
  initializePlots();
  
  // Setup zoom handler
  setupZoomHandler();

  // Check if EMOLT profiles should be loaded
  if (selectedSources.includes('EMOLT')) {
    // Load EMOLT profiles
    loadProfilesMetadata(startDate, endDate, 'EMOLT')
      .then((profiles) => {
        profiles.forEach((profile) => {
          const lat = parseFloat(profile['Latitude']);
          const lon = parseFloat(profile['Longitude']);
          const id = profile['Profile ID'];
          const date = profile['Date'];

          // Create a triangle marker for EMOLT using a custom icon
          const marker = L.marker([lat, lon], {
            icon: createEmoltIcon(map.getZoom())
          }).addTo(map);

          // Store marker info with data type
          state.markers[id] = {
            marker: marker,
            dataType: 'EMOLT'
          };

          // Attach event handlers
          marker.on('mouseover', () => {
            marker.bindTooltip(`<strong>Profile ID:</strong> ${id}<br><strong>Date:</strong> ${date}<br><strong>Type:</strong> EMOLT`).openTooltip();
          });

          // Explicitly manage click events for selection/deselection
          marker.on('click', () => {
            if (state.selectedProfiles[id]) {
              // Deselect profile
              deselectProfile(id, marker);
            } else {
              // Select profile
              selectProfile(id, marker, date);
            }
          });
        });
      })
      .catch((error) => {
        console.error('Error loading EMOLT profile metadata:', error);
      });
  }

  // Check if CTD profiles should be loaded (either CCCFA or CFRF or both)
  if (selectedSources.includes('cccfa_outer_cape') || selectedSources.includes('shelf_research_fleet')) {
    // Load CTD profiles
    loadProfilesMetadata(startDate, endDate, 'CTD')
      .then((profiles) => {
        // Filter profiles based on selected sources
        const filteredProfiles = profiles.filter(profile => {
          const group = profile['Group']; // Get the group value
          return selectedSources.includes(group);
        });

        filteredProfiles.forEach((profile) => {
          const lat = parseFloat(profile['Latitude']);
          const lon = parseFloat(profile['Longitude']);
          const id = profile['Profile ID'];
          const date = profile['Date'];
          const group = profile['Group'];

          // Create a marker for the CTD profile
          const marker = L.circleMarker([lat, lon], {
            color: 'black',
            fillColor: 'white',
            radius: 5,
            fillOpacity: 1,
          }).addTo(map);

          // Store marker info with data type
          state.markers[id] = {
            marker: marker,
            dataType: 'CTD',
            group: group
          };

          // Attach event handlers
          marker.on('mouseover', () => {
            // Show human-readable group name in tooltip
            const displayGroup = group === 'cccfa_outer_cape' ? 'CCCFA' : 
                                 group === 'shelf_research_fleet' ? 'CFRF' : group;
            
            marker.bindTooltip(`<strong>Profile ID:</strong> ${id}<br><strong>Date:</strong> ${date}<br><strong>Type:</strong> CTD<br><strong>Source:</strong> ${displayGroup}`).openTooltip();
          });

          // Explicitly manage click events for selection/deselection
          marker.on('click', () => {
            if (state.selectedProfiles[id]) {
              // Deselect profile
              deselectProfile(id, marker);
            } else {
              // Select profile
              selectProfile(id, marker, date);
            }
          });
        });
      })
      .catch((error) => {
        console.error('Error loading CTD profile metadata:', error);
      });
  }
}

function clearMarkers() {
  Object.values(state.markers).forEach((markerInfo) => {
    map.removeLayer(markerInfo.marker); // Remove marker from map
  });
  state.markers = {}; // Reset markers dictionary
  state.selectedProfiles = {}; // Clear selected profiles
  state.colorIndex = 0; // Reset color index
}

// NEW VERSIONS WITH POPUP LEGEND
async function selectProfile(id, marker, date) {
  const dataType = state.markers[id].dataType;
  const color = generateColor(state.colorIndex++);
  console.log('Creating new profile with:', {
    id: id,
    color: color,
    date: date,
    type: dataType
  });

  // Update marker style based on data type
  if (dataType === 'CTD') {
    marker.setStyle({ color: color });
  } else {
    // Update EMOLT triangle color using the zoom-responsive function
    marker.setIcon(createEmoltIcon(map.getZoom(), color));
  }

  state.selectedProfiles[id] = { 
    color: color,
    measurements: null,
    date: date,
    dataType: dataType
  };

  // Show legend container if it was hidden
  const legendContainer = document.getElementById('profile-legend-container');
  legendContainer.style.display = 'block';

  // Add legend item
  const legendItems = document.getElementById('profile-legend-items');
  const legendItem = document.createElement('div');
  legendItem.className = 'legend-item';
  legendItem.innerHTML = `
    <span class="color-dot" style="background-color: ${color}"></span>
    <span>${date} (${dataType})</span>
  `;

  console.log('Adding legend item with style:', legendItem.innerHTML);
  legendItems.appendChild(legendItem);

  try {
    const measurements = await loadMeasurementData(id, dataType);
    await plotCTDMeasurements(id, measurements, color);
    state.selectedProfiles[id].measurements = measurements;

    if (!marker.getPopup()) {
      const popupContent = generatePopupContent(date, measurements, dataType);
      marker.bindPopup(popupContent, {autoClose: false, closeOnClick: false}).openPopup();
    }
  } catch (error) {
    console.error(`Error processing profile ${id}:`, error);
    delete state.selectedProfiles[id];
    legendItem.remove(); // Remove legend item if there's an error
  }
}

// Helper function similar to selectProfile but without showing popups
async function selectProfileSilently(id, marker, date) {
  const dataType = state.markers[id].dataType;
  const color = generateColor(state.colorIndex++);
  
  // Update marker style based on data type
  if (dataType === 'CTD') {
    marker.setStyle({ color: color });
  } else {
    // Update EMOLT triangle color using the zoom-responsive function
    marker.setIcon(createEmoltIcon(map.getZoom(), color));
  }

  state.selectedProfiles[id] = { 
    color: color,
    measurements: null,
    date: date,
    dataType: dataType
  };

  // Show legend container if it was hidden
  const legendContainer = document.getElementById('profile-legend-container');
  legendContainer.style.display = 'block';

  // Add legend item
  const legendItems = document.getElementById('profile-legend-items');
  const legendItem = document.createElement('div');
  legendItem.className = 'legend-item';
  legendItem.innerHTML = `
    <span class="color-dot" style="background-color: ${color}"></span>
    <span>${date} (${dataType})</span>
  `;

  legendItems.appendChild(legendItem);

  try {
    const measurements = await loadMeasurementData(id, dataType);
    await plotCTDMeasurements(id, measurements, color);
    state.selectedProfiles[id].measurements = measurements;
    
    // We don't bind popup here, unlike the original selectProfile function
  } catch (error) {
    console.error(`Error processing profile ${id}:`, error);
    delete state.selectedProfiles[id];
    legendItem.remove(); // Remove legend item if there's an error
  }
}

function deselectProfile(id, marker) {
  const dataType = state.markers[id].dataType;
  
  // Reset marker style based on data type
  if (dataType === 'CTD') {
    marker.setStyle({ color: 'black', fillColor: 'white' });
  } else {
    // Reset EMOLT marker style using the zoom-responsive function
    marker.setIcon(createEmoltIcon(map.getZoom()));
  }

  marker.closePopup();
  marker.unbindPopup();

  // Remove legend item with logging
  const legendItems = document.getElementById('profile-legend-items');
  const items = Array.from(legendItems.getElementsByClassName('legend-item'));
  const profileColor = state.selectedProfiles[id].color;
  
  console.log('Attempting to remove legend item:');
  console.log('Profile ID:', id);
  console.log('Profile color from state:', profileColor);
  
  // Create a temporary div to convert HSL to RGB
  const tempDiv = document.createElement('div');
  tempDiv.style.color = profileColor;
  document.body.appendChild(tempDiv);
  const computedColor = window.getComputedStyle(tempDiv).color;
  document.body.removeChild(tempDiv);
  
  console.log('Converted profile color:', computedColor);
  
  // Find and remove the matching legend item
  const itemToRemove = items.find(item => {
    const dotElement = item.querySelector('.color-dot');
    const dotColor = window.getComputedStyle(dotElement).backgroundColor;
    console.log('Comparing colors:', {
      dotColor: dotColor,
      computedColor: computedColor,
      matches: dotColor === computedColor
    });
    return dotElement && dotColor === computedColor;
  });

  console.log('Item to remove found:', itemToRemove ? 'yes' : 'no');

  if (itemToRemove) {
    itemToRemove.remove();
    console.log('Legend item removed');
  } else {
    console.log('No matching legend item found to remove');
  }

  // Hide container if no items left
  if (legendItems.children.length === 0) {
    document.getElementById('profile-legend-container').style.display = 'none';
    console.log('Legend container hidden - no items left');
  }

  if (state.selectedProfiles[id]) {
    removeCTDMeasurements(id);
    delete state.selectedProfiles[id];
  }
}

// Helper function to generate popup content for a marker
function generatePopupContent(date, measurements, dataType) {
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;

  // Surface and bottom temperatures will be calculated differently based on dataType
  let surfaceTempCelsius, bottomTempCelsius, surfDepth, bottomDepth;

  if (dataType === 'EMOLT') {
    // For EMOLT data, we need to handle the array orientation differently
    // Surface = smaller depths, bottom = larger depths
    // First sort the data by depth to ensure correct handling
    const depthTemp = measurements.depth.map((depth, i) => ({ 
      depth: depth, 
      temp: measurements.temperature[i] 
    }));
    
    // Sort by depth (ascending)
    depthTemp.sort((a, b) => a.depth - b.depth);
    
    // Calculate surface temperature (avg of top 4m - shallowest depths)
    // EMOLT has larger intervals between measurements than CTD
    const surfaceReadings = depthTemp.slice(0, 4);
    surfaceTempCelsius = surfaceReadings.reduce((acc, val) => acc + val.temp, 0) / surfaceReadings.length;
    
    // Calculate bottom temperature (avg of bottom 4m - deepest depths)
    const bottomReadings = depthTemp.slice(-4);
    bottomTempCelsius = bottomReadings.reduce((acc, val) => acc + val.temp, 0) / bottomReadings.length;
    
    // Get depth range
    surfDepth = depthTemp[0].depth;
    bottomDepth = depthTemp[depthTemp.length - 1].depth;
  } else {
    // Original CTD handling (still using 5 measurements)
    // Calculate surface temperature (avg of top 5m)
    const topTemps = measurements.temperature.slice(-6, -1);
    surfaceTempCelsius = topTemps.reduce((acc, val) => acc + val, 0) / topTemps.length;

    // Calculate bottom temperature (avg of bottom 5m)
    const bottomTemps = measurements.temperature.slice(0, 5);
    bottomTempCelsius = bottomTemps.reduce((acc, val) => acc + val, 0) / bottomTemps.length;

    // Calculate depth range
    surfDepth = measurements.depth[measurements.depth.length - 2];
    bottomDepth = measurements.depth[0];
  }

  // Convert to imperial if needed
  const surfTemp = unitSystem === "imperial"
    ? (surfaceTempCelsius * 9 / 5) + 32
    : surfaceTempCelsius;

  const bottomTemp = unitSystem === "imperial"
    ? (bottomTempCelsius * 9 / 5) + 32
    : bottomTempCelsius;

  // Convert depths if needed
  const displaySurfDepth = unitSystem === "imperial"
    ? surfDepth * 0.546807
    : surfDepth;
    
  const displayBottomDepth = unitSystem === "imperial"
    ? bottomDepth * 0.546807
    : bottomDepth;

  return `
    <strong>Observation Date:</strong> ${date}<br>
    <strong>Type:</strong> ${dataType}<br>
    <strong>Surface Temp (avg for top 5m:</strong> ${surfTemp.toFixed(2)} ${unitSystem === "imperial" ? '°F' : '°C'}<br>
    <strong>Bottom Temp (avg for bottom 5m):</strong> ${bottomTemp.toFixed(2)} ${unitSystem === "imperial" ? '°F' : '°C'}<br>
    <strong>Depth Range:</strong> ${displaySurfDepth.toFixed(2)} ${unitSystem === "imperial" ? 'ftm' : 'meters'} to ${displayBottomDepth.toFixed(2)} ${unitSystem === "imperial" ? 'ftm' : 'meters'}<br>
  `;
}

// Add event listeners for unit change radio buttons
document.querySelectorAll('input[name="unit"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    console.log('Unit change detected.');
    handleUnitChange(state.selectedProfiles);
  });
});

// Add a function to set up the zoom handler
function setupZoomHandler() {
  map.on('zoomend', function() {
    // Update all EMOLT markers based on new zoom level
    Object.entries(state.markers).forEach(([id, markerInfo]) => {
      if (markerInfo.dataType === 'EMOLT') {
        const marker = markerInfo.marker;
        const zoomLevel = map.getZoom();
        
        if (state.selectedProfiles[id]) {
          // If selected, use the profile's color
          const color = state.selectedProfiles[id].color;
          marker.setIcon(createEmoltIcon(zoomLevel, color));
        } else {
          // If not selected, use default black
          marker.setIcon(createEmoltIcon(zoomLevel));
        }
      }
    });
  });
}

// Call setupZoomHandler after document is loaded
document.addEventListener('DOMContentLoaded', setupZoomHandler);

// Create a zoom-responsive icon for EMOLT markers
function createEmoltIcon(zoomLevel, color = 'black') {
  // Calculate size based on zoom level - small at low zoom, larger at high zoom
  // Reduce the size by multiplying by 0.8 to make markers smaller
  const size = Math.max(3, Math.min(10, (zoomLevel - 2) * 0.8));
  
  // Add opacity to the color for transparency
  const colorWithOpacity = color === 'black' ? 'rgba(0, 0, 0, 0.7)' : color.replace(')', ', 0.7)').replace('rgb', 'rgba');
  
  return L.divIcon({
    className: 'emolt-marker',
    html: `<div style="
      width: 0; 
      height: 0; 
      border-left: ${size}px solid transparent; 
      border-right: ${size}px solid transparent; 
      border-bottom: ${size * 1.5}px solid ${colorWithOpacity}; 
      filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2));
    "></div>`,
    iconSize: [size * 1.5, size * 1.5],
    iconAnchor: [size, size]
  });
}

export { loadProfiles, selectProfileSilently, createEmoltIcon, state };
