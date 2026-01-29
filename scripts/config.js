// config.js
// Centralized constants and paths used across modules

// live version linked to web page
export const BASE_DATA_PATH = '../data';  

// symlink used to run locally and test prior to pushing
// export const BASE_DATA_PATH = '/data/processed_data'; 

// Daily date files
export const DATE_FILES = {
  SST: `${BASE_DATA_PATH}/SST/sst_dates.txt`,
  SSS: `${BASE_DATA_PATH}/SSS/sss_dates.txt`,
  CHL: `${BASE_DATA_PATH}/CHL/chl_dates.txt`,
  OSTIA_SST: `${BASE_DATA_PATH}/OSTIA_SST/sst_dates.txt`,
  OSTIA_anomaly: `${BASE_DATA_PATH}/OSTIA_anomaly/ssta_dates.txt`,
  DOPPIO: `${BASE_DATA_PATH}/doppio/doppio_dates.txt`,
  fishbot: `${BASE_DATA_PATH}/OSTIA_anomaly/ssta_dates.txt` // placeholder for highlight consistency
};

// Toggle element IDs per layer
export const TOGGLE_IDS = {
  SST: 'sst-toggle',
  OSTIA_SST: 'ostia-sst-toggle',
  OSTIA_anomaly: 'ostia-anomaly-toggle',
  SSS: 'sss-toggle',
  CHL: 'chl-toggle',
  DOPPIO: 'doppio-toggle',
  BATHYMETRY: 'bathymetry-toggle',
  FISHBOT_TEMPERATURE: 'fishbot-temperature-toggle',
  FISHBOT_SALINITY: 'fishbot-salinity-toggle',
  FISHBOT_OXYGEN: 'fishbot-oxygen-toggle'
};

// Legend element IDs per layer
export const LEGEND_IDS = {
  SST: 'sst-legend',
  OSTIA_SST: 'ostia-sst-legend',
  OSTIA_anomaly: 'ostia-anomaly-legend',
  SSS: 'sss-legend',
  CHL: 'chl-legend',
  DOPPIO: 'doppio-legend'
};

// Fishbot controls
export const FISHBOT = {
  toleranceSliderId: 'date-tolerance-slider',
  toleranceValueId: 'tolerance-value',
  infoIconId: 'tolerance-info-icon',
};

// Profile filters
export const PROFILE_FILTERS = {
  emoltId: 'emolt-toggle',
  cccfaId: 'cccfa-toggle',
  cfrfId: 'cfrf-toggle',
  applyButtonId: 'apply-filters',
  dateRangeId: 'daterange'
};

// Timeline / layer date input
export const LAYER_DATE_INPUT_ID = 'layer-date';


// Profile data
export const PROFILE_DATA = {
  CTD_METADATA: `${BASE_DATA_PATH}/CTD_profiles/metadata.csv`,
  EMOLT_METADATA: `${BASE_DATA_PATH}/EMOLT/metadata.csv`,
  CTD_MEASUREMENTS_DIR: `${BASE_DATA_PATH}/CTD_profiles`,
  EMOLT_MEASUREMENTS_DIR: `${BASE_DATA_PATH}/EMOLT`
};

// FishBot data 
export const FISHBOT_DATA = {
  BASE: `${BASE_DATA_PATH}/FIShBOT`,
  CSV: `${BASE_DATA_PATH}/FIShBOT/fishbot.csv`,
  COLORMAPS: {
    temperature: `${BASE_DATA_PATH}/FIShBOT/thermal_colormap.txt`,
    oxygen: `${BASE_DATA_PATH}/FIShBOT/oxy_colormap.txt`,
    salinity: `${BASE_DATA_PATH}/FIShBOT/haline_colormap.txt`
  }
};

// Centralized paths for map tiles, ranges, colormaps, and bathymetry
export function getTilePath(layerType, date) {
  const base = BASE_DATA_PATH;
  switch (layerType) {
    case 'SST':
      return `${base}/SST/tiles/${date}/{z}/{x}/{y}.png`;
    case 'SSS':
      return `${base}/SSS/tiles_mirrored/${date}/{z}/{x}/{y}.png`;
    case 'CHL':
      return `${base}/CHL/tiles/${date}/{z}/{x}/{y}.png`;
    case 'OSTIA_SST':
      return `${base}/OSTIA_SST/tiles/${date}/{z}/{x}/{y}.png`;
    case 'OSTIA_anomaly':
      return `${base}/OSTIA_anomaly/tiles/${date}/{z}/{x}/{y}.png`;
    case 'DOPPIO':
      return `${base}/doppio/tiles/${date}/{z}/{x}/{y}.png`;
    default:
      return null;
  }
}

export function getRangePath(layerType, date, isLocal = true) {
  const base = BASE_DATA_PATH;
  switch (layerType) {
    case 'SST':
      return `${base}/SST/tiles/${date}/sst_range_${isLocal ? 'local' : 'global'}.json`;
    case 'SSS':
      return `${base}/SSS/tiles_mirrored/${date}/sss_range_${isLocal ? 'local' : 'global'}.json`;
    case 'CHL':
      return `${base}/CHL/tiles/${date}/chl_range_${isLocal ? 'local' : 'global'}.json`;
    case 'OSTIA_SST':
      return `${base}/OSTIA_SST/tiles/${date}/sst_range_${isLocal ? 'local' : 'global'}.json`;
    case 'OSTIA_anomaly':
      return `${base}/OSTIA_anomaly/tiles/${date}/ssta_range_${isLocal ? 'local' : 'global'}.json`;
    default:
      return null;
  }
}

export function getColormapPath(layerType) {
  const base = BASE_DATA_PATH;
  switch (layerType) {
    case 'SST':
      return `${base}/SST/thermal_colormap.txt`;
    case 'SSS':
      return `${base}/SSS/thermal_colormap.txt`;
    case 'CHL':
      return `${base}/CHL/thermal_colormap.txt`;
    case 'OSTIA_SST':
      return `${base}/OSTIA_SST/thermal_colormap.txt`;
    case 'OSTIA_anomaly':
      return `${base}/OSTIA_anomaly/thermal_colormap.txt`;
    case 'DOPPIO':
      return `${base}/doppio/doppio_colormap_winter.txt`;
    default:
      return null;
  }
}

export const BATHYMETRY_TILES = {
  metric: `${BASE_DATA_PATH}/bathymetry_tiles_m/{z}/{x}/{y}.png`,
  imperial: `${BASE_DATA_PATH}/bathymetry_tiles/{z}/{x}/{y}.png`
};

