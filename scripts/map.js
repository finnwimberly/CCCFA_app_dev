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

async function selectProfile(id, marker, date) {
  const color = generateColor(state.colorIndex++);
  marker.setStyle({ color: color });

  console.log(`Starting selection of profile ${id}`);

  state.selectedProfiles[id] = { 
    color: color,
    measurements: null
  };

  try {
    const measurements = await loadMeasurementData(id);
    console.log(`Loaded measurements for profile ${id}:`, measurements);

    await plotCTDMeasurements(id, measurements, color);
    console.log(`Traces plotted for profile ${id}`);

    state.selectedProfiles[id].measurements = measurements;

    if (!marker.getPopup()) {
      const popupContent = generatePopupContent(date, measurements);
      marker.bindPopup(popupContent, {autoClose: false, closeOnClick: false}).openPopup();
    }
  } catch (error) {
    console.error(`Error processing profile ${id}:`, error);
    delete state.selectedProfiles[id];
  }
}


function deselectProfile(id, marker) {
  marker.setStyle({ color: 'black', fillColor: 'white' });
  marker.closePopup();
  marker.unbindPopup();

  console.log(`Before removal:`, state.selectedProfiles);

  if (state.selectedProfiles[id]) {
    removeCTDMeasurements(id);
    delete state.selectedProfiles[id];
    console.log(`Removing ${id} from selectedProfiles. Updated selected profiles:`, state.selectedProfiles);
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
