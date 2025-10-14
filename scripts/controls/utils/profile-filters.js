// controls/profile-filters.js
import { PROFILE_FILTERS } from '../../config.js';
import { loadProfiles } from '../../map/profiles.js';

export function setupProfileFilters() {
  const applyButton = document.getElementById(PROFILE_FILTERS.applyButtonId);
  if (!applyButton) return;
  applyButton.addEventListener('click', function() {
    const dateRange = $('#'+PROFILE_FILTERS.dateRangeId).data('daterangepicker');
    const startDate = dateRange.startDate.format('YYYY-MM-DD');
    const endDate = dateRange.endDate.format('YYYY-MM-DD');
    const selectedSources = [];
    if (document.getElementById(PROFILE_FILTERS.emoltId).checked) selectedSources.push('EMOLT');
    if (document.getElementById(PROFILE_FILTERS.cccfaId).checked) selectedSources.push('cccfa_outer_cape');
    if (document.getElementById(PROFILE_FILTERS.cfrfId).checked) selectedSources.push('shelf_research_fleet');
    const legendItems = document.getElementById('profile-legend-items');
    if (legendItems) legendItems.innerHTML = '';
    const legendContainer = document.getElementById('profile-legend-container');
    if (legendContainer) legendContainer.style.display = 'none';
    loadProfiles(startDate, endDate, selectedSources);
  });
}


