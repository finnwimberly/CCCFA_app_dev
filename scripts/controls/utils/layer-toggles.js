// controls/layer-toggles.js
import { map } from '../../map/core.js';
import { controlsState, layerState } from '../../state.js';
import { createLegend } from '../../gridded_products/layers.js';
import { TOGGLE_IDS, LEGEND_IDS } from '../../config.js';

export function setupCheckboxToggle(id, onChangeCallback) {
  const checkbox = document.getElementById(id);
  if (!checkbox) return;
  const group = checkbox.closest('.checkbox-group');

  // Auto-sync .selected highlight on the row whenever .checked changes
  // (covers user taps, layer exclusivity code, error-handling resets, etc.)
  if (group) {
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
    Object.defineProperty(checkbox, 'checked', {
      get() { return desc.get.call(this); },
      set(val) { desc.set.call(this, val); group.classList.toggle('selected', val); }
    });
    group.classList.toggle('selected', checkbox.checked); // init pre-checked

    // Mobile: tap the row to toggle (checkbox is hidden via CSS)
    group.addEventListener('click', (e) => {
      if (window.innerWidth > 768 || e.target === checkbox) return;
      checkbox.checked = !checkbox.checked;
      onChangeCallback(null, checkbox.checked);
    });
  }

  // Desktop: shield checkbox from Leaflet's disableClickPropagation
  checkbox.addEventListener('mousedown', (e) => e.stopPropagation());
  checkbox.addEventListener('change', () => onChangeCallback(null, checkbox.checked));
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


