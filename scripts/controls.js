import { map } from './map-setup.js';
import { sstOverlay, sssOverlay, chlOverlay, bathymetryLayer, updateLayerPaths, tileDate, createLegend } from './layers.js';
import { initializePlots, removeCTDMeasurements } from './plots.js';
import { loadProfiles, selectProfileSilently, createEmoltIcon } from './map.js';
import { loadProfilesMetadata } from './data-loading.js';
import { state } from './state.js';

// Filter Profiles Control - Combines date range and source filtering
const FilterProfilesControl = L.Control.extend({
    onAdd: function () {
      const div = L.DomUtil.create('div', 'leaflet-control custom-control filter-control');
      div.innerHTML = `
        <div class="control-container">
            <h3 class="control-title">Filter Profiles</h3>
            <div class="control-item">
                <label class="control-section-label">Date range:</label>
                <div style="position: relative;">
                    <input type="text" id="daterange" name="daterange" 
                        value="08/01/2024 - ${moment().format("MM/DD/YYYY")}" 
                        class="control-input" />
                    <i id="reset-daterange" class="fas fa-undo" style="position: absolute; bottom: 3px; right: 5px; cursor: pointer; font-size: 14px; color: #007bff;" title="Reset to default date range"></i>
                </div>
            </div>
            <div class="control-item">
                <div class="collapsible-header">
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
      `;
      return div;
    },
  });

// Layer Selection Control - For selecting layer date and layer types
const LayerControlPanel = L.Control.extend({
    onAdd: function () {
      const div = L.DomUtil.create('div', 'leaflet-control custom-control layer-panel-control');
      div.innerHTML = `
        <div class="control-container">
            <h3 class="control-title">Layer Control
                <i id="info-icon" class="fas fa-info-circle" title="Info"></i>
            </h3>
            <div class="control-item">
                <label class="control-section-label">Layer date:</label>
                <input type="text" id="layer-date" name="layer-date" 
                    value="${moment().format("MM/DD/YYYY")}" 
                    class="control-input" />
            </div>
            <div class="control-item layer-toggles">
                <div class="collapsible-header">
                    <label class="control-section-label">Layers:</label>
                    <i class="fas fa-chevron-down collapse-icon"></i>
                </div>
                <div class="collapsible-content" id="layers-content">
                    <div class="layer-grid">
                        <div class="checkbox-group">
                            <input type="checkbox" id="sst-toggle">
                            <label for="sst-toggle" class="control-label">SST</label>
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
                            <input type="checkbox" id="bathymetry-toggle">
                            <label for="bathymetry-toggle" class="control-label">Bathymetry</label>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
      return div;
    },
});

// Add the filter profiles control
map.addControl(new FilterProfilesControl({ position: 'topright' }));

// Add the layer control panel
map.addControl(new LayerControlPanel({ position: 'topright' }));

// Add Select by Area control
const SelectByAreaControl = L.Control.extend({
  onAdd: function () {
    const div = L.DomUtil.create('div', 'leaflet-control custom-control');
    div.innerHTML = `
      <div class="control-container">
        <button class="control-button select-button">Select Profiles by Area</button>
      </div>
    `;
    
    const button = div.querySelector('.select-button');
    button.style.width = '100%';
    button.style.cursor = 'pointer';
    button.style.transition = 'background 0.3s ease';

    // Add hover effect using JavaScript events
    button.addEventListener('mouseenter', function () {
      button.style.background = '#f0f0f0';
    });

    button.addEventListener('mouseleave', function () {
      button.style.background = 'white';
    });

    let drawingPolygon = false;
    let polygon = null;
    let points = [];
    let tempLine = null;
    
    L.DomEvent.on(button, 'click', function () {
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
        button.textContent = 'Confirm Selection';
        // Keep button white during selection
        button.style.background = 'white';
        points = [];
        
        // Disable map interactions to avoid conflicts
        map.dragging.disable();
        map.doubleClickZoom.disable();
        
        map.on('click', handleMapClick);
        map.on('mousemove', handleMouseMove);
      }
    });
    
    function handleMapClick(e) {
      // Add point to polygon
      points.push(e.latlng);
      
      // Update visual representation
      updatePolygonDisplay();
    }
    
    function handleMouseMove(e) {
      if (points.length > 0) {
        // Update temporary line
        if (tempLine) {
          map.removeLayer(tempLine);
        }
        
        const tempPoints = [...points, e.latlng];
        tempLine = L.polyline(tempPoints, {color: 'red', weight: 2, dashArray: '5, 5'}).addTo(map);
      }
    }
    
    function updatePolygonDisplay() {
      // Remove old polygon
      if (polygon) {
        map.removeLayer(polygon);
      }
      
      // Create new polygon
      polygon = L.polygon(points, {color: 'red', weight: 2, fillOpacity: 0.2}).addTo(map);
    }
    
    function finishPolygon() {
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
      button.textContent = 'Selection Complete';
      button.style.background = '#90EE90'; // Light green for confirmation
      
      // Reset button after a brief delay
      setTimeout(() => {
        button.textContent = 'Select by Area';
        button.style.background = 'white';
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

    // Prevent map click events when clicking the button
    L.DomEvent.disableClickPropagation(div);

    return div;
  },
});

map.addControl(new SelectByAreaControl({ position: 'topright' }));

// Add Deselect All Profiles control
const DeselectControl = L.Control.extend({
  onAdd: function () {
    const div = L.DomUtil.create('div', 'leaflet-control custom-control');
    div.innerHTML = `
      <div class="control-container">
        <button class="control-button">Deselect All Profiles</button>
      </div>
    `;
    
    const button = div.querySelector('.control-button');
    button.style.width = '100%';
    button.style.cursor = 'pointer';
    button.style.transition = 'background 0.3s ease';

    // Add hover effect using JavaScript events
    button.addEventListener('mouseenter', function () {
      button.style.background = '#f0f0f0'; // Slightly darker white/gray
    });

    button.addEventListener('mouseleave', function () {
      button.style.background = 'white'; // Restore to original white
    });

    L.DomEvent.on(button, 'click', function () {
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

    // Prevent map click events when clicking the button
    L.DomEvent.disableClickPropagation(div);

    return div;
  },
});

map.addControl(new DeselectControl({ position: 'topright' }));

// Create info modal
const infoModal = `
  <div id="info-overlay"></div>
  <div id="info-modal">
    <span id="info-modal-close">&times;</span>
    <h4>Layer Selection Color Scheme</h4>
    <p class="modal-subtitle">
      In order to view Sea Surface Temperature (SST), Sea Surface Salinity (SSS), or Chlorophyll-a (Chloro) data, select a date for which data is available. The color of the date corresponds to the data available for that date as follows:
    </p>
    <ul>
      <li><span class="color-block highlight-all">Green</span> SST, SSS, and Chloro available</li>
      <li><span class="color-block highlight-chloro-sst">Purple</span> SST and Chloro available</li>
      <li><span class="color-block highlight-chloro-sss">Yellow</span> SSS and Chloro available</li>
      <li><span class="color-block highlight-sst-only">Blue</span> Only SST available</li>
      <li><span class="color-block highlight-chloro-only">Gray</span> Only Chloro available</li>
    </ul>
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

// Define showModal function before it's used
function showModal(message) {
  // Create modal overlay and content if they don't exist
  if (!document.getElementById('message-overlay')) {
    const modalHTML = `
      <div id="message-overlay" class="modal-overlay"></div>
      <div id="message-modal" class="modal-dialog">
        <div class="modal-content">
          <span id="message-modal-close" class="modal-close">&times;</span>
          <p id="modal-message"></p>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listeners for the close button and overlay
    document.getElementById('message-modal-close').addEventListener('click', () => {
      document.getElementById('message-overlay').style.display = 'none';
      document.getElementById('message-modal').style.display = 'none';
    });
    
    document.getElementById('message-overlay').addEventListener('click', () => {
      document.getElementById('message-overlay').style.display = 'none';
      document.getElementById('message-modal').style.display = 'none';
    });
  }
  
  // Set the message and display the modal
  document.getElementById('modal-message').textContent = message;
  document.getElementById('message-overlay').style.display = 'block';
  document.getElementById('message-modal').style.display = 'block';
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

$(function () {
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
      const sstSet = new Set(sstDates);
      const sssSet = new Set(sssDates);
      const chloroSet = new Set(chloroDates);
      const allDatesSet = new Set([...sstDates, ...sssDates, ...chloroDates]);

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
      
      // Force the daterangepicker to open showing the end date (current month) first
      const originalOpen = $.fn.daterangepicker.prototype.show;
      $.fn.daterangepicker.prototype.show = function() {
          originalOpen.apply(this, arguments);
          
          // When opened, immediately switch to show the right calendar (end date)
          if (this.rightCalendar && this.endDate) {
              this.rightCalendar.month = moment(this.endDate).clone();
              this.updateCalendars();
              this.container.find('.drp-calendar.right').show();
              this.container.find('.drp-calendar.left').hide();
          }
      };
      
      // Add event listener for reset date range button
      document.getElementById('reset-daterange').addEventListener('click', function() {
          const dateRange = $('#daterange').data('daterangepicker');
          // Keep the MM/DD/YYYY format for display in the input field
          dateRange.setStartDate('08/01/2024');
          dateRange.setEndDate(moment().format("MM/DD/YYYY"));
          $('#daterange').val(`08/01/2024 - ${moment().format("MM/DD/YYYY")}`);
          
          // Note: This only updates the display, not the actual filter
          // User still needs to click "Apply Filters" to update the map
      });

      // Initialize the layer date picker
      $('#layer-date').daterangepicker({
              opens: 'left',
              maxDate: moment().format("MM/DD/YYYY"),
          singleDatePicker: true,
              isInvalidDate: function (date) {
                  const formattedDate = date.format('YYYY-MM-DD');
                  return !allDatesSet.has(formattedDate);
              },
              isCustomDate: function (date) {
                  const formattedDate = date.format('YYYY-MM-DD');

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
              
              return ''; // No highlight
          }
      }, function(date) {
          // Layer date selection callback
          const year = date.year();
          const dayOfYear = date.dayOfYear().toString().padStart(3, '0');
          const layerDate = `${year}_${dayOfYear}`;
          updateLayerPaths(layerDate);
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
          
          // Call loadProfiles with date range and sources
          loadProfiles(startDate, endDate, selectedSources);
      });
  })
  .catch(error => console.error('Error loading available dates:', error));
});

let activeLayerType = null; // Track the currently active layer

// Layer toggle functionality - refactored to use a single function
function toggleLayer(layerType) {
  // Define the layer types and their corresponding elements
  const layerTypes = {
    'SST': {
      overlay: sstOverlay,
      toggleId: 'sst-toggle',
      legendId: 'sst-legend'
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
  
  // Get the toggle element that triggered the event
  const activeToggle = document.getElementById(layerTypes[layerType].toggleId);
  
  if (activeToggle.checked) {
    // Deactivate other layer types
    Object.keys(layerTypes).forEach(type => {
      if (type !== layerType) {
        const toggle = document.getElementById(layerTypes[type].toggleId);
        if (toggle.checked) {
          toggle.checked = false;
          map.removeLayer(layerTypes[type].overlay);
          document.getElementById(layerTypes[type].legendId).style.display = 'none';
          if (activeLayerType === type) {
            activeLayerType = null;
          }
        }
      }
    });
    
    // Activate selected layer
    map.addLayer(layerTypes[layerType].overlay);
    document.getElementById(layerTypes[layerType].legendId).style.display = 'block';
    activeLayerType = layerType;
    createLegend(layerType, tileDate);
  } else {
    // Deactivate selected layer
    map.removeLayer(layerTypes[layerType].overlay);
    document.getElementById(layerTypes[layerType].legendId).style.display = 'none';
    if (activeLayerType === layerType) {
      activeLayerType = null;
    }
  }
}

// SST toggle listener
document.getElementById('sst-toggle').addEventListener('change', () => toggleLayer('SST'));

// SSS toggle listener
document.getElementById('sss-toggle').addEventListener('change', () => toggleLayer('SSS'));

// CHL toggle listener
document.getElementById('chl-toggle').addEventListener('change', () => toggleLayer('CHL'));

// Bathymetry toggle listener 
document.getElementById('bathymetry-toggle').addEventListener('change', (event) => {
  if (event.target.checked) {
    map.addLayer(bathymetryLayer);
  } else {
    map.removeLayer(bathymetryLayer);
  }
});

// Initialize plots after controls are added
initializePlots();

// Setup collapsible sections
document.addEventListener('DOMContentLoaded', function() {
  // Explicitly ensure eMOLT checkbox is unchecked on page load
  const emoltToggle = document.getElementById('emolt-toggle');
  if (emoltToggle) {
    emoltToggle.checked = false;
  }
  
  // Function to initialize all collapsible sections
  function setupCollapsibles() {
    const headers = document.querySelectorAll('.collapsible-header');
    
    headers.forEach(header => {
      const icon = header.querySelector('.collapse-icon');
      const contentId = header.nextElementSibling.id;
      const content = document.getElementById(contentId);
      
      // Start with content expanded
      content.classList.add('expanded');
      
      // Add click event
      header.addEventListener('click', function() {
        // Toggle icon rotation
        icon.classList.toggle('collapsed');
        
        // Toggle content visibility
        content.classList.toggle('expanded');
      });
    });
  }
  
  // Initialize on page load
  setupCollapsibles();
  
  // Also initialize when profiles are loaded or map refreshes
  // This may be needed if controls are recreated
  document.addEventListener('profiles-loaded', setupCollapsibles);
  
  // Apply initial filter with only the checked sources (EMOLT should be unchecked by default)
  // Use a slightly longer timeout to ensure DOM is fully loaded and checkbox states are correct
  setTimeout(() => {
    // Get the current state of each checkbox
    const emoltChecked = document.getElementById('emolt-toggle').checked;
    const cccfaChecked = document.getElementById('cccfa-toggle').checked;
    const cfrfChecked = document.getElementById('cfrf-toggle').checked;
    
    console.log('Initial checkbox states:', {
      emolt: emoltChecked,
      cccfa: cccfaChecked,
      cfrf: cfrfChecked
    });
    
    // Build the sources array based on actual checkbox states
    const initialSources = [];
    if (cccfaChecked) {
      initialSources.push('cccfa_outer_cape');
    }
    if (cfrfChecked) {
      initialSources.push('shelf_research_fleet');
    }
    if (emoltChecked) {
      initialSources.push('EMOLT');
    }
    
    console.log('Loading profiles with sources:', initialSources);
    
    // Call loadProfiles with default date range and selected sources
    // Use ISO format (YYYY-MM-DD) for consistent date handling
    const defaultStartDate = '2024-08-01'; // Changed from MM/DD/YYYY to YYYY-MM-DD format
    const defaultEndDate = moment().format('YYYY-MM-DD'); // Ensure ISO format
    loadProfiles(defaultStartDate, defaultEndDate, initialSources);
  }, 800); // Increased timeout to ensure DOM is fully loaded
});

export { activeLayerType };