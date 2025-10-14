// state.js
export const state = {
    markers: {},
    selectedProfiles: {},
    colorIndex: 0
};

// Centralized shared layer/timeline controls state to avoid circular imports
export const layerState = { tileDate: null };

export const controlsState = {
    activeLayerType: null,
    availableLayerDates: {
        SST: [],
        SSS: [],
        CHL: [],
        OSTIA_SST: [],
        OSTIA_anomaly: [],
        DOPPIO: [],
        fishbot: []
    }
};