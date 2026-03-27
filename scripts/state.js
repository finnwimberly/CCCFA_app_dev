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

// Simple pub/sub for cross-module events (avoids window coupling and load-order issues)
const _listeners = {};

export function on(event, callback) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(callback);
}

export function emit(event, data) {
    if (_listeners[event]) {
        _listeners[event].forEach(cb => cb(data));
    }
}