// controls/layer-toggles.js
import { map } from '../../map/core.js';
import { controlsState, layerState } from '../../state.js';
import { createLegend } from '../../gridded_products/layers.js';
import { TOGGLE_IDS, LEGEND_IDS } from '../../config.js';

export function setupCheckboxToggle(id, onChangeCallback) {
  const checkbox = document.getElementById(id);
  if (!checkbox) return;
  checkbox.addEventListener('change', (event) => {
    onChangeCallback(event, checkbox.checked);
  });
  checkbox.addEventListener('mousedown', (event) => {
    if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
      event.preventDefault();
      checkbox.checked = !checkbox.checked;
      onChangeCallback(event, checkbox.checked);
    }
  });
}

export function hideLegendFor(type) {
  const legendId = LEGEND_IDS[type];
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const el = document.getElementById(legendId);
  if (!el) return;
  if (isSafari) {
    el.style.display = 'none';
    el.style.visibility = 'hidden';
    el.style.opacity = '0';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
  } else {
    el.style.display = 'none';
  }
}

export function showLegendFor(type) {
  const legendId = LEGEND_IDS[type];
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const el = document.getElementById(legendId);
  if (!el) return;
  if (isSafari) {
    el.style.display = 'block';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    el.style.position = '';
    el.style.pointerEvents = '';
  } else {
    el.style.display = 'block';
  }
}


