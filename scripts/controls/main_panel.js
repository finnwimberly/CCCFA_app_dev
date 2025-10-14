import { map } from '../map/core.js';
import { 
  sstOverlay, 
  sssOverlay, 
  chlOverlay, 
  bathymetryLayer, 
  updateLayerPaths, 
  createLegend,
  ostiaSstOverlay,
  ostiaAnomalyOverlay,
  doppioOverlay
} from '../gridded_products/layers.js';
import { controlsState, layerState } from '../state.js';
import { initializePlots, removeCTDMeasurements } from '../profiles_and_plots/plots.js';
import { loadProfiles, selectProfileSilently, createEmoltIcon, showModal } from '../map/profiles.js';
// import { loadProfilesMetadata } from './data-loading.js';
import { state } from '../state.js';
import { toggleFishbotLayer, updateFishbotForDate } from '../gridded_products/fishbot.js';
import { initializeTimeline } from './timeline.js';
import { TOGGLE_IDS, DATE_FILES } from '../config.js';
import { addCombinedControl } from './utils/ui.js';
import { setupCollapsibles } from './utils/collapsible.js';
import { initAreaSelection } from './utils/area-select.js';
import { setupCheckboxToggle as setupCheckboxToggleExternal } from './utils/layer-toggles.js';
import { setupFishbotTolerance } from './utils/fishbot-controls.js';

console.log('Controls.js loaded - layer date modal for safari');

// Store available dates for each layer (centralized in state)
const availableLayerDates = controlsState.availableLayerDates;

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

// Helpers to enforce exclusivity among layer groups
function deactivateForecast() {
    const doppioToggle = document.getElementById(TOGGLE_IDS.DOPPIO);
    if (doppioToggle && doppioToggle.checked) {
        doppioToggle.checked = false;
    }
    if (map.hasLayer(doppioOverlay)) {
        map.removeLayer(doppioOverlay);
    }
    const doppioLegend = document.getElementById('doppio-legend');
    if (doppioLegend) {
        doppioLegend.style.display = 'none';
    }
    if (controlsState.activeLayerType === 'DOPPIO') {
        controlsState.activeLayerType = null;
    }
}

function deactivateFishbot() {
    const fishbotToggles = [TOGGLE_IDS.FISHBOT_TEMPERATURE, TOGGLE_IDS.FISHBOT_OXYGEN, TOGGLE_IDS.FISHBOT_SALINITY];
    fishbotToggles.forEach(toggleId => {
        const toggle = document.getElementById(toggleId);
        if (toggle && toggle.checked) toggle.checked = false;
    });
    if (typeof toggleFishbotLayer === 'function') {
        toggleFishbotLayer(false);
    }
    const fishbotLegend = document.getElementById('fishbot-legend');
    if (fishbotLegend) {
        fishbotLegend.style.display = 'none';
    }
}

function deactivateOtherSurfaceLayers(exceptLayerType) {
    const surfaceLayers = ['SST', 'OSTIA_SST', 'OSTIA_anomaly', 'SSS', 'CHL'];
    surfaceLayers.forEach(type => {
        if (type === exceptLayerType) return;
        const toggleId = type === 'SST' ? 'sst-toggle'
                      : type === 'OSTIA_SST' ? 'ostia-sst-toggle'
                      : type === 'OSTIA_anomaly' ? 'ostia-anomaly-toggle'
                      : type === 'SSS' ? 'sss-toggle'
                      : 'chl-toggle';
        const legendId = type === 'SST' ? 'sst-legend'
                      : type === 'OSTIA_SST' ? 'ostia-sst-legend'
                      : type === 'OSTIA_anomaly' ? 'ostia-anomaly-legend'
                      : type === 'SSS' ? 'sss-legend'
                      : 'chl-legend';
        const overlay = type === 'SST' ? sstOverlay
                      : type === 'SSS' ? sssOverlay
                      : type === 'CHL' ? chlOverlay
                      : type === 'OSTIA_SST' ? ostiaSstOverlay
                      : ostiaAnomalyOverlay;
        const toggle = document.getElementById(toggleId);
        if (toggle && toggle.checked) {
            toggle.checked = false;
        }
        if (map.hasLayer(overlay)) {
            map.removeLayer(overlay);
        }
        const legendElement = document.getElementById(legendId);
        if (legendElement) {
            legendElement.style.display = 'none';
        }
        if (controlsState.activeLayerType === type) {
            controlsState.activeLayerType = null;
        }
    });
}

// Set DOPPIO to today (or nearest available) if no date selected
function setDoppioDefaultDate() {
    const dateList = availableLayerDates.DOPPIO;
    if (dateList && dateList.length > 0) {
        const todayIso = moment().format('YYYY-MM-DD');
        let chosenIso = todayIso;
        if (!dateList.includes(todayIso)) {
            // Find nearest available date to today
            let minDiff = Infinity;
            let best = dateList[0];
            const today = moment(todayIso, 'YYYY-MM-DD');
            dateList.forEach(d => {
                const diff = Math.abs(moment(d, 'YYYY-MM-DD').diff(today, 'days'));
                if (diff < minDiff) {
                    minDiff = diff;
                    best = d;
                }
            });
            chosenIso = best;
        }
        const layerDateInput = document.getElementById('layer-date');
        // Set input value for display
        layerDateInput.value = moment(chosenIso).format('MM/DD/YYYY');
        // Set folder date attribute
        const year = chosenIso.slice(0, 4);
        const dayOfYear = moment(chosenIso, 'YYYY-MM-DD').dayOfYear().toString().padStart(3, '0');
        const folderDate = `${year}_${dayOfYear}`;
        layerDateInput.setAttribute('data-folder-date', folderDate);
        // Update global tileDate and layer paths
        updateLayerPaths(folderDate);
        // Trigger change event for timeline, etc.
        const event = new Event('change');
        layerDateInput.dispatchEvent(event);
        return folderDate;
    } else {
        showModal("No available dates for DOPPIO.");
        return null;
    }
}

// Add combined control via UI helper
addCombinedControl();

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
const setupCheckboxToggle = setupCheckboxToggleExternal;

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
        },
        'DOPPIO': {
            overlay: doppioOverlay,
            toggleId: 'doppio-toggle',
            legendId: 'doppio-legend'
        }
    };

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log('Is Safari:', isSafari);
  
    if (isChecked) {
        // Check if a layer date is selected
        if (!layerState.tileDate) {
            // Auto-select default date: today for DOPPIO, latest for others
            const newDate = layerType === 'DOPPIO'
                ? setDoppioDefaultDate()
                : setMostRecentLayerDate(layerType);
            if (!newDate) {
                document.getElementById(layerTypes[layerType].toggleId).checked = false;
                return;
            }
            // layerState.tileDate is now set, continue as normal
        }

        // Enforce exclusivity between groups
        if (layerType === 'DOPPIO') {
            deactivateFishbot();
        } else {
            deactivateForecast();
            deactivateFishbot();
        }

        // Deactivate other surface layers except the one being enabled
        if (['SST','OSTIA_SST','OSTIA_anomaly','SSS','CHL'].includes(layerType)) {
            deactivateOtherSurfaceLayers(layerType);
        } else {
            // If enabling DOPPIO, deactivate all surface layers
            deactivateOtherSurfaceLayers(null);
        }
        
        // Update layer paths before activating the layer
        updateLayerPaths(layerState.tileDate);
        
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
        controlsState.activeLayerType = layerType;
        createLegend(layerType, layerState.tileDate);
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
        if (controlsState.activeLayerType === layerType) {
            controlsState.activeLayerType = null;
        }
    }
}

// Setup layer toggles
setupCheckboxToggle(TOGGLE_IDS.SST, (event, checked) => toggleLayer('SST', event, checked));
setupCheckboxToggle(TOGGLE_IDS.OSTIA_SST, (event, checked) => toggleLayer('OSTIA_SST', event, checked));
setupCheckboxToggle(TOGGLE_IDS.OSTIA_anomaly, (event, checked) => toggleLayer('OSTIA_anomaly', event, checked));
setupCheckboxToggle(TOGGLE_IDS.SSS, (event, checked) => toggleLayer('SSS', event, checked));
setupCheckboxToggle(TOGGLE_IDS.CHL, (event, checked) => toggleLayer('CHL', event, checked));
setupCheckboxToggle(TOGGLE_IDS.DOPPIO, (event, checked) => toggleLayer('DOPPIO', event, checked));
setupCheckboxToggle(TOGGLE_IDS.BATHYMETRY, (event, checked) => {
    if (checked) {
        map.addLayer(bathymetryLayer);
    } else {
        map.removeLayer(bathymetryLayer);
    }
});

// Modify fishbot toggle callbacks
setupCheckboxToggle(TOGGLE_IDS.FISHBOT_TEMPERATURE, (event, checked) => {
    if (checked && !layerState.tileDate) {
        layerState.tileDate = setMostRecentFishbotDate();
        if (!layerState.tileDate) {
            document.getElementById(TOGGLE_IDS.FISHBOT_TEMPERATURE).checked = false;
            return;
        }
    }
    const toleranceSlider = document.getElementById('date-tolerance-slider');
    const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    toggleFishbotLayer(checked, layerState.tileDate, tolerance, 'temperature');
});

setupCheckboxToggle(TOGGLE_IDS.FISHBOT_OXYGEN, (event, checked) => {
    if (checked && !layerState.tileDate) {
        layerState.tileDate = setMostRecentFishbotDate();
        if (!layerState.tileDate) {
            document.getElementById(TOGGLE_IDS.FISHBOT_OXYGEN).checked = false;
            return;
        }
    }
    const toleranceSlider = document.getElementById('date-tolerance-slider');
    const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    toggleFishbotLayer(checked, layerState.tileDate, tolerance, 'oxygen');
});

setupCheckboxToggle(TOGGLE_IDS.FISHBOT_SALINITY, (event, checked) => {
    if (checked && !layerState.tileDate) {
        layerState.tileDate = setMostRecentFishbotDate();
        if (!layerState.tileDate) {
            document.getElementById(TOGGLE_IDS.FISHBOT_SALINITY).checked = false;
            return;
        }
    }
    const toleranceSlider = document.getElementById('date-tolerance-slider');
    const tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 2;
    toggleFishbotLayer(checked, layerState.tileDate, tolerance, 'salinity');
});

// Setup date tolerance slider via module
setupFishbotTolerance();

// Setup profile source toggles (auto-apply on change)
setupCheckboxToggle('emolt-toggle', () => applyProfileFilters());
setupCheckboxToggle('cccfa-toggle', () => applyProfileFilters());
setupCheckboxToggle('cfrf-toggle', () => applyProfileFilters());

// Initialize date pickers
$(function () {
    // Centralized date file paths
    const sstDatesPath = DATE_FILES.SST;
    const sssDatesPath = DATE_FILES.SSS;
    const chloroDatesPath = DATE_FILES.CHL;
    const ostiaSstDatesPath = DATE_FILES.OSTIA_SST;
    const ostiaAnomalyDatesPath = DATE_FILES.OSTIA_anomaly;
    const doppioDatesPath = DATE_FILES.DOPPIO;
    const fishbotDatesPath = DATE_FILES.fishbot;

    // Fetch available dates for highlighting
    Promise.all([
        fetchAvailableDates(sstDatesPath),
        fetchAvailableDates(sssDatesPath),
        fetchAvailableDates(chloroDatesPath),
        fetchAvailableDates(ostiaSstDatesPath),
        fetchAvailableDates(ostiaAnomalyDatesPath),
        fetchAvailableDates(doppioDatesPath),
        fetchAvailableDates(fishbotDatesPath),
    ])
    .then(([sstDates, sssDates, chloroDates, ostiaSstDates, ostiaAnomalyDates, doppioDates, fishbotDates]) => {
        const sstSet = new Set(sstDates);
        const sssSet = new Set(sssDates);
        const chloroSet = new Set(chloroDates);
        const ostiaSstSet = new Set(ostiaSstDates);
        const ostiaAnomalySet = new Set(ostiaAnomalyDates);
        const doppioSet = new Set(doppioDates);
        const fishbotSet = new Set(fishbotDates);
        const allDatesSet = new Set([...sstDates, ...sssDates, ...chloroDates, ...ostiaSstDates, ...doppioDates, ...ostiaAnomalyDates]);

        // Store available dates for each layer
        availableLayerDates.SST = sstDates;
        availableLayerDates.SSS = sssDates;
        availableLayerDates.CHL = chloroDates;
        availableLayerDates.OSTIA_SST = ostiaSstDates;
        availableLayerDates.OSTIA_anomaly = ostiaAnomalyDates;
        availableLayerDates.DOPPIO = doppioDates;
        availableLayerDates.fishbot = fishbotDates;

        // // Initialize the date range picker for profiles
        $('#daterange').daterangepicker({
            opens: 'right',  // Open aligned to the right side
            maxDate: moment().format("MM/DD/YYYY"),
            startDate: moment().subtract(14, 'days').format("MM/DD/YYYY"),
            endDate: moment().format("MM/DD/YYYY"),
            showDropdowns: true,  // Allow year/month dropdown selection
            autoApply: true,  // Apply the selection immediately
            ranges: {
                'Last 2 Weeks': [moment().subtract(14, 'days'), moment()],
                'Last 30 Days': [moment().subtract(30, 'days'), moment()],
                'Last 60 Days': [moment().subtract(60, 'days'), moment()],
                'Last 90 Days': [moment().subtract(90, 'days'), moment()],
                'All Available Data': ['08/01/2024', moment()]
            }
        }, function(start, end, label) {
            // Auto-apply when selection changes
            applyProfileFilters();
        });

        // Safety: also listen to apply event
        $('#daterange').on('apply.daterangepicker', function() {
            applyProfileFilters();
        });


        // Initialize the layer date picker
        $('#layer-date').daterangepicker({
            opens: 'left',
            maxDate: doppioDates[doppioDates.length - 1],
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

                if (doppioSet.has(formattedDate)) {
                    return 'highlight-doppio-only';
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

// Auto-apply filters: shared function
function applyProfileFilters() {
    const dateRange = $('#daterange').data('daterangepicker');
    const startDate = dateRange.startDate.format('YYYY-MM-DD');
    const endDate = dateRange.endDate.format('YYYY-MM-DD');

    const selectedSources = [];
    if (document.getElementById('emolt-toggle').checked) selectedSources.push('EMOLT');
    if (document.getElementById('cccfa-toggle').checked) selectedSources.push('cccfa_outer_cape');
    if (document.getElementById('cfrf-toggle').checked) selectedSources.push('shelf_research_fleet');

    // Clear legend
    const legendItems = document.getElementById('profile-legend-items');
    if (legendItems) legendItems.innerHTML = '';
    const legendContainer = document.getElementById('profile-legend-container');
    if (legendContainer) legendContainer.style.display = 'none';

    loadProfiles(startDate, endDate, selectedSources);
}

// activeLayerType is centralized in controlsState

// Initialize plots after controls are added
initializePlots();

// Styles moved to styles.css or ui.js. Runtime injection removed.

// Update the event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Initialize all collapsible sections via module
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
  
  // Initialize area selection behavior via module
  initAreaSelection();

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

    // Apply initial filter with all sources for the past two weeks
  setTimeout(() => {
    const emoltChecked = document.getElementById('emolt-toggle').checked;
    const cccfaChecked = document.getElementById('cccfa-toggle').checked;
    const cfrfChecked = document.getElementById('cfrf-toggle').checked;
    
        const initialSources = [];
        if (cccfaChecked) initialSources.push('cccfa_outer_cape');
        if (cfrfChecked) initialSources.push('shelf_research_fleet');
        if (emoltChecked) initialSources.push('EMOLT');
        
        const defaultStartDate = moment().subtract(14, 'days').format('YYYY-MM-DD');
        const defaultEndDate = moment().format('YYYY-MM-DD');
        loadProfiles(defaultStartDate, defaultEndDate, initialSources);
    }, 800);
});

// Initialize timeline when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeTimeline();
});