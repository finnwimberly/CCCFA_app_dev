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
      return `${base}/SSS/tiles/${date}/{z}/{x}/{y}.png`;
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

// Zoom threshold where tiles switch from global to local color scale
export const ZOOM_THRESHOLD = 8;

// Seasonal color-scale limits (NOAA fisheries calendar quarters)
// winter: Jan–Mar, spring: Apr–Jun, summer: Jul–Sep, fall: Oct–Dec
// Global limits used for zoom 0 – (ZOOM_THRESHOLD-1)
export const SEASONAL_LIMITS_GLOBAL = {
  SST:           { winter: [0, 24],      spring: [4, 26],     summer: [10, 28],    fall: [4, 26]    },
  OSTIA_SST:     { winter: [0, 24],      spring: [4, 26],     summer: [10, 28],    fall: [4, 26]    },
  OSTIA_anomaly: { winter: [-4, 4],      spring: [-3, 3],     summer: [-3, 3],     fall: [-4, 4]    },
  SSS:           { winter: [30, 37],     spring: [28, 37],    summer: [29, 37],    fall: [30, 37]   },
  CHL:           { winter: [0.05, 3.0],  spring: [0.1, 6.0],  summer: [0.05, 5.5], fall: [0.05, 5.0]},
  DOPPIO:        { winter: [0, 12],      spring: [2, 16],     summer: [6, 20],     fall: [2, 16]    },
};

// Local (Cape Cod) limits used for zoom ZOOM_THRESHOLD+
export const SEASONAL_LIMITS_LOCAL = {
  SST:           { winter: [0, 16],      spring: [4, 20],     summer: [10, 22],    fall: [4, 24]    },
  OSTIA_SST:     { winter: [0, 16],      spring: [4, 20],     summer: [10, 22],    fall: [4, 24]    },
  OSTIA_anomaly: { winter: [-2, 2],      spring: [-2.5, 2.5], summer: [-3, 3],     fall: [-2.5, 2.5]},
  SSS:           { winter: [30, 34],     spring: [28, 33],    summer: [29, 35],    fall: [30, 35]   },
  CHL:           { winter: [0.05, 2.0],  spring: [0.1, 5.0],  summer: [0.05, 4.0], fall: [0.05, 4.0]},
  DOPPIO:        { winter: [0, 12],      spring: [2, 16],     summer: [6, 20],     fall: [2, 16]    },
};

// Returns 'winter' | 'spring' | 'summer' | 'fall'
// Accepts YYYYMMDD (8-digit), YYYY_DDD (folder format), or YYYYDDD (7-digit DOY)
export function getSeasonFromDate(dateStr) {
  if (!dateStr) {
    const m = new Date().getMonth() + 1;
    return _seasonFromMonth(m);
  }

  // YYYY_DDD  (e.g. "2025_182")
  if (/^\d{4}_\d{1,3}$/.test(dateStr)) {
    const [y, doy] = dateStr.split('_');
    const d = new Date(parseInt(y, 10), 0, 1);
    d.setDate(d.getDate() + parseInt(doy, 10) - 1);
    return _seasonFromMonth(d.getMonth() + 1);
  }

  // YYYYMMDD  (e.g. "20250712")
  if (/^\d{8}$/.test(dateStr)) {
    return _seasonFromMonth(parseInt(dateStr.slice(4, 6), 10));
  }

  // YYYYDDD   (e.g. "2025182")
  if (/^\d{7}$/.test(dateStr)) {
    const y = parseInt(dateStr.slice(0, 4), 10);
    const doy = parseInt(dateStr.slice(4), 10);
    const d = new Date(y, 0, 1);
    d.setDate(d.getDate() + doy - 1);
    return _seasonFromMonth(d.getMonth() + 1);
  }

  // Fallback: use today's month
  const m = new Date().getMonth() + 1;
  return _seasonFromMonth(m);
}

function _seasonFromMonth(month) {
  if (month <= 3)  return 'winter';
  if (month <= 6)  return 'spring';
  if (month <= 9)  return 'summer';
  return 'fall';
}

export function getColormapPath(layerType, date = null) {
  const base = BASE_DATA_PATH;
  const season = date ? getSeasonFromDate(date) : 'winter';
  switch (layerType) {
    case 'SST':
      return `${base}/SST/colormaps/sst_colormap_${season}.txt`;
    case 'SSS':
      return `${base}/SSS/colormaps/sss_colormap_${season}.txt`;
    case 'CHL':
      return `${base}/CHL/colormaps/chl_colormap_${season}.txt`;
    case 'OSTIA_SST':
      return `${base}/OSTIA_SST/colormaps/sst_colormap_${season}.txt`;
    case 'OSTIA_anomaly':
      return `${base}/OSTIA_anomaly/colormaps/ssta_colormap_${season}.txt`;
    case 'DOPPIO':
      return `${base}/doppio/colormaps/doppio_colormap_${season}.txt`;
    default:
      return null;
  }
}

export const BATHYMETRY_TILES = {
  metric: `${BASE_DATA_PATH}/bathymetry_tiles_m/{z}/{x}/{y}.png`,
  imperial: `${BASE_DATA_PATH}/bathymetry_tiles/{z}/{x}/{y}.png`
};

