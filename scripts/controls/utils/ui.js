// controls/ui.js
import { map } from '../../map/core.js';

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
                        value="${moment().subtract(14, 'days').format("MM/DD/YYYY")} - ${moment().format("MM/DD/YYYY")}" 
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
                            <input type="checkbox" id="emolt-toggle" name="source" value="EMOLT" checked>
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
                            <input type="checkbox" id="bathymetry-toggle">
                            <label for="bathymetry-toggle" class="control-label">Bathymetry</label>
                        </div>
                    </div>
                </div>
            </div>
                    <div class="control-item">
                        <div class="collapsible-header sub-header">
                        <label class="control-section-label">Forecasts:</label>
                        <i class="fas fa-chevron-down collapse-icon"></i>
                        </div>
                        <div class="collapsible-content" id="forecast-content">
                        <div class="forecast-variables">
                            <div class="checkbox-group">
                                <input type="checkbox" id="doppio-toggle">
                                <label for="doppio-toggle" class="control-label">Doppio</label>
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

      if (!document.getElementById('tolerance-overlay')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
      }

      return div;
    },
});

export function addCombinedControl() {
  map.addControl(new CombinedControl({ position: 'topleft' }));
  // One-time style injection for control panel specific tweaks 
  if (!document.getElementById('combined-control-inline-styles')) {
    const style = document.createElement('style');
    style.id = 'combined-control-inline-styles';
    style.textContent = `
      .leaflet-control.custom-control { background: white; padding: 8px; border-radius: 4px; box-shadow: 0 1px 5px rgba(0,0,0,0.2); margin: 8px; width: 280px; max-height: 80vh; overflow-y: auto; -webkit-user-select: none; user-select: none; }
      .control-section { margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
      .control-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
      .control-title { font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: var(--primary); text-align: center; }
      .control-section-label { font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 4px; display: block; }
      .control-item { margin-bottom: 6px; }
      .control-input { width: 100%; padding: 4px 6px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
      .checkbox-group { margin-bottom: 3px; display: flex; align-items: center; gap: 4px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
      .checkbox-group input[type="checkbox"]:focus { outline: none; box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25); }
      .control-label { font-size: 12px; color: var(--text-secondary); cursor: pointer; user-select: none; -webkit-user-select: none; }
      .collapsible-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 4px 0; -webkit-tap-highlight-color: transparent; }
      .sub-header { padding: 2px 0; }
      .collapse-icon { font-size: 12px; color: var(--text-secondary); transition: transform 0.2s ease; }
      .collapsible-header.collapsed .collapse-icon { transform: rotate(-90deg); }
      .collapsible-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; }
      .collapsible-content.expanded { max-height: 500px; }
      .control-button { width: 100%; padding: 6px 12px; margin-bottom: 6px; font-size: 12px; background-color: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s ease; -webkit-tap-highlight-color: transparent; }
      .control-button:last-child { margin-bottom: 0; }
      .control-button:hover { background-color: var(--accent); }
      .small-button { padding: 4px 8px; font-size: 11px; margin-top: 4px; }
      .leaflet-control.custom-control::-webkit-scrollbar { width: 6px; }
      .leaflet-control.custom-control::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
      .leaflet-control.custom-control::-webkit-scrollbar-thumb { background: #888; border-radius: 3px; }
      .leaflet-control.custom-control::-webkit-scrollbar-thumb:hover { background: #555; }
      @media (max-width: 768px) { .leaflet-control.custom-control { width: 240px; max-height: 70vh; } }
      @media (max-width: 480px) { .leaflet-control.custom-control { width: 200px; max-height: 60vh; } }
      .tolerance-slider { width: 100%; height: 6px; border-radius: 3px; background: #ddd; outline: none; opacity: 0.7; transition: opacity 0.2s; margin: 8px 0 4px 0; }
      .tolerance-slider:hover { opacity: 1; }
      .tolerance-slider::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; padding: 10px; border-radius: 50%; background: var(--secondary); cursor: pointer; }
      .tolerance-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: var(--secondary); cursor: pointer; border: none; }
      .slider-labels { display: flex; justify-content: space-between; font-size: 12px; padding: 0 5px; font-weight: 500; color: var(--text-secondary); margin-top: 2px; }
      .fishbot-variables { margin-bottom: 8px; }
      .tolerance-control { padding-top: 4px; }
      .tolerance-control .control-section-label { font-size: 12px; margin-bottom: 4px; }
    `;
    document.head.appendChild(style);
  }
}