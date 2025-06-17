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
import { loadProfiles, selectProfileSilently, createEmoltIcon } from './map.js';
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
                <button id="apply-filters" class="small-button">Apply Filters</button>
            </div>
        </div>
            </div>

            <!-- Layer Control Section -->
            <div class="control-section">
                <div class="collapsible-header">
                    <label class="control-section-label">Layer Control
                <i id="info-icon" class="fas fa-info-circle" title="Info"></i>
                    </label>
                    <i class="fas fa-chevron-down collapse-icon"></i>
                </div>
                <div class="collapsible-content" id="layer-content">
            <div class="control-item">
                <label class="control-section-label">Layer date:</label>
                <input type="text" id="layer-date" name="layer-date" 
                    class="control-input" />
            </div>
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
                        <label class="control-section-label">Date Tolerance: ±<span id="tolerance-value">2</span> days</label>
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

            <!-- Action Buttons Section -->
            <div class="control-section">
                <button class="control-button select-button">Select Profiles by Area</button>
        <button class="control-button">Deselect All Profiles</button>
            </div>
      </div>
    `;
    return div;
  },
});

// Remove the old controls and add the new combined control
map.addControl(new CombinedControl({ position: 'topright' }));

// Create info modal
const infoModal = `
  <div id="info-overlay"></div>
  <div id="info-modal">
    <span id="info-modal-close">&times;</span>
    <h4>Layer Selection Color Scheme</h4>
    <p class="modal-subtitle">
      The color of each date indicates which data layers are available. A diagonal stripe indicates that high-resolution SST data is available for that date.
    </p>
    <ul>
      <li><span class="color-block highlight-all"></span> All layers available (High resolution (HR) SST, gapfilled SST,
      SST anomaly,SSS, and CHL)</li>
      <li><span class="color-block highlight-all-no-sst"></span> All layers except HR SST (gapfilled SST, 
      SST anomaly, SSS and CHL)</li>
      <li><span class="color-block highlight-all-no-sss"></span> All layers except SSS (HR SST, gapfilled SST, SST anomaly, 
      and CHL)</li>
      <li><span class="color-block highlight-all-no-sss-sst"></span> All layers except SSS and HR SST (gapfilled SST, SST anomaly, 
      and CHL)</li>
      <li><span class="color-block highlight-all-sst"></span> All SST layers but no SSS or CHL</li>
      <li><span class="color-block highlight-ostia-only"></span> Only gapfilled and anomaly SST layers available</li>
    </ul>
  </div>
`;

// Create layer date modal
const layerDateModal = `
  <div id="layer-date-overlay"></div>
  <div id="layer-date-modal">
    <span id="layer-date-modal-close">&times;</span>
    <h4>Layer Date Required</h4>
    <p class="modal-subtitle">
      Please select a layer date prior to selecting a layer.
    </p>
  </div>
`;

document.body.insertAdjacentHTML('beforeend', infoModal);
document.body.insertAdjacentHTML('beforeend', layerDateModal);

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

// Modify the layer date modal behavior
function showLayerDateModal() {
    const overlay = document.getElementById('layer-date-overlay');
    const modal = document.getElementById('layer-date-modal');
    if (overlay && modal) {
        // Prevent any existing event handlers
        overlay.style.pointerEvents = 'none';
        modal.style.pointerEvents = 'none';
        
        // Show the modal
        overlay.style.display = 'block';
        modal.style.display = 'block';
        
        // Re-enable pointer events after a small delay
        setTimeout(() => {
            overlay.style.pointerEvents = 'auto';
            modal.style.pointerEvents = 'auto';
        }, 100);
    }
}

function hideLayerDateModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const overlay = document.getElementById('layer-date-overlay');
    const modal = document.getElementById('layer-date-modal');
    if (overlay && modal) {
        overlay.style.display = 'none';
        modal.style.display = 'none';
    }
}

// Update the layer date modal event listeners
document.getElementById('layer-date-modal-close').addEventListener('click', (event) => {
    hideLayerDateModal(event);
});

document.getElementById('layer-date-overlay').addEventListener('click', (event) => {
    hideLayerDateModal(event);
});

// Prevent clicks inside the modal from closing it
document.getElementById('layer-date-modal').addEventListener('click', (event) => {
    event.stopPropagation();
});

// Define showModal function before it's used
function showModal(message) {
  // Create overlay if it doesn't exist
  if (!document.getElementById('error-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'error-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
    `;
    document.body.appendChild(overlay);
  }

  // Create modal if it doesn't exist
  if (!document.getElementById('error-modal')) {
    const modal = document.createElement('div');
    modal.id = 'error-modal';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--surface);
      padding: var(--spacing-lg);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 6px var(--shadow);
      z-index: 1001;
      max-width: 500px;
      width: 90%;
      text-align: center;
    `;
    document.body.appendChild(modal);
  }

  // Show overlay and modal
  document.getElementById('error-overlay').style.display = 'block';
  const modal = document.getElementById('error-modal');
  modal.style.display = 'block';
  modal.innerHTML = `
    <div style="position: relative;">
      <span style="position: absolute; top: 0; right: 0; cursor: pointer; font-size: 1.5rem; color: var(--text-secondary);" onclick="document.getElementById('error-overlay').style.display = 'none'; this.parentElement.parentElement.style.display = 'none';">&times;</span>
      <p style="margin: 0; color: var(--text-primary);">${message}</p>
    </div>
  `;

  // Add click event to overlay to close modal
  document.getElementById('error-overlay').onclick = function() {
    this.style.display = 'none';
    document.getElementById('error-modal').style.display = 'none';
  };
}

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
            // Uncheck the toggle
            document.getElementById(layerTypes[layerType].toggleId).checked = false;
            
            // Show the layer date modal
            showLayerDateModal();
            
            return;
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
setupCheckboxToggle('fishbot-temperature-toggle', (event, checked) => {
    // Deactivate other fishbot variables
    if (checked) {
        document.getElementById('fishbot-oxygen-toggle').checked = false;
        document.getElementById('fishbot-salinity-toggle').checked = false;
    }
    
    // Get the current layer date and tolerance
    const currentTileDate = tileDate;
    const toleranceSlider = document.getElementById('date-tolerance-slider');
    const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    
    toggleFishbotLayer(checked, currentTileDate, tolerance, 'temperature');
});
setupCheckboxToggle('fishbot-oxygen-toggle', (event, checked) => {
    // Deactivate other fishbot variables
    if (checked) {
        document.getElementById('fishbot-temperature-toggle').checked = false;
        document.getElementById('fishbot-salinity-toggle').checked = false;
    }
    
    // Get the current layer date and tolerance
    const currentTileDate = tileDate;
    const toleranceSlider = document.getElementById('date-tolerance-slider');
    const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    
    toggleFishbotLayer(checked, currentTileDate, tolerance, 'oxygen');
});
setupCheckboxToggle('fishbot-salinity-toggle', (event, checked) => {
    // Deactivate other fishbot variables
    if (checked) {
        document.getElementById('fishbot-temperature-toggle').checked = false;
        document.getElementById('fishbot-oxygen-toggle').checked = false;
    }
    
    // Get the current layer date and tolerance
    const currentTileDate = tileDate;
    const toleranceSlider = document.getElementById('date-tolerance-slider');
    const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    
    toggleFishbotLayer(checked, currentTileDate, tolerance, 'salinity');
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

    // Fetch available dates for highlighting
    Promise.all([
        fetchAvailableDates(sstDatesPath),
        fetchAvailableDates(sssDatesPath),
        fetchAvailableDates(chloroDatesPath),
        fetchAvailableDates(ostiaSstDatesPath),
        fetchAvailableDates(ostiaAnomalyDatesPath)
    ])
    .then(([sstDates, sssDates, chloroDates, ostiaSstDates, ostiaAnomalyDates]) => {
        const sstSet = new Set(sstDates);
        const sssSet = new Set(sssDates);
        const chloroSet = new Set(chloroDates);
        const ostiaSstSet = new Set(ostiaSstDates);
        const ostiaAnomalySet = new Set(ostiaAnomalyDates);
        const allDatesSet = new Set([...sstDates, ...sssDates, ...chloroDates, ...ostiaSstDates, ...ostiaAnomalyDates]);

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
            console.log('[DATERANGEPICKER] About to set input value.');
            console.log('  Selected date (moment):', date.format());
            console.log('  Folder date:', layerDate);
            console.log('  Display date:', date.format('MM/DD/YYYY'));
            layerDateInput.value = date.format('MM/DD/YYYY');
            // Store folder date for logic
            layerDateInput.setAttribute('data-folder-date', layerDate);
            // Update layer paths (use folder format)
            updateLayerPaths(layerDate);
            // Trigger a change event to update the timeline (use folder format)
            const event = new Event('change');
            layerDateInput.dispatchEvent(event);
            // Log the value after setting
            console.log('  Input value after set:', layerDateInput.value);
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
    
    console.log('Applying filters with dates:', startDate, 'to', endDate);
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
    const deselectButton = document.querySelector('.control-button:not(.select-button)');
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

export { activeLayerType };

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

// Helper function to convert folder date (YYYY_DDD or YYYYDDD) to MM/DD/YYYY
function folderDateToDisplay(date) {
    let y = date.slice(0, 4);
    let d = parseInt(date.slice(-3), 10);
    // Create date by adding days to January 1st of the year
    let jsDate = new Date(y, 0, 1); // January 1st
    jsDate.setDate(jsDate.getDate() + d); // Add the full day number
    let mm = String(jsDate.getMonth() + 1).padStart(2, '0');
    let dd = String(jsDate.getDate()).padStart(2, '0');
    let yyyy = jsDate.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}
// Helper to convert MM/DD/YYYY to YYYY_DDD
function displayToFolderDate(displayDate) {
    // displayDate: MM/DD/YYYY
    const [mm, dd, yyyy] = displayDate.split(/[\/]/);
    const date = new Date(`${yyyy}-${mm}-${dd}`);
    const start = new Date(date.getFullYear(), 0, 1); // January 1st of the year
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const day = Math.floor(diff / oneDay); // Remove the +1
    return `${yyyy}_${String(day).padStart(3, '0')}`;
}