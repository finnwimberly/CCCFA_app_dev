// controls/layer-toggles.js
import { map } from '../../map/core.js';
import { controlsState, layerState } from '../../state.js';
import { createLegend } from '../../gridded_products/layers.js';
import { TOGGLE_IDS, LEGEND_IDS } from '../../config.js';

export function setupCheckboxToggle(id, onChangeCallback) {
  const checkbox = document.getElementById(id);
  if (!checkbox) return;

  // Prevent mousedown/touchstart from bubbling up to Leaflet's
  // disableClickPropagation handler on the parent control element.
  // This preserves native checkbox toggle behavior on all platforms
  // (replaces the old Safari mousedown workaround that caused
  // double-toggles on mobile touch devices).
  checkbox.addEventListener('mousedown', (e) => e.stopPropagation());
  checkbox.addEventListener('touchstart', (e) => e.stopPropagation());

  // Native 'change' event — fires exactly once per toggle
  checkbox.addEventListener('change', () => {
    onChangeCallback(null, checkbox.checked);
  });

  // Also protect the associated <label> — clicking it triggers
  // the linked checkbox, so its events must also be shielded.
  const label = checkbox.parentElement?.querySelector(`label[for="${id}"]`);
  if (label) {
    label.addEventListener('mousedown', (e) => e.stopPropagation());
    label.addEventListener('touchstart', (e) => e.stopPropagation());
  }
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


