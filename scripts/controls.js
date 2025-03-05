import { map } from './map-setup.js';
import { sstOverlay, sssOverlay, chlOverlay, bathymetryLayer, updateLayerPaths, tileDate, createLegend } from './layers.js';
import { initializePlots, removeCTDMeasurements } from './plots.js';
import { loadProfiles } from './map.js';
import { state } from './state.js';

const DateRangeControl = L.Control.extend({
    onAdd: function () {
      const div = L.DomUtil.create('div', 'leaflet-control custom-control date-control');
      div.innerHTML = `
        <div class="control-container">
            <h3 class="control-title">Time Control
                <i id="info-icon" class="fas fa-info-circle" title="Info"></i> <!-- Info Icon -->
            </h3>
            <div class="control-item">
                <input type="radio" id="single-date" name="date-mode" value="single">
                <label for="single-date" class="control-label">Layer Date</label>
            </div>
            <div class="control-item">
                <input type="radio" id="date-range" name="date-mode" value="range" checked>
                <label for="date-range" class="control-label">Observation Range</label>
            </div>
            <div class="control-item">
                <input type="text" id="daterange" name="daterange" 
                    value="08/01/2024 - ${moment().format("MM/DD/YYYY")}" 
                    class="control-input" />
            </div>
            </div>
      `;
      return div;
    },
  });

map.addControl(new DateRangeControl({ position: 'topright' }));

const infoModal = `
  <div id="info-overlay"></div>
  <div id="info-modal">
    <span id="info-modal-close">&times;</span>
    <h4>Layer Selection Color Scheme</h4>
    <p class="modal-subtitle">
      In order to view Sea Surface Temperature (SST), Sea Surface Salinity (SSS), or Chlorophyll-a (Chloro) data, select "Layer Date" and then click on a date below. The color of the date corresponds to the data available for that date as follows:
    </p>
    <ul>
      <li><span class="color-block highlight-all">Green</span> SST, SSS, and Chloro available</li>
      <li><span class="color-block highlight-chloro-sst">Purple</span> SST and Chloro available</li>
      <li><span class="color-block highlight-chloro-sss">Yellow</span> SSS and Chloro available</li>
      <li><span class="color-block highlight-sst-only">Blue</span> Only SST available</li>
      <li><span class="color-block highlight-chloro-only">Gray</span> Only Chloro available</li>
    </ul>
    <p class="modal-subtitle">
      To adjust the range over which profile markers are visible, select the "Observation Range" option. You can choose the start and end dates by clicking on the range below. Dates can be selected using the pop-up calendar or by entering values directly into the text box.
    </p>
  </div>
`;

document.body.insertAdjacentHTML('beforeend', infoModal);

// Info Modal Logic
document.getElementById('info-icon').addEventListener('click', () => {
  document.getElementById('info-overlay').style.display = 'block';
  document.getElementById('info-modal').style.display = 'block';
});

document.getElementById('info-modal-close').addEventListener('click', () => {
  document.getElementById('info-overlay').style.display = 'none';
  document.getElementById('info-modal').style.display = 'none';
});

document.getElementById('info-overlay').addEventListener('click', () => {
  document.getElementById('info-overlay').style.display = 'none';
  document.getElementById('info-modal').style.display = 'none';
});

async function fetchAvailableDates(filePath) {
  try {
      console.log(`Fetching dates from: ${filePath}`); // Log the file path
      const response = await fetch(filePath);
      if (!response.ok) {
          throw new Error(`Failed to fetch ${filePath}`);
      }
      const text = await response.text();
      console.log(`Raw file contents (${filePath}):`, text); // Log raw text
      const dates = text
          .split('\n')
          // .filter(line => line.trim()) // Remove empty lines
          .filter(line => line.trim() && /^\d{4}\d{3}$/.test(line.trim())) // Validate format
          .map(dateStr => {
              const year = parseInt(dateStr.slice(0, 4), 10); // Extract year
              const dayOfYear = parseInt(dateStr.slice(4), 10); // Extract day of year
              const formattedDate = moment(`${year}-${dayOfYear}`, "YYYY-DDD").format("YYYY-MM-DD");
              console.log(`Parsed date: ${formattedDate}`); // Log parsed dates
              return formattedDate;
          });
      console.log(`Parsed dates (${filePath}):`, dates);
      return dates;
  } catch (error) {
      console.error(`Error fetching dates from ${filePath}: ${error.message}`);
      return [];
  }
}

$(function () {
  const picker = $('#daterange');
  let currentMode = 'range';

  // Paths for SST, SSS, and Chloro dates
  const sstDatesPath = '../data/SST/sst_dates.txt';
  const sssDatesPath = '../data/SSS/sss_dates.txt';
  const chloroDatesPath = '../data/CHL/chl_dates.txt';

  // Fetch available dates for highlighting
  Promise.all([
      fetchAvailableDates(sstDatesPath),
      fetchAvailableDates(sssDatesPath),
      fetchAvailableDates(chloroDatesPath)
  ])
  .then(([sstDates, sssDates, chloroDates]) => {
      // Log the fetched dates for debugging
      console.log("Fetched SST Dates:", sstDates);
      console.log("Fetched SSS Dates:", sssDates);
      console.log("Fetched Chloro Dates:", chloroDates);

      const sstSet = new Set(sstDates);
      const sssSet = new Set(sssDates);
      const chloroSet = new Set(chloroDates);
      const allDatesSet = new Set([...sstDates, ...sssDates, ...chloroDates]);

      function initializePicker(mode) {
          const options = {
              opens: 'left',
              maxDate: moment().format("MM/DD/YYYY"),
              isInvalidDate: function (date) {
                  const formattedDate = date.format('YYYY-MM-DD');
                  return !allDatesSet.has(formattedDate);
              },
              isCustomDate: function (date) {
                  const formattedDate = date.format('YYYY-MM-DD');

                  if (mode === 'single') {
                      // Green: All three layers available
                      if (sstSet.has(formattedDate) && sssSet.has(formattedDate) && chloroSet.has(formattedDate)) {
                          return 'highlight-all'; // Green
                      }
                      // Purple: Chloro + SST
                      if (chloroSet.has(formattedDate) && sstSet.has(formattedDate) && !sssSet.has(formattedDate)) {
                          return 'highlight-chloro-sst'; // Purple
                      }
                      // Yellow: Chloro + SSS
                      if (chloroSet.has(formattedDate) && sssSet.has(formattedDate) && !sstSet.has(formattedDate)) {
                          return 'highlight-chloro-sss'; // Yellow
                      }
            
                      // Blue: Only SST available
                      if (sstSet.has(formattedDate) && !sssSet.has(formattedDate) && !chloroSet.has(formattedDate)) {
                          return 'highlight-sst-only'; // Blue
                      }

                      // Only Chloro available
                      if (chloroSet.has(formattedDate) && !sstSet.has(formattedDate) && !sssSet.has(formattedDate)) {
                          return 'highlight-chloro-only'; // Gray
                      }
                  }
                  return ''; // No highlight
              },
          };

          if (mode === 'single') {
              options.singleDatePicker = true;
              options.startDate = moment().format("MM/DD/YYYY");
          } else {
              options.singleDatePicker = false;
              options.startDate = '08/01/2024';
              options.endDate = moment().format("MM/DD/YYYY");
          }

          picker.daterangepicker(options, (start, end) => {
              if (mode === 'range') {
                  const startDate = start.format('YYYY-MM-DD');
                  const endDate = end.format('YYYY-MM-DD');
                  loadProfiles(startDate, endDate);
              } else if (mode === 'single') {
                  const year = start.year();
                  const dayOfYear = start.dayOfYear().toString().padStart(3, '0');
                  const tileDate = `${year}_${dayOfYear}`;
                  updateLayerPaths(tileDate);
              }
          });
      }

      // Event listener for date-mode radio buttons
      $('input[name="date-mode"]').change(function () {
          currentMode = $(this).val();
          initializePicker(currentMode);
      });

      // Initialize the picker with "range" mode by default
      initializePicker('range');
  })
  .catch(error => console.error('Error loading available dates:', error));
});

const LayerSelectControl = L.Control.extend({
  onAdd: function () {
    const div = L.DomUtil.create('div', 'leaflet-control custom-control layer-control');
    div.innerHTML = `
      <div class="control-container">
        <h3 class="control-title">Layer Selection</h3>
        <div class="control-item">
          <input type="checkbox" id="sst-toggle">
          <label for="sst-toggle" class="control-label">SST</label>
        </div>
        <div class="control-item">
          <input type="checkbox" id="sss-toggle">
          <label for="sss-toggle" class="control-label">SSS</label>
        </div>
        <div class="control-item">
          <input type="checkbox" id="chl-toggle">
          <label for="chl-toggle" class="control-label">Chlorophyll-a</label>
        </div>
        <div class="control-item">
          <input type="checkbox" id="bathymetry-toggle">
          <label for="bathymetry-toggle" class="control-label">Bathymetry Contours</label>
        </div>
      </div>`;
    return div;
  },
});

map.addControl(new LayerSelectControl({ position: 'topright' }));

let activeLayerType = null; // Track the currently active layer


// SST toggle listener
document.getElementById('sst-toggle').addEventListener('change', (event) => {
  if (event.target.checked) {
    // If SSS is active, deselect it
    const sssToggle = document.getElementById('sss-toggle');
    if (sssToggle.checked) {
      sssToggle.checked = false; // Uncheck the SSS checkbox
      map.removeLayer(sssOverlay); // Remove SSS layer
      document.getElementById('sss-legend').style.display = 'none';
      if (activeLayerType === 'SSS') {
        activeLayerType = null; // Clear active layer
      }
    }

    // If CHL is active, deselect it
    const chlToggle = document.getElementById('chl-toggle');
    if (chlToggle.checked) {
      chlToggle.checked = false; // Uncheck the CHL checkbox
      map.removeLayer(chlOverlay); // Remove CHL layer
      document.getElementById('chl-legend').style.display = 'none';
      if (activeLayerType === 'CHL') {
        activeLayerType = null; // Clear active layer
      }
    }

    // Activate SST
    map.addLayer(sstOverlay);
    document.getElementById('sst-legend').style.display = 'block';
    activeLayerType = 'SST'; // Set active layer to SST
    createLegend('SST', tileDate); // Call the legend function for SST
  } else {
    // Deactivate SST
    map.removeLayer(sstOverlay);
    document.getElementById('sst-legend').style.display = 'none';
    if (activeLayerType === 'SST') {
      activeLayerType = null; // Clear active layer
    }
  }
});

// SSS toggle listener
document.getElementById('sss-toggle').addEventListener('change', (event) => {
  if (event.target.checked) {
    // If SST is active, deselect it
    const sstToggle = document.getElementById('sst-toggle');
    if (sstToggle.checked) {
      sstToggle.checked = false; // Uncheck the SST checkbox
      map.removeLayer(sstOverlay); // Remove SST layer
      document.getElementById('sst-legend').style.display = 'none';
      if (activeLayerType === 'SST') {
        activeLayerType = null; // Clear active layer
      }
    }

    // If CHL is active, deselect it
    const chlToggle = document.getElementById('chl-toggle');
    if (chlToggle.checked) {
      chlToggle.checked = false; // Uncheck the CHL checkbox
      map.removeLayer(chlOverlay); // Remove CHL layer
      document.getElementById('chl-legend').style.display = 'none';
      if (activeLayerType === 'CHL') {
        activeLayerType = null; // Clear active layer
      }
    }

    // Activate SSS
    map.addLayer(sssOverlay);
    document.getElementById('sss-legend').style.display = 'block';
    activeLayerType = 'SSS'; // Set active layer to SSS
    createLegend('SSS', tileDate); // Call the legend function for SSS
  } else {
    // Deactivate SSS
    map.removeLayer(sssOverlay);
    document.getElementById('sss-legend').style.display = 'none';
    if (activeLayerType === 'SSS') {
      activeLayerType = null; // Clear active layer
    }
  }
});

// CHL toggle listener
document.getElementById('chl-toggle').addEventListener('change', (event) => {
  if (event.target.checked) {
    // If SST is active, deselect it
    const sstToggle = document.getElementById('sst-toggle');
    if (sstToggle.checked) {
      sstToggle.checked = false; // Uncheck SST checkbox
      map.removeLayer(sstOverlay); // Remove SST layer
      document.getElementById('sst-legend').style.display = 'none';
      if (activeLayerType === 'SST') {
        activeLayerType = null; // Clear active layer
      }
    }

    // If SSS is active, deselect it
    const sssToggle = document.getElementById('sss-toggle');
    if (sssToggle.checked) {
      sssToggle.checked = false; // Uncheck SSS checkbox
      map.removeLayer(sssOverlay); // Remove SSS layer
      document.getElementById('sss-legend').style.display = 'none';
      if (activeLayerType === 'SSS') {
        activeLayerType = null; // Clear active layer
      }
    }

    // Activate CHL
    map.addLayer(chlOverlay);
    document.getElementById('chl-legend').style.display = 'block';
    activeLayerType = 'CHL'; // Set active layer to CHL
    createLegend('CHL', tileDate); // Call the legend function for CHL
  } else {
    // Deactivate CHL
    map.removeLayer(chlOverlay);
    document.getElementById('chl-legend').style.display = 'none';
    if (activeLayerType === 'CHL') {
      activeLayerType = null; // Clear active layer
    }
  }
});

// Bathymetry toggle listener 
document.getElementById('bathymetry-toggle').addEventListener('change', (event) => {
  if (event.target.checked) {
    map.addLayer(bathymetryLayer);
  } else {
    map.removeLayer(bathymetryLayer);
  }
});

// Add Deselect All Profiles control
const DeselectControl = L.Control.extend({
  onAdd: function () {
    const button = L.DomUtil.create('button', 'control-button');
    button.innerHTML = 'Deselect All Profiles';
    button.style.background = 'white';
    button.style.padding = '4px';
    button.style.borderRadius = '4px';
    button.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
    button.style.fontSize = '14px';
    button.style.cursor = 'pointer';
    button.style.width = '208px';
    button.style.transition = 'box-shadow 0.3s ease, background 0.3s ease';

    // Add hover effect using JavaScript events
    button.addEventListener('mouseenter', function () {
      button.style.background = '#f0f0f0'; // Slightly darker white/gray
      button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4)'; // Slightly more pronounced shadow
    });

    button.addEventListener('mouseleave', function () {
      button.style.background = 'white'; // Restore to original white
      button.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)'; // Restore to original shadow
    });

    L.DomEvent.on(button, 'click', function () {
      // Deselect all profiles
      Object.keys(state.markers).forEach(profileId => {
        state.markers[profileId].setStyle({ color: 'black', fillColor: 'white' });
      });
    
      // Remove all plots
      Object.keys(state.selectedProfiles).forEach(profileId => {
        removeCTDMeasurements(profileId);
      });

      // NEW ADDITION
      // Clear legend items and hide container
      const legendItems = document.getElementById('profile-legend-items');
      legendItems.innerHTML = '';  // Remove all legend items
      document.getElementById('profile-legend-container').style.display = 'none';
      // NEW ADDITION
    
      // Clear all properties of selectedProfiles
      Object.keys(state.selectedProfiles).forEach(profileId => {
        delete state.selectedProfiles[profileId];
      });
    
      // Loop through all layers and close any open popups
      map.eachLayer(function (layer) {
        if (layer.getPopup()) {
          layer.closePopup();
          layer.unbindPopup();
        }
      });
    
      console.log('All profiles have been deselected. Updated selected profiles:', state.selectedProfiles);
    });
    

    // Prevent map click events when clicking the button
    L.DomEvent.disableClickPropagation(button);

    return button;
  },
});

map.addControl(new DeselectControl({ position: 'topright' }));


// Initialize plots after controls are added
initializePlots();

export { activeLayerType };