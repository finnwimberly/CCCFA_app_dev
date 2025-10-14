// controls/area-select.js
// Moved to control_utils/area-select.js
import { map } from '../../map/core.js';
import { state } from '../../state.js';
import { loadProfilesMetadata } from '../../profiles_and_plots/data-loading.js';
import { selectProfileSilently, createEmoltIcon, showModal } from '../../map/profiles.js';

let drawingPolygon = false;
let polygon = null;
let points = [];
let tempLine = null;

export function initAreaSelection() {
  const selectButton = document.querySelector('.select-button');
  if (!selectButton) return;
  selectButton.addEventListener('click', function(e) {
    e.stopPropagation();
    if (drawingPolygon) {
      if (points.length >= 3) finishPolygon(); else showModal("Please add at least 3 points to create a selection area.");
    } else {
      drawingPolygon = true;
      selectButton.textContent = 'Confirm Selection';
      points = [];
      map.dragging.disable();
      map.doubleClickZoom.disable();
      map.on('click', handleMapClick);
      map.on('mousemove', handleMouseMove);
    }
  });
}

function handleMapClick(e) {
  if (!drawingPolygon) return;
  points.push(e.latlng);
  updatePolygonDisplay();
}

function handleMouseMove(e) {
  if (!drawingPolygon || points.length === 0) return;
  if (tempLine) map.removeLayer(tempLine);
  const tempPoints = [...points, e.latlng];
  tempLine = L.polyline(tempPoints, {color: 'red', weight: 2, dashArray: '5, 5'}).addTo(map);
}

function updatePolygonDisplay() {
  if (points.length < 2) return;
  if (polygon) map.removeLayer(polygon);
  polygon = L.polygon(points, {color: 'red', weight: 2, fillOpacity: 0.2}).addTo(map);
}

function finishPolygon() {
  if (points.length < 3) return;
  if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
  if (polygon) map.removeLayer(polygon);
  polygon = L.polygon(points, {color: 'red', fillOpacity: 0.2}).addTo(map);
  selectProfilesInPolygon(polygon);
  drawingPolygon = false;
  const button = document.querySelector('.select-button');
  button.textContent = 'Selection Complete';
  button.style.backgroundColor = '#2E8B57';
  setTimeout(() => { button.textContent = 'Select Profiles by Area'; button.style.backgroundColor = ''; }, 1000);
  map.dragging.enable();
  map.doubleClickZoom.enable();
  map.off('click', handleMapClick);
  map.off('mousemove', handleMouseMove);
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


