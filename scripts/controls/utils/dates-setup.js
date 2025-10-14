// controls/dates-setup.js
import { DATE_FILES, LAYER_DATE_INPUT_ID } from '../../config.js';
import { controlsState } from '../../state.js';
import { updateLayerPaths } from '../../gridded_products/layers.js';

async function fetchDatesFile(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) return [];
    const text = await response.text();
    return text.trim().split('\n').filter(line => line.trim() && /^\d{4}\d{3}$/.test(line.trim()));
  } catch {
    return [];
  }
}

export async function loadAvailableDates() {
  const results = await Promise.all([
    fetchDatesFile(DATE_FILES.SST),
    fetchDatesFile(DATE_FILES.SSS),
    fetchDatesFile(DATE_FILES.CHL),
    fetchDatesFile(DATE_FILES.OSTIA_SST),
    fetchDatesFile(DATE_FILES.DOPPIO),
    fetchDatesFile(DATE_FILES.OSTIA_anomaly)
  ]);
  // Not used directly here; timeline builds on its own
  return results;
}

export function setupLayerDatePicker(maxIsoDate) {
  $('#'+LAYER_DATE_INPUT_ID).daterangepicker({
    opens: 'left',
    maxDate: maxIsoDate,
    singleDatePicker: true,
    autoApply: false,
    autoUpdateInput: false,
    showDropdowns: true,
  });

  $('#'+LAYER_DATE_INPUT_ID).on('apply.daterangepicker', function(ev, picker) {
    const date = picker.startDate;
    const year = date.year();
    const dayOfYear = date.dayOfYear().toString().padStart(3, '0');
    const layerDate = `${year}_${dayOfYear}`;
    const input = document.getElementById(LAYER_DATE_INPUT_ID);
    input.value = date.format('MM/DD/YYYY');
    input.setAttribute('data-folder-date', layerDate);
    updateLayerPaths(layerDate);
    const event = new Event('change');
    input.dispatchEvent(event);
  });
}


