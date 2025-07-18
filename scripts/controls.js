import { map } from './map-setup.js';
import { 
  sstOverlay, 
  sssOverlay, 
  chlOverlay, 
  bathymetryLayer, 
  updateLayerPaths, 
  tileDate, 
  createLegend,
  ostiaSstOverlay,
  ostiaAnomalyOverlay
} from './layers.js';
import { initializePlots, removeCTDMeasurements } from './plots.js';
import { loadProfiles, selectProfileSilently, createEmoltIcon, showModal } from './map.js';
import { loadProfilesMetadata } from './data-loading.js';
import { state } from './state.js';
import { toggleFishbotLayer, updateFishbotForDate } from './fishbot.js';
import { initializeTimeline } from './timeline.js';

console.log('Controls.js loaded - layer date modal for safari');

// Add these variables at the top level
let drawingPolygon = false;
let polygon = null;
let points = [];
let tempLine = null;

// Store available dates for each layer
const availableLayerDates = {
  SST: [],
  SSS: [],
  CHL: [],
  OSTIA_SST: [],
  OSTIA_anomaly: [],
  fishbot: []
};

// Helper to set the most recent date for a given layer
function setMostRecentLayerDate(layerType) {
    const dateList = availableLayerDates[layerType];
    if (dateList && dateList.length > 0) {
        const mostRecentDate = dateList[dateList.length - 1]; // 'YYYY-MM-DD'
        const layerDateInput = document.getElementById('layer-date');
        // Set input value for display
        layerDateInput.value = moment(mostRecentDate).format('MM/DD/YYYY');
        // Set folder date attribute
        const year = mostRecentDate.slice(0, 4);
        const dayOfYear = moment(mostRecentDate, "YYYY-MM-DD").dayOfYear().toString().padStart(3, '0');
        const folderDate = `${year}_${dayOfYear}`;
        layerDateInput.setAttribute('data-folder-date', folderDate);
        // Update global tileDate and layer paths
        updateLayerPaths(folderDate);
        // Trigger change event for timeline, etc.
        const event = new Event('change');
        layerDateInput.dispatchEvent(event);
        return folderDate;
    } else {
        showModal("No available dates for this layer.");
        return null;
    }
}

// Add a helper similar to setMostRecentLayerDate but for Fishbot:
function setMostRecentFishbotDate() {
    const dateList = availableLayerDates.fishbot; // Note: lowercase 'fishbot' to match the key
    if (dateList && dateList.length > 0) {
        const mostRecentDate = dateList[dateList.length - 1]; // YYYY-MM-DD
        const layerDateInput = document.getElementById('layer-date');
        // Set input value for display
        layerDateInput.value = moment(mostRecentDate).format('MM/DD/YYYY');
        // Set folder date attribute
        const year = mostRecentDate.slice(0, 4);
        const dayOfYear = moment(mostRecentDate, "YYYY-MM-DD").dayOfYear().toString().padStart(3, '0');
        const folderDate = `${year}_${dayOfYear}`;
        layerDateInput.setAttribute('data-folder-date', folderDate);
        // Update global tileDate and layer paths
        updateLayerPaths(folderDate);
        // Trigger change event for timeline, etc.
        const event = new Event('change');
        layerDateInput.dispatchEvent(event);

        return folderDate;
    } else {
        showModal("No available dates for Fishbot data.");
        return null;
    }
}

// Create a single combined control panel
const CombinedControl = L.Control.extend({
    onAdd: function () {
      const div = L.DomUtil.create('div', 'leaflet-control custom-control combined-control');
      div.innerHTML = `
        <div class="control-container">
            <h3 class="control-title">Map Controls</h3>
            
            <!-- Filter Profiles Section -->
            <div class="control-section">
                <div class="collapsible-header">
                    <label class="control-section-label">Filter Profiles</label>
                    <i class="fas fa-chevron-down collapse-icon"></i>
                </div>
                <div class="collapsible-content" id="filter-content">
            <div class="control-item">
                <label class="control-section-label">Date range:</label>
                <div style="position: relative;">
                    <input type="text" id="daterange" name="daterange" 
                        value="08/01/2024 - ${moment().format("MM/DD/YYYY")}" 
                        class="control-input" />
                </div>
            </div>
            <div class="control-item">
                        <div class="collapsible-header sub-header">
                    <label class="control-section-label">Profile Sources:</label>
                    <i class="fas fa-chevron-down collapse-icon"></i>
                </div>
                <div class="collapsible-content" id="projects-content">
                    <div class="source-filters">
                        <div class="checkbox-group">
                            <input type="checkbox" id="emolt-toggle" name="source" value="EMOLT">
                            <label for="emolt-toggle" class="control-label">eMOLT</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="cccfa-toggle" name="source" value="cccfa_outer_cape" checked>
                            <label for="cccfa-toggle" class="control-label">CCCFA CTDs</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="cfrf-toggle" name="source" value="shelf_research_fleet" checked>
                            <label for="cfrf-toggle" class="control-label">CFRF CTDs</label>
                        </div>
                    </div>
                </div>
                <button id="apply-filters" class="control-button">Apply Filters</button>
            </div>
        </div>
            </div>

            <!-- Profile Selection Section -->
            <div class="control-section">
                <div class="collapsible-header">
                    <label class="control-section-label">Profile Selection</label>
                    <i class="fas fa-chevron-down collapse-icon"></i>
                </div>
                <div class="collapsible-content" id="profile-selection-content">
                    <button class="control-button select-button">Select Profiles by Area</button>
                    <button id="deselect-all-profiles" class="control-button">Deselect All Profiles</button>
                </div>
            </div>

            <!-- Layer Control Section -->
            <div class="control-section">
                <div class="collapsible-header">
                    <label class="control-section-label">Layer Control</label>
                    <i class="fas fa-chevron-down collapse-icon"></i>
                </div>
                <div class="collapsible-content" id="layer-content">
                    <div class="control-item">
                        <div class="collapsible-header sub-header">
                    <label class="control-section-label">Surface Layers:</label>
                    <i class="fas fa-chevron-down collapse-icon"></i>
                </div>
                <div class="collapsible-content" id="layers-content">
                    <div class="layer-grid">
                        <div class="checkbox-group">
                            <input type="checkbox" id="sst-toggle">
                            <label for="sst-toggle" class="control-label">SST</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="ostia-sst-toggle">
                            <label for="ostia-sst-toggle" class="control-label">Gapfilled SST</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="ostia-anomaly-toggle">
                            <label for="ostia-anomaly-toggle" class="control-label">SST Anomaly</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="sss-toggle">
                            <label for="sss-toggle" class="control-label">SSS</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="chl-toggle">
                            <label for="chl-toggle" class="control-label">CHL</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="bathymetry-toggle" checked>
                            <label for="bathymetry-toggle" class="control-label">Bathymetry</label>
                        </div>
                    </div>
                </div>
            </div>
                    <div class="control-item">
                        <div class="collapsible-header sub-header">
                    <label class="control-section-label">FishBot:</label>
                    <i class="fas fa-chevron-down collapse-icon"></i>
                </div>
                <div class="collapsible-content" id="fishbot-content">
                    <div class="fishbot-variables">
                        <div class="checkbox-group">
                            <input type="checkbox" id="fishbot-temperature-toggle">
                            <label for="fishbot-temperature-toggle" class="control-label">Temperature</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="fishbot-salinity-toggle">
                            <label for="fishbot-salinity-toggle" class="control-label">Salinity</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="fishbot-oxygen-toggle">
                            <label for="fishbot-oxygen-toggle" class="control-label">Dissolved Oxygen</label>
                        </div>
                    </div>
                    <div class="tolerance-control">
                        <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                            <label class="control-section-label">Date Tolerance: ± <span id="tolerance-value">2</span> days</label>
                            <i id="tolerance-info-icon" class="fas fa-info-circle" style="color: var(--secondary); cursor: pointer; font-size: 14px;"></i>
                        </div>
                        <input type="range" id="date-tolerance-slider" min="0" max="8" value="2" class="tolerance-slider">
                        <div class="slider-labels">
                            <span>0</span>
                            <span>8</span>
                        </div>
                    </div>
                </div>
            </div>
      </div>
            </div>
      </div>
    `;
    
    // Add modal HTML to the document body
    const modalHTML = `
      <div id="tolerance-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 1000;"></div>
      <div id="tolerance-modal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--surface); padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 1001; max-width: 400px; width: 90%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3 style="margin: 0; color: var(--primary); font-size: 16px;">Date Tolerance</h3>
          <button id="tolerance-modal-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-secondary);">&times;</button>
        </div>
                  <div style="color: var(--text-primary); font-size: 14px; line-height: 1.5;">
            <p>The Date Tolerance setting controls how many days before and after the selected date the FishBot data is shown for.</p>
            <p><strong>Example:</strong> With a tolerance of ± 2 days and a layer date of January 15th, FishBot data from January 13th to January 17th will be shown.</p>
            <p>When spatial coverage is more important than temporal precision, increase the tolerance. When you want to know the bottom conditions on an exact day, 
            decrease the tolerance.</p>
            <p>The tolerance only affects FishBot data layers (Temperature, Salinity, Dissolved Oxygen). Satellite layers (SST, SSS, CHL) always use the exact selected date.</p>
            <p>When FishBot has data available for multiple days within the tolerance at the same location, the values are averaged together to provide a representative measurement.</p>
          </div>
      </div>
    `;
    
    // Append modal HTML to document body if it doesn't already exist
    if (!document.getElementById('tolerance-overlay')) {
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    return div;
  },
});

// Remove the old controls and add the new combined control
map.addControl(new CombinedControl({ position: 'topleft' }));

async function fetchAvailableDates(filePath) {
  try {
      console.log(`Fetching dates from: ${filePath}`);
      const response = await fetch(filePath);
      if (!response.ok) {
          throw new Error(`Failed to fetch ${filePath}`);
      }
      const text = await response.text();
      const dates = text
          .split('\n')
          .filter(line => line.trim() && /^\d{4}\d{3}$/.test(line.trim()))
          .map(dateStr => {
              const year = parseInt(dateStr.slice(0, 4), 10);
              const dayOfYear = parseInt(dateStr.slice(4), 10);
              const formattedDate = moment(`${year}-${dayOfYear}`, "YYYY-DDD").format("YYYY-MM-DD");
              return formattedDate;
          });
      return dates;
  } catch (error) {
      console.error(`Error fetching dates from ${filePath}: ${error.message}`);
      return [];
  }
}

// Function to extract fishbot dates from CSV data
async function fetchFishbotDates() {
    try {

        const response = await fetch('../data/FIShBOT/fishbot.csv');
        const csvText = await response.text();
        
        // Parse CSV data using Papa Parse (now available globally via CDN)
        const parseResult = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false // Keep as strings to handle empty fields
        });
        
        if (parseResult.errors.length > 0) {
            console.warn('CSV parsing errors:', parseResult.errors);
        }
        
        // Extract unique dates from the time column
        const uniqueDates = new Set();
        parseResult.data.forEach(row => {
            if (row.time && row.time.trim() !== '') {
                const date = moment.utc(row.time).format('YYYY-MM-DD');
                uniqueDates.add(date);
            }
        });
        
        // Convert to array and sort
        const dates = Array.from(uniqueDates).sort();
        
        // Remove today's date to align with surface layer data that only goes up to yesterday
        const today = moment().format('YYYY-MM-DD');
        const filteredDates = dates.filter(date => date !== today);
        
        console.log(`Loaded ${filteredDates.length} fishbot dates (excluding today)`);
        return filteredDates;
    } catch (error) {
        console.error('Error fetching fishbot dates:', error);
        return [];
    }
}

// Unified checkbox handler function
function setupCheckboxToggle(id, onChangeCallback) {
    const checkbox = document.getElementById(id);
    if (!checkbox) return;

    // Change event (standard for most browsers)
    checkbox.addEventListener('change', (event) => {
        onChangeCallback(event, checkbox.checked);
    });

    // Mousedown fallback for Safari
    checkbox.addEventListener('mousedown', (event) => {
        // Safari fix: manually toggle state
        if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
            event.preventDefault();
            checkbox.checked = !checkbox.checked;
            onChangeCallback(event, checkbox.checked);
        }
    });
}

// Layer toggle functionality - refactored to use a single function
function toggleLayer(layerType, event, isChecked) {
    console.log('toggleLayer called for:', layerType, 'checked:', isChecked);
  
    // Define the layer types and their corresponding elements
    const layerTypes = {
        'SST': {
            overlay: sstOverlay,
            toggleId: 'sst-toggle',
            legendId: 'sst-legend'
        },
        'OSTIA_SST': {
            overlay: ostiaSstOverlay,
            toggleId: 'ostia-sst-toggle',
            legendId: 'ostia-sst-legend'
        },
        'OSTIA_anomaly': {
            overlay: ostiaAnomalyOverlay,
            toggleId: 'ostia-anomaly-toggle',
            legendId: 'ostia-anomaly-legend'
        },
        'SSS': {
            overlay: sssOverlay,
            toggleId: 'sss-toggle',
            legendId: 'sss-legend'
        },
        'CHL': {
            overlay: chlOverlay,
            toggleId: 'chl-toggle',
            legendId: 'chl-legend'
        }
    };

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log('Is Safari:', isSafari);
  
    if (isChecked) {
        // Check if a layer date is selected
        if (!tileDate) {
            // Auto-select most recent date for this layer
            const newDate = setMostRecentLayerDate(layerType);
            if (!newDate) {
                document.getElementById(layerTypes[layerType].toggleId).checked = false;
                return;
            }
            // tileDate is now set, continue as normal
        }

        // Deactivate fishbot layer if it's active
        const fishbotToggles = ['fishbot-temperature-toggle', 'fishbot-oxygen-toggle', 'fishbot-salinity-toggle'];
        fishbotToggles.forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle && toggle.checked) {
                toggle.checked = false;
                toggleFishbotLayer(false);
            }
        });

        // Deactivate other layer types
        Object.keys(layerTypes).forEach(type => {
            if (type !== layerType) {
                const toggle = document.getElementById(layerTypes[type].toggleId);
                if (toggle.checked) {
                    toggle.checked = false;
                    map.removeLayer(layerTypes[type].overlay);
                    const legendElement = document.getElementById(layerTypes[type].legendId);
                    if (legendElement) {
                        console.log('Hiding legend for:', type);
                        if (isSafari) {
                            // For Safari, try multiple approaches
                            legendElement.style.display = 'none';
                            legendElement.style.visibility = 'hidden';
                            legendElement.style.opacity = '0';
                            legendElement.style.position = 'absolute';
                            legendElement.style.pointerEvents = 'none';
                        } else {
                            legendElement.style.display = 'none';
                        }
                    }
                    if (activeLayerType === type) {
                        activeLayerType = null;
                    }
                }
            }
        });
        
        // Update layer paths before activating the layer
        updateLayerPaths(tileDate);
        
        // Activate selected layer
        map.addLayer(layerTypes[layerType].overlay);
        const legendElement = document.getElementById(layerTypes[layerType].legendId);
        if (legendElement) {
            console.log('Showing legend for:', layerType);
            if (isSafari) {
                // Reset all Safari-specific styles
                legendElement.style.display = 'block';
                legendElement.style.visibility = 'visible';
                legendElement.style.opacity = '1';
                legendElement.style.position = '';
                legendElement.style.pointerEvents = '';
            } else {
                legendElement.style.display = 'block';
            }
        }
        activeLayerType = layerType;
        createLegend(layerType, tileDate);
    } else {
        // Deactivate selected layer
        map.removeLayer(layerTypes[layerType].overlay);
        const legendElement = document.getElementById(layerTypes[layerType].legendId);
        if (legendElement) {
            console.log('Hiding legend for:', layerType);
            if (isSafari) {
                // For Safari, try multiple approaches
                legendElement.style.display = 'none';
                legendElement.style.visibility = 'hidden';
                legendElement.style.opacity = '0';
                legendElement.style.position = 'absolute';
                legendElement.style.pointerEvents = 'none';
            } else {
                legendElement.style.display = 'none';
            }
        }
        if (activeLayerType === layerType) {
            activeLayerType = null;
        }
    }
}

// Setup layer toggles
setupCheckboxToggle('sst-toggle', (event, checked) => toggleLayer('SST', event, checked));
setupCheckboxToggle('ostia-sst-toggle', (event, checked) => toggleLayer('OSTIA_SST', event, checked));
setupCheckboxToggle('ostia-anomaly-toggle', (event, checked) => toggleLayer('OSTIA_anomaly', event, checked));
setupCheckboxToggle('sss-toggle', (event, checked) => toggleLayer('SSS', event, checked));
setupCheckboxToggle('chl-toggle', (event, checked) => toggleLayer('CHL', event, checked));
setupCheckboxToggle('bathymetry-toggle', (event, checked) => {
    if (checked) {
        map.addLayer(bathymetryLayer);
    } else {
        map.removeLayer(bathymetryLayer);
    }
});

// // Setup Fishbot toggles
// setupCheckboxToggle('fishbot-temperature-toggle', (event, checked) => {
//     // Deactivate other fishbot variables
//     if (checked) {
//         document.getElementById('fishbot-oxygen-toggle').checked = false;
//         document.getElementById('fishbot-salinity-toggle').checked = false;
//     }
    
//     // Get the current layer date and tolerance
//     const currentTileDate = tileDate;
//     const toleranceSlider = document.getElementById('date-tolerance-slider');
//     const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    
//     toggleFishbotLayer(checked, currentTileDate, tolerance, 'temperature');
// });
// setupCheckboxToggle('fishbot-oxygen-toggle', (event, checked) => {
//     // Deactivate other fishbot variables
//     if (checked) {
//         document.getElementById('fishbot-temperature-toggle').checked = false;
//         document.getElementById('fishbot-salinity-toggle').checked = false;
//     }
    
//     // Get the current layer date and tolerance
//     const currentTileDate = tileDate;
//     const toleranceSlider = document.getElementById('date-tolerance-slider');
//     const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    
//     toggleFishbotLayer(checked, currentTileDate, tolerance, 'oxygen');
// });
// setupCheckboxToggle('fishbot-salinity-toggle', (event, checked) => {
//     // Deactivate other fishbot variables
//     if (checked) {
//         document.getElementById('fishbot-temperature-toggle').checked = false;
//         document.getElementById('fishbot-oxygen-toggle').checked = false;
//     }
    
//     // Get the current layer date and tolerance
//     const currentTileDate = tileDate;
//     const toleranceSlider = document.getElementById('date-tolerance-slider');
//     const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    
//     toggleFishbotLayer(checked, currentTileDate, tolerance, 'salinity');
// });

// Modify fishbot toggle callbacks
setupCheckboxToggle('fishbot-temperature-toggle', (event, checked) => {
    if (checked && !tileDate) {
        tileDate = setMostRecentFishbotDate();
        if (!tileDate) {
            document.getElementById('fishbot-temperature-toggle').checked = false;
            return;
        }
    }
    const toleranceSlider = document.getElementById('date-tolerance-slider');
    const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    toggleFishbotLayer(checked, tileDate, tolerance, 'temperature');
});

setupCheckboxToggle('fishbot-oxygen-toggle', (event, checked) => {
    if (checked && !tileDate) {
        tileDate = setMostRecentFishbotDate();
        if (!tileDate) {
            document.getElementById('fishbot-oxygen-toggle').checked = false;
            return;
        }
    }
    const toleranceSlider = document.getElementById('date-tolerance-slider');
    const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    toggleFishbotLayer(checked, tileDate, tolerance, 'oxygen');
});

setupCheckboxToggle('fishbot-salinity-toggle', (event, checked) => {
    if (checked && !tileDate) {
        tileDate = setMostRecentFishbotDate();
        if (!tileDate) {
            document.getElementById('fishbot-salinity-toggle').checked = false;
            return;
        }
    }
    const toleranceSlider = document.getElementById('date-tolerance-slider');
    const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    toggleFishbotLayer(checked, tileDate, tolerance, 'salinity');
});

// Setup date tolerance slider
document.getElementById('date-tolerance-slider').addEventListener('input', function(e) {
    const toleranceValue = parseInt(e.target.value);
    document.getElementById('tolerance-value').textContent = toleranceValue;
    
    // Update fishbot layer if any fishbot variable is currently active
    const fishbotToggles = ['fishbot-temperature-toggle', 'fishbot-oxygen-toggle', 'fishbot-salinity-toggle'];
    
    for (const toggleId of fishbotToggles) {
        const toggle = document.getElementById(toggleId);
        if (toggle && toggle.checked && tileDate) {
            // Determine variable type from toggle ID
            const variableType = toggleId.replace('fishbot-', '').replace('-toggle', '');
            toggleFishbotLayer(true, tileDate, toleranceValue, variableType);
            break; // Only one should be active at a time
        }
    }
});

// Prevent slider from dragging the map using Leaflet's DOM event methods
const toleranceSlider = document.getElementById('date-tolerance-slider');
L.DomEvent.disableClickPropagation(toleranceSlider);
L.DomEvent.disableScrollPropagation(toleranceSlider);

// Setup profile source toggles
setupCheckboxToggle('emolt-toggle', () => {});
setupCheckboxToggle('cccfa-toggle', () => {});
setupCheckboxToggle('cfrf-toggle', () => {});

// Initialize date pickers
$(function () {
    // Paths for SST, SSS, and Chloro dates
    const sstDatesPath = '../data/SST/sst_dates.txt';
    const sssDatesPath = '../data/SSS/sss_dates.txt';
    const chloroDatesPath = '../data/CHL/chl_dates.txt';
    const ostiaSstDatesPath = '../data/OSTIA_SST/sst_dates.txt';
    const ostiaAnomalyDatesPath = '../data/OSTIA_anomaly/ssta_dates.txt';
    const fishbotDatesPath = '../data/OSTIA_anomaly/ssta_dates.txt';

    // const sstDatesPath = '/data/processed_data/SST/sst_dates.txt';
    // const sssDatesPath = '/data/processed_data/SSS/sss_dates.txt';
    // const chloroDatesPath = '/data/processed_data/CHL/chl_dates.txt';
    // const ostiaSstDatesPath = '/data/processed_data/OSTIA_SST/sst_dates.txt';
    // const ostiaAnomalyDatesPath = '/data/processed_data/OSTIA_anomaly/ssta_dates.txt';
    // const fishbotDatesPath = '/data/processed_data/OSTIA_anomaly/ssta_dates.txt';

    // Fetch available dates for highlighting
    Promise.all([
        fetchAvailableDates(sstDatesPath),
        fetchAvailableDates(sssDatesPath),
        fetchAvailableDates(chloroDatesPath),
        fetchAvailableDates(ostiaSstDatesPath),
        fetchAvailableDates(ostiaAnomalyDatesPath),
        fetchAvailableDates(fishbotDatesPath),
    ])
    .then(([sstDates, sssDates, chloroDates, ostiaSstDates, ostiaAnomalyDates, fishbotDates]) => {
        const sstSet = new Set(sstDates);
        const sssSet = new Set(sssDates);
        const chloroSet = new Set(chloroDates);
        const ostiaSstSet = new Set(ostiaSstDates);
        const ostiaAnomalySet = new Set(ostiaAnomalyDates);
        const fishbotSet = new Set(fishbotDates);
        const allDatesSet = new Set([...sstDates, ...sssDates, ...chloroDates, ...ostiaSstDates, ...ostiaAnomalyDates]);

        // Store available dates for each layer
        availableLayerDates.SST = sstDates;
        availableLayerDates.SSS = sssDates;
        availableLayerDates.CHL = chloroDates;
        availableLayerDates.OSTIA_SST = ostiaSstDates;
        availableLayerDates.OSTIA_anomaly = ostiaAnomalyDates;
        availableLayerDates.fishbot = fishbotDates;

        // Initialize the date range picker for profiles
        $('#daterange').daterangepicker({
            opens: 'right',  // Open aligned to the right side
            maxDate: moment().format("MM/DD/YYYY"),
            startDate: '08/01/2024',
            endDate: moment().format("MM/DD/YYYY"),
            showDropdowns: true,  // Allow year/month dropdown selection
            autoApply: true,  // Apply the selection immediately
            ranges: {
                'Last 30 Days': [moment().subtract(30, 'days'), moment()],
                'Last 60 Days': [moment().subtract(60, 'days'), moment()],
                'Last 90 Days': [moment().subtract(90, 'days'), moment()],
                'All Available Data': ['08/01/2024', moment()]
            }
        });

        // Initialize the layer date picker
        $('#layer-date').daterangepicker({
            opens: 'left',
            maxDate: moment().format("MM/DD/YYYY"),
            singleDatePicker: true,
            autoApply: false,
            autoUpdateInput: false,
            showDropdowns: true,
            isInvalidDate: function (date) {
                const formattedDate = date.format('YYYY-MM-DD');
                return !allDatesSet.has(formattedDate);
            },
            isCustomDate: function (date) {
                const formattedDate = date.format('YYYY-MM-DD');

                // Green with stripe: All layers (both OSTIA SSTs, SST, SSS, and CHL)
                if (ostiaSstSet.has(formattedDate) && 
                    ostiaAnomalySet.has(formattedDate) && 
                    sstSet.has(formattedDate) && 
                    sssSet.has(formattedDate) && 
                    chloroSet.has(formattedDate)) {
                    return 'highlight-all';
                }

                // Green without stripe: All layers except SST (both OSTIA SSTs, SSS, and CHL)
                if (ostiaSstSet.has(formattedDate) && 
                    ostiaAnomalySet.has(formattedDate) && 
                    sssSet.has(formattedDate) && 
                    chloroSet.has(formattedDate)) {
                    return 'highlight-all-no-sst';
                }

                // Yellow with stripe: All layers except CHL (both OSTIA SSTs, SST, and SSS)
                if (ostiaSstSet.has(formattedDate) && 
                    ostiaAnomalySet.has(formattedDate) && 
                    sstSet.has(formattedDate) && 
                    chloroSet.has(formattedDate)) {
                    return 'highlight-all-no-sss';
                }

                // Yellow without stripe: All layers except CHL and SST (both OSTIA SSTs and SSS)
                if (ostiaSstSet.has(formattedDate) && 
                    ostiaAnomalySet.has(formattedDate) && 
                    chloroSet.has(formattedDate)) {
                    return 'highlight-all-no-sss-sst';
                }

                // Orange with stripe: All SSTs but no SSS or CHL (both OSTIAs and SST)
                if (ostiaSstSet.has(formattedDate) && 
                    ostiaAnomalySet.has(formattedDate) && 
                    sstSet.has(formattedDate)) {
                    return 'highlight-all-sst';
                }

                // Orange without stripe: Both OSTIAs but no SST, SSS, or CHL
                if (ostiaSstSet.has(formattedDate) && 
                    ostiaAnomalySet.has(formattedDate)) {
                    return 'highlight-ostia-only';
                }
                
                return ''; // No highlight
            }
        });

        // Date selection will only happen when user explicitly selects a date
        $('#layer-date').on('apply.daterangepicker', function(ev, picker) {
            const date = picker.startDate;
            const year = date.year();
            const dayOfYear = date.dayOfYear().toString().padStart(3, '0');
            const layerDate = `${year}_${dayOfYear}`;
            const layerDateInput = document.getElementById('layer-date');
            
            layerDateInput.value = date.format('MM/DD/YYYY');
            // Store folder date for logic
            layerDateInput.setAttribute('data-folder-date', layerDate);
            // Update layer paths (use folder format)
            updateLayerPaths(layerDate);
            // Trigger a change event to update the timeline (use folder format)
            const event = new Event('change');
            layerDateInput.dispatchEvent(event);
            // Log the value after setting
    
        });
    })
    .catch(error => console.error('Error loading available dates:', error));
});

// Apply Filters button
document.getElementById('apply-filters').addEventListener('click', function() {
    const dateRange = $('#daterange').data('daterangepicker');
    // Format dates in ISO format (YYYY-MM-DD) for consistent handling
    const startDate = dateRange.startDate.format('YYYY-MM-DD');
    const endDate = dateRange.endDate.format('YYYY-MM-DD');
    
    // Get selected sources
    const selectedSources = [];
    if (document.getElementById('emolt-toggle').checked) {
        selectedSources.push('EMOLT');
    }
    if (document.getElementById('cccfa-toggle').checked) {
        selectedSources.push('cccfa_outer_cape');
    }
    if (document.getElementById('cfrf-toggle').checked) {
        selectedSources.push('shelf_research_fleet');
    }
    

    console.log('Selected sources:', selectedSources);
    
    // Clear all legend items
    const legendItems = document.getElementById('profile-legend-items');
    if (legendItems) {
        legendItems.innerHTML = '';
    }
    const legendContainer = document.getElementById('profile-legend-container');
    if (legendContainer) {
        legendContainer.style.display = 'none';
    }
    
    // Call loadProfiles with date range and sources
    loadProfiles(startDate, endDate, selectedSources);
});

let activeLayerType = null; // Track the currently active layer

// Initialize plots after controls are added
initializePlots();

// Update the CSS styles
const style = document.createElement('style');
style.textContent = `
    .leaflet-control.custom-control {
        background: white;
        padding: 8px;
        border-radius: 4px;
        box-shadow: 0 1px 5px rgba(0,0,0,0.2);
        margin: 8px;
        width: 280px;
        max-height: 80vh;
        overflow-y: auto;
        -webkit-user-select: none;
        user-select: none;
    }

    .control-section {
        margin-bottom: 8px;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
    }

    .control-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }

    .control-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: var(--primary);
        text-align: center;
    }

    .control-section-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 4px;
        display: block;
    }

    .control-item {
        margin-bottom: 6px;
    }

    .control-input {
        width: 100%;
        padding: 4px 6px;
        font-size: 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
    }

    .checkbox-group {
        margin-bottom: 3px;
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .checkbox-group input[type="checkbox"] {
        /* Temporarily commenting out custom styling for Safari compatibility testing
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border: 1px solid #ccc;
        border-radius: 3px;
        margin: 0;
        position: relative;
        cursor: pointer;
        background-color: white;
        */
    }

    .checkbox-group input[type="checkbox"]:checked {
        /* Temporarily commenting out custom styling for Safari compatibility testing
        background-color: var(--secondary);
        border-color: var(--secondary);
        */
    }

    .checkbox-group input[type="checkbox"]:checked::after {
        /* Temporarily commenting out custom styling for Safari compatibility testing
        content: '';
        position: absolute;
        left: 4px;
        top: 1px;
        width: 6px;
        height: 10px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
        */
    }

    .checkbox-group input[type="checkbox"]:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .control-label {
        font-size: 12px;
        color: var(--text-secondary);
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
    }

    .collapsible-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        padding: 4px 0;
        -webkit-tap-highlight-color: transparent;
    }

    .sub-header {
        padding: 2px 0;
    }

    .collapse-icon {
        font-size: 12px;
        color: var(--text-secondary);
        transition: transform 0.2s ease;
    }

    .collapsible-header.collapsed .collapse-icon {
        transform: rotate(-90deg);
    }

    .collapsible-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease-out;
    }

    .collapsible-content.expanded {
        max-height: 500px;
    }

    .control-button {
        width: 100%;
        padding: 6px 12px;
        margin-bottom: 6px;
        font-size: 12px;
        background-color: var(--secondary);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        -webkit-tap-highlight-color: transparent;
    }

    .control-button:last-child {
        margin-bottom: 0;
    }

    .control-button:hover {
        background-color: var(--accent);
    }

    .small-button {
        padding: 4px 8px;
        font-size: 11px;
        margin-top: 4px;
    }

    /* Scrollbar styling */
    .leaflet-control.custom-control::-webkit-scrollbar {
        width: 6px;
    }

    .leaflet-control.custom-control::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }

    .leaflet-control.custom-control::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 3px;
    }

    .leaflet-control.custom-control::-webkit-scrollbar-thumb:hover {
        background: #555;
    }

    /* Media queries */
    @media (max-width: 768px) {
        .leaflet-control.custom-control {
            width: 240px;
            max-height: 70vh;
        }
    }

    @media (max-width: 480px) {
        .leaflet-control.custom-control {
            width: 200px;
            max-height: 60vh;
        }
    }

    /* Tolerance slider styling */
    .tolerance-slider {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #ddd;
        outline: none;
        opacity: 0.7;
        transition: opacity 0.2s;
        margin: 8px 0 4px 0;
    }

    .tolerance-slider:hover {
        opacity: 1;
    }

    .tolerance-slider::-webkit-slider-thumb {
        appearance: none;
        width: 16px;
        height: 16px;
        padding: 10px;
        border-radius: 50%;
        background: var(--secondary);
        cursor: pointer;
    }

    .tolerance-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--secondary);
        cursor: pointer;
        border: none;
    }

    .slider-labels {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        padding: 0 5px;
        font-weight: 500;
        color: var(--text-secondary);
        margin-top: 2px;
    }

    /* FishBot subsection styling */
    .fishbot-variables {
        margin-bottom: 8px;
    }

    .tolerance-control {
        padding-top: 4px;
    }

    .tolerance-control .control-section-label {
        font-size: 12px;
        margin-bottom: 4px;
    }
`;
document.head.appendChild(style);

// Update the event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all collapsible sections
  function setupCollapsibles() {
    const headers = document.querySelectorAll('.collapsible-header');
    
    headers.forEach(header => {
      const icon = header.querySelector('.collapse-icon');
            const content = header.nextElementSibling;
      
      // Start with content expanded
      content.classList.add('expanded');
      
      header.addEventListener('click', function() {
        icon.classList.toggle('collapsed');
        content.classList.toggle('expanded');
      });
    });
  }
  
  setupCollapsibles();

    // Setup tolerance info modal event listeners
    const toleranceInfoIcon = document.getElementById('tolerance-info-icon');
    const toleranceOverlay = document.getElementById('tolerance-overlay');
    const toleranceModal = document.getElementById('tolerance-modal');
    const toleranceModalClose = document.getElementById('tolerance-modal-close');

    if (toleranceInfoIcon && toleranceOverlay && toleranceModal && toleranceModalClose) {
        toleranceInfoIcon.addEventListener('click', () => {
            toleranceOverlay.style.display = 'block';
            toleranceModal.style.display = 'block';
            document.body.classList.add('modal-open');
        });
        
        toleranceModalClose.addEventListener('click', () => {
            toleranceOverlay.style.display = 'none';
            toleranceModal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });
        
        toleranceOverlay.addEventListener('click', () => {
            toleranceOverlay.style.display = 'none';
            toleranceModal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });
    }
  
    // Add event listener for Select Profiles by Area button
    const selectButton = document.querySelector('.select-button');
    if (selectButton) {
        selectButton.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent the click from being treated as a map click
            
            if (drawingPolygon) {
                // Confirm selection mode
                if (points.length >= 3) {
                    finishPolygon();
                } else {
                    showModal("Please add at least 3 points to create a selection area.");
                }
            } else {
                // Start drawing mode
                drawingPolygon = true;
                selectButton.textContent = 'Confirm Selection';
                points = [];
                
                // Disable map interactions to avoid conflicts
                map.dragging.disable();
                map.doubleClickZoom.disable();
                
                // Add event listeners
                map.on('click', handleMapClick);
                map.on('mousemove', handleMouseMove);
            }
        });
    }

    // Add event listener for Deselect All Profiles button
    const deselectButton = document.getElementById('deselect-all-profiles');
    if (deselectButton) {
        deselectButton.addEventListener('click', function() {
            // Deselect all profiles
            Object.keys(state.markers).forEach(profileId => {
                const markerInfo = state.markers[profileId];
                const marker = markerInfo.marker;
                const dataType = markerInfo.dataType;
                
                if (dataType === 'CTD') {
                    // Reset CTD marker style
                    marker.setStyle({ color: 'black', fillColor: 'white' });
                } else {
                    // Reset EMOLT marker style using the zoom-responsive function
                    marker.setIcon(createEmoltIcon(map.getZoom()));
                }
                
                // Close any popups
                if (marker.getPopup()) {
                    marker.closePopup();
                    marker.unbindPopup();
                }
            });
            
            // Remove all plots
            Object.keys(state.selectedProfiles).forEach(profileId => {
                removeCTDMeasurements(profileId);
            });
            
            // Clear legend items and hide container
            const legendItems = document.getElementById('profile-legend-items');
            legendItems.innerHTML = '';  // Remove all legend items
            document.getElementById('profile-legend-container').style.display = 'none';
            
            // Clear all properties of selectedProfiles
            Object.keys(state.selectedProfiles).forEach(profileId => {
                delete state.selectedProfiles[profileId];
            });
            
            // Reset color index
            state.colorIndex = 0;
        });
    }

    // Apply initial filter with only the checked sources
  setTimeout(() => {
    const emoltChecked = document.getElementById('emolt-toggle').checked;
    const cccfaChecked = document.getElementById('cccfa-toggle').checked;
    const cfrfChecked = document.getElementById('cfrf-toggle').checked;
    
        const initialSources = [];
        if (cccfaChecked) initialSources.push('cccfa_outer_cape');
        if (cfrfChecked) initialSources.push('shelf_research_fleet');
        if (emoltChecked) initialSources.push('EMOLT');
        
        const defaultStartDate = '2024-08-01';
        const defaultEndDate = moment().format('YYYY-MM-DD');
        loadProfiles(defaultStartDate, defaultEndDate, initialSources);
    }, 800);
});

export { activeLayerType, availableLayerDates };

// Update the profile handling functions
function handleMapClick(e) {
  if (!drawingPolygon) return; // Only handle clicks when in drawing mode
  
  // Add point to polygon
  points.push(e.latlng);
  
  // Update visual representation
  updatePolygonDisplay();
}

function handleMouseMove(e) {
  if (!drawingPolygon || points.length === 0) return; // Only handle moves when in drawing mode and have points
  
  // Update temporary line
  if (tempLine) {
    map.removeLayer(tempLine);
  }
  
  const tempPoints = [...points, e.latlng];
  tempLine = L.polyline(tempPoints, {color: 'red', weight: 2, dashArray: '5, 5'}).addTo(map);
}

function updatePolygonDisplay() {
  if (points.length < 2) return; // Need at least 2 points for a line
  
  // Remove old polygon
  if (polygon) {
    map.removeLayer(polygon);
  }
  
  // Create new polygon
  polygon = L.polygon(points, {color: 'red', weight: 2, fillOpacity: 0.2}).addTo(map);
}

function finishPolygon() {
  if (points.length < 3) return; // Need at least 3 points for a polygon
  
  // Clean up temp line
  if (tempLine) {
    map.removeLayer(tempLine);
    tempLine = null;
  }
  
  // Create final polygon
  if (polygon) {
    map.removeLayer(polygon);
  }
  
  polygon = L.polygon(points, {color: 'red', fillOpacity: 0.2}).addTo(map);
  
  // Select all profiles within polygon
  selectProfilesInPolygon(polygon);
  
  // Exit drawing mode
  drawingPolygon = false;
  
  // Show success with green button briefly
  const button = document.querySelector('.select-button');
  button.textContent = 'Selection Complete';
  button.style.backgroundColor = '#2E8B57'; // Sea green for confirmation
  
  // Reset button after a brief delay
  setTimeout(() => {
    button.textContent = 'Select Profiles by Area';
    button.style.backgroundColor = ''; // Reset to original color
  }, 1000);
  
  // Re-enable normal map interactions
  map.dragging.enable();
  map.doubleClickZoom.enable();
  
  // Remove event listeners
  map.off('click', handleMapClick);
  map.off('mousemove', handleMouseMove);
  
  // Remove polygon after a brief delay
  setTimeout(() => {
    if (polygon) {
      map.removeLayer(polygon);
      polygon = null;
    }
  }, 1500);
  
  points = [];
}

function selectProfilesInPolygon(polygon) {
  // Get profiles within polygon
  const profilesInArea = [];
  
  // Loop through all markers and check if they're in the polygon
  Object.entries(state.markers).forEach(([id, markerInfo]) => {
    // Skip already selected profiles
    if (state.selectedProfiles[id]) {
      return;
    }
    
    const marker = markerInfo.marker;
    const latLng = marker instanceof L.CircleMarker ? marker.getLatLng() : marker.getLatLng();
    
    // Check if marker is inside polygon
    if (isMarkerInsidePolygon(latLng, polygon)) {
      profilesInArea.push({
        id: id,
        marker: marker,
        dataType: markerInfo.dataType
      });
    }
  });
  
  // Check if adding these would exceed the limit of 30 selected profiles
  const currentSelectionCount = Object.keys(state.selectedProfiles).length;
  const totalAfterSelection = currentSelectionCount + profilesInArea.length;
  
  if (totalAfterSelection > 30) {
    showModal("Total selected profiles is capped at 30. Try reducing the date range or selecting a smaller area.");
    return; // Exit without selecting profiles
  }
  
  if (profilesInArea.length === 0) {
    showModal("No profiles found in the selected area.");
    return;
  }
  
  // Process selections
  const promisesToProcess = [];
  
  profilesInArea.forEach(profile => {
    let promise;
    if (profile.dataType === 'EMOLT') {
      // For EMOLT markers, we need to find date from loadProfilesMetadata
      promise = loadProfilesMetadata(moment().subtract(1, 'year'), moment(), 'EMOLT')
        .then(profiles => {
          const foundProfile = profiles.find(p => p['Profile ID'] === profile.id);
          if (foundProfile) {
            const date = foundProfile['Date'];
            // Select the profile but don't show popup
            return selectProfileSilently(profile.id, profile.marker, date);
          }
          return null;
        });
    } else if (profile.dataType === 'CTD') {
      promise = loadProfilesMetadata(moment().subtract(1, 'year'), moment(), 'CTD')
        .then(profiles => {
          const foundProfile = profiles.find(p => p['Profile ID'] === profile.id);
          if (foundProfile) {
            const date = foundProfile['Date'];
            // Select the profile but don't show popup
            return selectProfileSilently(profile.id, profile.marker, date);
          }
          return null;
        });
    }
    
    if (promise) {
      promisesToProcess.push(promise);
    }
  });
  
  // Process all the selection promises
  Promise.all(promisesToProcess)
    .then(() => {
      // Remove this commented-out code
      // showModal(`Selected ${profilesInArea.length} profiles within the area.`);
    })
    .catch(error => {
      console.error('Error selecting profiles in area:', error);
      showModal("There was an error selecting profiles. Please try again.");
    });
}

function isMarkerInsidePolygon(markerLatLng, polygon) {
  const polygonLatLngs = polygon.getLatLngs()[0];
  let inside = false;
  
  // Ray casting algorithm to determine if point is in polygon
  let x = markerLatLng.lng, y = markerLatLng.lat;
  
  for (let i = 0, j = polygonLatLngs.length - 1; i < polygonLatLngs.length; j = i++) {
    const xi = polygonLatLngs[i].lng, yi = polygonLatLngs[i].lat;
    const xj = polygonLatLngs[j].lng, yj = polygonLatLngs[j].lat;
    
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Initialize timeline when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeTimeline();
    // ... any other initialization code ...
});