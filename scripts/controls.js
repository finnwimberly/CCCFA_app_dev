import { map } from './map-setup.js';
import { sstOverlay, sssOverlay, bathymetryLayer } from './layers.js';
import { initializePlots, removeCTDMeasurements } from './plots.js';
import { loadProfiles } from './map.js';
import { state } from './state.js';

// Add Date Range Picker control
const DateRangeControl = L.Control.extend({
  onAdd: function () {
    const div = L.DomUtil.create('div', 'leaflet-control custom-control date-control');
    div.innerHTML = `
      <div class="control-container">
        <h3 class="control-title">Time Control</h3>
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
      </div>`;
    return div;
  },
});

map.addControl(new DateRangeControl({ position: 'topright' }));

// Initialize Date Picker
$(function () {
  const picker = $('#daterange');
  let currentMode = 'range';

  // Function to initialize the date picker
  function initializePicker(mode) {
    const options = {
      opens: 'left',
      maxDate: moment().format("MM/DD/YYYY"),
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
        // Load profiles within the selected date range
        loadProfiles(start, end);
      } else if (mode === 'single') {
        const selectedDate = `${start.year()}_${start.dayOfYear().toString().padStart(3, '0')}`;
        sstOverlay.setUrl(`/processed_data/SST/tiles_3day/${selectedDate}/{z}/{x}/{y}.png`);
        sssOverlay.setUrl(`/processed_data/SSS/tiles_mirrored/${selectedDate}/{z}/{x}/{y}.png`);

        // Update legends for the selected date
        createSSTLegend(selectedDate);
        createSSSLegend(selectedDate);
      }
    });
  }

  // Attach event listeners to date mode radio buttons
  $('input[name="date-mode"]').change(function () {
    currentMode = $(this).val();
    initializePicker(currentMode);
  });

  // Initialize picker in range mode by default
  initializePicker('range');
});

// Add Layer Controls
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
          <input type="checkbox" id="bathymetry-toggle">
          <label for="bathymetry-toggle" class="control-label">Bathymetry Contours</label>
        </div>
      </div>`;
    return div;
  },
});

map.addControl(new LayerSelectControl({ position: 'topright' }));

// Event listeners for layer toggles
document.getElementById('sst-toggle').addEventListener('change', (event) => {
  if (event.target.checked) {
    map.addLayer(sstOverlay);
    document.getElementById('sst-legend').style.display = 'block';
    createSSTLegend();
  } else {
    map.removeLayer(sstOverlay);
    document.getElementById('sst-legend').style.display = 'none';
  }
});

document.getElementById('sss-toggle').addEventListener('change', (event) => {
  if (event.target.checked) {
    map.addLayer(sssOverlay);
    document.getElementById('sss-legend').style.display = 'block';
    createSSSLegend();
  } else {
    map.removeLayer(sssOverlay);
    document.getElementById('sss-legend').style.display = 'none';
  }
});

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