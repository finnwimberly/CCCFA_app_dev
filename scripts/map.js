import { map } from './map-setup.js';
import { plotCTDMeasurements, initializePlots, removeCTDMeasurements, handleUnitChange} from './plots.js';
import { loadProfilesMetadata, loadMeasurementData } from './data-loading.js';
import { generateColor } from './utils.js';
import { state } from './state.js';

// Function to load profiles based on selected date range
function loadProfiles(startDate, endDate) {
  // Clear existing markers and plots
  clearMarkers();
  initializePlots();

  // Load metadata from the CSV
  loadProfilesMetadata(startDate, endDate)
    .then((profiles) => {
      profiles.forEach((profile) => {
        const lat = parseFloat(profile['Latitude']);
        const lon = parseFloat(profile['Longitude']);
        const id = profile['Profile ID'];
        const date = profile['Date'];

        // Create a marker for the profile
        const marker = L.circleMarker([lat, lon], {
          color: 'black',
          fillColor: 'white',
          radius: 5,
          fillOpacity: 1,
        }).addTo(map);

        // Attach event handlers
        marker.on('mouseover', () => {
          marker.bindTooltip(`<strong>Profile ID:</strong> ${id}<br><strong>Date:</strong> ${date}`).openTooltip();
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

        // Store the marker
        state.markers[id] = marker;
      });
    })
    .catch((error) => {
      console.error('Error loading profile metadata:', error);
    });
}

// Ensure markers have event handlers attached
function attachMarkerHandlers() {
  Object.keys(state.markers).forEach((id) => {
    const marker = state.markers[id];

    marker.off('click'); // Remove any existing click handlers to prevent duplicates
    marker.on('click', () => {
      console.log(`Marker clicked. Profile ${id} state:`, state.selectedProfiles[id] ? 'Selected' : 'Not selected');
      if (state.selectedProfiles[id]) {
        console.log(`Calling deselectProfile for ${id}`);
        deselectProfile(id, marker);
      } else {
        console.log(`Calling selectProfile for ${id}`);
        selectProfile(id, marker, new Date().toISOString()); // Provide `date` if necessary
      }
    });
  });
}

function clearMarkers() {
  Object.values(state.markers).forEach((marker) => {
    map.removeLayer(marker); // Remove marker from map
  });
  state.markers = {}; // Reset markers dictionary
  state.selectedProfiles = {}; // Clear selected profiles
  state.colorIndex = 0; // Reset color index
}

// async function selectProfile(id, marker, date) {
//   const color = generateColor(state.colorIndex++);
//   marker.setStyle({ color: color });

//   console.log(`Starting selection of profile ${id}`);

//   state.selectedProfiles[id] = { 
//     color: color,
//     measurements: null
//   };

//   try {
//     const measurements = await loadMeasurementData(id);
//     console.log(`Loaded measurements for profile ${id}:`, measurements);

//     await plotCTDMeasurements(id, measurements, color);
//     console.log(`Traces plotted for profile ${id}`);

//     state.selectedProfiles[id].measurements = measurements;

//     if (!marker.getPopup()) {
//       const popupContent = generatePopupContent(date, measurements);
//       marker.bindPopup(popupContent, {autoClose: false, closeOnClick: false}).openPopup();
//     }
//   } catch (error) {
//     console.error(`Error processing profile ${id}:`, error);
//     delete state.selectedProfiles[id];
//   }
// }


// function deselectProfile(id, marker) {
//   marker.setStyle({ color: 'black', fillColor: 'white' });
//   marker.closePopup();
//   marker.unbindPopup();

//   console.log(`Before removal:`, state.selectedProfiles);

//   if (state.selectedProfiles[id]) {
//     removeCTDMeasurements(id);
//     delete state.selectedProfiles[id];
//     console.log(`Removing ${id} from selectedProfiles. Updated selected profiles:`, state.selectedProfiles);
//   }
// }

// NEW VERSIONS WITH POPUP LEGEND
async function selectProfile(id, marker, date) {
  const color = generateColor(state.colorIndex++);
  console.log('Creating new profile with:', {
    id: id,
    color: color,
    date: date
  });
  marker.setStyle({ color: color });

  state.selectedProfiles[id] = { 
    color: color,
    measurements: null,
    date: date
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
    <span>${date}</span>
  `;

  console.log('Adding legend item with style:', legendItem.innerHTML);
  legendItems.appendChild(legendItem);

  try {
    const measurements = await loadMeasurementData(id);
    await plotCTDMeasurements(id, measurements, color);
    state.selectedProfiles[id].measurements = measurements;

    if (!marker.getPopup()) {
      const popupContent = generatePopupContent(date, measurements);
      marker.bindPopup(popupContent, {autoClose: false, closeOnClick: false}).openPopup();
    }
  } catch (error) {
    console.error(`Error processing profile ${id}:`, error);
    delete state.selectedProfiles[id];
    legendItem.remove(); // Remove legend item if there's an error
  }
}

function deselectProfile(id, marker) {
  marker.setStyle({ color: 'black', fillColor: 'white' });
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
function generatePopupContent(date, measurements) {
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;

  // Calculate surface temperature (avg of top 5m)
  const topTemps = measurements.temperature.slice(-6, -1);
  const surfaceTempCelsius = topTemps.reduce((acc, val) => acc + val, 0) / topTemps.length;
  const surfTemp = unitSystem === "imperial"
    ? (surfaceTempCelsius * 9 / 5) + 32
    : surfaceTempCelsius;

  // Calculate bottom temperature (avg of bottom 5m)
  const bottomTemps = measurements.temperature.slice(0, 5);
  const bottomTempCelsius = bottomTemps.reduce((acc, val) => acc + val, 0) / bottomTemps.length;
  const bottomTemp = unitSystem === "imperial"
    ? (bottomTempCelsius * 9 / 5) + 32
    : bottomTempCelsius;

  // Calculate depth range
  const surfDepth = unitSystem === "imperial"
    ? measurements.depth[measurements.depth.length - 2] * 0.546807
    : measurements.depth[measurements.depth.length - 2];
  const bottomDepth = unitSystem === "imperial"
    ? measurements.depth[0] * 0.546807
    : measurements.depth[0];

  return `
    <strong>Observation Date:</strong> ${date}<br>
    <strong>Surface Temp (avg for top 5m):</strong> ${surfTemp.toFixed(2)} ${unitSystem === "imperial" ? '°F' : '°C'}<br>
    <strong>Bottom Temp (avg for bottom 5m):</strong> ${bottomTemp.toFixed(2)} ${unitSystem === "imperial" ? '°F' : '°C'}<br>
    <strong>Depth Range:</strong> ${surfDepth.toFixed(2)} ${unitSystem === "imperial" ? 'ftms' : 'meters'} to ${bottomDepth.toFixed(2)} ${unitSystem === "imperial" ? 'ftms' : 'meters'}<br>
  `;
}

// Add event listeners for unit change radio buttons
document.querySelectorAll('input[name="unit"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    console.log('Unit change detected.');
    handleUnitChange(state.selectedProfiles);
  });
});


export { loadProfiles, selectProfile, deselectProfile, generatePopupContent, clearMarkers, attachMarkerHandlers, state };
