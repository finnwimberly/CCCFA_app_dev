// controls/area-select.js
import { map } from '../../map/core.js';
import { state } from '../../state.js';
import { loadProfilesMetadata } from '../../profiles_and_plots/data-loading.js';
import { selectProfileSilently, createEmoltIcon, showModal } from '../../map/profiles.js';

let drawingPolygon = false;
let polygon = null;
let points = [];
let tempLine = null;
let startMarker = null;
let hintEl = null;
let clickTimeout = null;

const CLOSE_RADIUS = 15; // pixels — how close to first point triggers close

export function initAreaSelection() {
  const selectButton = document.querySelector('.select-button');
  if (!selectButton) return;
  selectButton.addEventListener('click', function(e) {
    e.stopPropagation();
    if (drawingPolygon) {
      if (points.length >= 3) finishPolygon(); else showModal("Please add at least 3 points to create a selection area.");
    } else {
      startDrawing(selectButton);
    }
  });
}

function startDrawing(button) {
  drawingPolygon = true;
  points = [];
  button.textContent = 'Cancel Drawing';
  button.style.backgroundColor = '#c0392b';
  map.dragging.disable();
  map.doubleClickZoom.disable();
  map.getContainer().classList.add('drawing-mode');
  showHint('Click to add points. Double-click or click first point to finish. Right-click to undo. Esc to cancel.');
  map.on('click', handleMapClick);
  map.on('mousemove', handleMouseMove);
  map.on('contextmenu', handleRightClick);
  document.addEventListener('keydown', handleEscape);
}

function handleMapClick(e) {
  if (!drawingPolygon) return;

  // Debounce: ignore click if it's part of a double-click
  if (clickTimeout) clearTimeout(clickTimeout);
  clickTimeout = setTimeout(() => {
    processClick(e);
  }, 200);
}

function processClick(e) {
  // Check if clicking near first point to close
  if (points.length >= 3) {
    const firstPt = map.latLngToContainerPoint(points[0]);
    const clickPt = map.latLngToContainerPoint(e.latlng);
    if (firstPt.distanceTo(clickPt) < CLOSE_RADIUS) {
      finishPolygon();
      return;
    }
  }

  points.push(e.latlng);

  // Place start marker on first point
  if (points.length === 1) {
    startMarker = L.circleMarker(e.latlng, {
      radius: 7, color: 'red', fillColor: 'white', fillOpacity: 1, weight: 2
    }).addTo(map);
  }

  updatePolygonDisplay();
}

function handleMouseMove(e) {
  if (!drawingPolygon || points.length === 0) return;
  if (tempLine) map.removeLayer(tempLine);
  // Show line from last point through cursor back to first point
  const tempPoints = points.length >= 3
    ? [...points, e.latlng, points[0]]
    : [...points, e.latlng];
  tempLine = L.polyline(tempPoints, {color: 'red', weight: 2, dashArray: '5, 5'}).addTo(map);
}

function handleRightClick(e) {
  L.DomEvent.preventDefault(e);
  if (!drawingPolygon || points.length === 0) return;
  points.pop();
  if (points.length === 0 && startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (polygon) { map.removeLayer(polygon); polygon = null; }
  if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
  if (points.length >= 2) updatePolygonDisplay();
}

function handleEscape(e) {
  if (e.key === 'Escape' && drawingPolygon) cancelDrawing();
}

function updatePolygonDisplay() {
  if (points.length < 2) return;
  if (polygon) map.removeLayer(polygon);
  polygon = L.polygon(points, {color: 'red', weight: 2, fillOpacity: 0.2}).addTo(map);
}

function showHint(text) {
  removeHint();
  hintEl = document.createElement('div');
  hintEl.className = 'drawing-hint';
  hintEl.textContent = text;
  map.getContainer().appendChild(hintEl);
}

function removeHint() {
  if (hintEl) { hintEl.remove(); hintEl = null; }
}

function cleanup() {
  drawingPolygon = false;
  if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
  if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  removeHint();
  map.getContainer().classList.remove('drawing-mode');
  map.dragging.enable();
  map.doubleClickZoom.enable();
  map.off('click', handleMapClick);
  map.off('mousemove', handleMouseMove);
  map.off('contextmenu', handleRightClick);
  document.removeEventListener('keydown', handleEscape);

  const button = document.querySelector('.select-button');
  if (button) { button.textContent = 'Select Profiles by Area'; button.style.backgroundColor = ''; }
}

function cancelDrawing() {
  if (polygon) { map.removeLayer(polygon); polygon = null; }
  points = [];
  cleanup();
}

function finishPolygon() {
  if (points.length < 3) return;
  if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
  if (polygon) map.removeLayer(polygon);
  polygon = L.polygon(points, {color: 'red', fillOpacity: 0.2}).addTo(map);
  selectProfilesInPolygon(polygon);

  const button = document.querySelector('.select-button');
  if (button) { button.textContent = 'Selection Complete'; button.style.backgroundColor = '#2E8B57'; }

  cleanup();

  // Reset button text after brief feedback
  setTimeout(() => {
    const btn = document.querySelector('.select-button');
    if (btn) { btn.textContent = 'Select Profiles by Area'; btn.style.backgroundColor = ''; }
  }, 1000);

  // Remove polygon overlay after brief display
  setTimeout(() => { if (polygon) { map.removeLayer(polygon); polygon = null; } }, 1500);
  points = [];
}

function selectProfilesInPolygon(poly) {
  const profilesInArea = [];
  Object.entries(state.markers).forEach(([id, markerInfo]) => {
    if (state.selectedProfiles[id]) return;
    const marker = markerInfo.marker;
    const latLng = marker.getLatLng();
    if (isMarkerInsidePolygon(latLng, poly)) {
      profilesInArea.push({ id, marker, dataType: markerInfo.dataType });
    }
  });
  const currentSelectionCount = Object.keys(state.selectedProfiles).length;
  if (currentSelectionCount + profilesInArea.length > 30) { showModal("Total selected profiles is capped at 30. Try reducing the date range or selecting a smaller area."); return; }
  if (profilesInArea.length === 0) { showModal("No profiles found in the selected area."); return; }
  const promisesToProcess = [];
  profilesInArea.forEach(profile => {
    let p;
    if (profile.dataType === 'EMOLT') {
      p = loadProfilesMetadata(moment().subtract(1, 'year'), moment(), 'EMOLT').then(profiles => {
        const found = profiles.find(x => x['Profile ID'] === profile.id);
        if (found) { return selectProfileSilently(profile.id, profile.marker, found['Date']); }
        return null;
      });
    } else if (profile.dataType === 'CTD') {
      p = loadProfilesMetadata(moment().subtract(1, 'year'), moment(), 'CTD').then(profiles => {
        const found = profiles.find(x => x['Profile ID'] === profile.id);
        if (found) { return selectProfileSilently(profile.id, profile.marker, found['Date']); }
        return null;
      });
    }
    if (p) promisesToProcess.push(p);
  });
  Promise.all(promisesToProcess).catch(err => { console.error('Error selecting profiles in area:', err); showModal("There was an error selecting profiles. Please try again."); });
}

function isMarkerInsidePolygon(markerLatLng, polygon) {
  const polygonLatLngs = polygon.getLatLngs()[0];
  let inside = false;
  let x = markerLatLng.lng, y = markerLatLng.lat;
  for (let i = 0, j = polygonLatLngs.length - 1; i < polygonLatLngs.length; j = i++) {
    const xi = polygonLatLngs[i].lng, yi = polygonLatLngs[i].lat;
    const xj = polygonLatLngs[j].lng, yj = polygonLatLngs[j].lat;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
