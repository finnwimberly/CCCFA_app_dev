// controls/fishbot-controls.js
import { layerState } from '../../state.js';
import { toggleFishbotLayer } from '../../gridded_products/fishbot.js';
import { FISHBOT, TOGGLE_IDS } from '../../config.js';

export function setupFishbotTolerance() {
  const slider = document.getElementById(FISHBOT.toleranceSliderId);
  if (!slider) return;
  slider.addEventListener('input', function(e) {
    const toleranceValue = parseInt(e.target.value);
    const label = document.getElementById(FISHBOT.toleranceValueId);
    if (label) label.textContent = toleranceValue;
    const fishbotToggles = [TOGGLE_IDS.FISHBOT_TEMPERATURE, TOGGLE_IDS.FISHBOT_OXYGEN, TOGGLE_IDS.FISHBOT_SALINITY];
    for (const toggleId of fishbotToggles) {
      const toggle = document.getElementById(toggleId);
      if (toggle && toggle.checked && layerState.tileDate) {
        const variableType = toggleId.replace('fishbot-', '').replace('-toggle', '');
        toggleFishbotLayer(true, layerState.tileDate, toleranceValue, variableType);
        break;
      }
    }
  });
  L.DomEvent.disableClickPropagation(slider);
  L.DomEvent.disableScrollPropagation(slider);
}


