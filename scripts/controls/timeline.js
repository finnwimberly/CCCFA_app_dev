// import { map } from './map/core.js';
import { updateLayerPaths } from '../gridded_products/layers.js';
import { controlsState } from '../state.js';
import { DATE_FILES } from '../config.js';

// Timeline state
let availableDates = [];
let currentDateIndex = 0;

// Helper function to convert between date formats
function convertDateFormat(date, toLayerFormat = true) {
    if (toLayerFormat) {
        // Convert from YYYYDDD to YYYY_DDD
        return `${date.slice(0, 4)}_${date.slice(4)}`;
    } else {
        // Convert from YYYY_DDD to YYYYDDD
        return date.replace('_', '');
    }
}

// Helper function to convert folder date (YYYY_DDD or YYYYDDD) to MM/DD/YYYY
function folderDateToDisplay(date) {
    let y = date.slice(0, 4);
    let d = parseInt(date.slice(-3), 10);
    // Create date by adding days to January 1st of the year
    let jsDate = new Date(y, 0, 1); // January 1st
    jsDate.setDate(jsDate.getDate() + d - 1); // Subtract 1 because day 1 is January 1st
    let mm = String(jsDate.getMonth() + 1).padStart(2, '0');
    let dd = String(jsDate.getDate()).padStart(2, '0');
    let yyyy = jsDate.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}

// Helper to convert MM/DD/YYYY to YYYY_DDD
function displayToFolderDate(displayDate) {
    // displayDate: MM/DD/YYYY
    const [mm, dd, yyyy] = displayDate.split(/[\/]/);
    const date = new Date(`${yyyy}-${mm}-${dd}`);
    const start = new Date(date.getFullYear(), 0, 1); // January 1st of the year
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const day = Math.round(diff / oneDay) + 1; // Add 1 because difference is 0-based
    return `${yyyy}_${String(day).padStart(3, '0')}`;
}

// Helper function to convert YYYY-MM-DD to YYYYDDD format
function isoDateToTimelineFormat(isoDate) {
    // Using UTC functions to avoid timezone-related errors
    const date = new Date(isoDate); // 'YYYY-MM-DD' is parsed as UTC midnight
    const year = date.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1)); // Jan 1st of that year, UTC
    
    // Calculate the difference in milliseconds and convert to days
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.round(diff / oneDay) + 1;
    
    return `${year}${String(dayOfYear).padStart(3, '0')}`;
}

// Helper function to wait for availableLayerDates to be populated
function waitForLayerDates() {
    return new Promise((resolve) => {
        const checkDates = () => {
            console.log('Checking for layer dates...', {
                hasAvailableLayerDates: !!controlsState.availableLayerDates,
                keys: controlsState.availableLayerDates ? Object.keys(controlsState.availableLayerDates) : [],
                sstLength: controlsState.availableLayerDates?.SST?.length || 0,
                fishbotLength: controlsState.availableLayerDates?.fishbot?.length || 0
            });
            
            if (controlsState.availableLayerDates && Object.keys(controlsState.availableLayerDates).length > 0 && 
                (controlsState.availableLayerDates.SST && controlsState.availableLayerDates.SST.length > 0) ||
                (controlsState.availableLayerDates.fishbot && controlsState.availableLayerDates.fishbot.length > 0)) {
                console.log('Layer dates are available:', controlsState.availableLayerDates);
                resolve(controlsState.availableLayerDates);
            } else {
                setTimeout(checkDates, 100); // Check again in 100ms
            }
        };
        checkDates();
    });
}

// Helper function to find the next available date for the currently selected layer
async function findNextAvailableDate(currentDate, layerType) {
    // Wait for layer dates to be available
    await waitForLayerDates();
    
    if (!layerType || !controlsState.availableLayerDates[layerType]) {
        // No layer selected or no dates available, use default +1 day
        const currentIndex = availableDates.indexOf(currentDate);
        if (currentIndex < availableDates.length - 1) {
            return availableDates[currentIndex + 1];
        }
        return null; // Already at the end
    }
    
    const layerDates = controlsState.availableLayerDates[layerType];
    
    // Normalize current date to UTC midnight for correct comparison
    const y = parseInt(currentDate.slice(0, 4), 10);
    const d = parseInt(currentDate.slice(4), 10);
    const localDate = new Date(y, 0, d);
    const currentDateObj = new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()));
    
    // Find the next available date for this layer
    for (let i = 0; i < layerDates.length; i++) {
        const layerDate = layerDates[i]; // Format: YYYY-MM-DD
        const layerDateObj = new Date(layerDate); // This is already UTC midnight
        
        if (layerDateObj > currentDateObj) {
            // Convert YYYY-MM-DD to YYYYDDD format
            return isoDateToTimelineFormat(layerDate);
        }
    }
    
    return null; // No next date available
}

// Helper function to find the previous available date for the currently selected layer
async function findPreviousAvailableDate(currentDate, layerType) {
    // Wait for layer dates to be available
    await waitForLayerDates();
    
    if (!layerType || !controlsState.availableLayerDates[layerType]) {
        // No layer selected or no dates available, use default -1 day
        const currentIndex = availableDates.indexOf(currentDate);
        if (currentIndex > 0) {
            return availableDates[currentIndex - 1];
        }
        return null; // Already at the beginning
    }
    
    const layerDates = controlsState.availableLayerDates[layerType];

    // Normalize current date to UTC midnight for correct comparison
    const y = parseInt(currentDate.slice(0, 4), 10);
    const d = parseInt(currentDate.slice(4), 10);
    const localDate = new Date(y, 0, d);
    const currentDateObj = new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()));
    
    // Find the previous available date for this layer
    for (let i = layerDates.length - 1; i >= 0; i--) {
        const layerDate = layerDates[i]; // Format: YYYY-MM-DD
        const layerDateObj = new Date(layerDate); // This is already UTC midnight
        
        if (layerDateObj < currentDateObj) {
            // Convert YYYY-MM-DD to YYYYDDD format
            return isoDateToTimelineFormat(layerDate);
        }
    }
    
    return null; // No previous date available
}

// Function to open the calendar popup
function openCalendarPopup(e) {
    e.stopPropagation();
    e.preventDefault();
    
    const layerDateInput = document.getElementById('layer-date');
    if (layerDateInput) {
        // Trigger the daterangepicker to open
        $(layerDateInput).data('daterangepicker').show();
    }
}

//  available dates from the JSON file
async function fetchLayerDates(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            console.error(`Failed to fetch ${filePath}`);
            return [];
        }
        const text = await response.text();
        // Ensure only valid YYYYDDD formats are returned
        return text.trim().split('\n').filter(line => line.trim() && /^\d{4}\d{3}$/.test(line.trim()));
    } catch (error) {
        console.error(`Error fetching dates from ${filePath}: ${error.message}`);
        return [];
    }
}

async function fetchAvailableDates() {
    const sstDatesPath = DATE_FILES.SST;
    const sssDatesPath = DATE_FILES.SSS;
    const chloroDatesPath = DATE_FILES.CHL;
    const ostiaSstDatesPath = DATE_FILES.OSTIA_SST;
    const doppioDatesPath = DATE_FILES.DOPPIO;
    const ostiaAnomalyDatesPath = DATE_FILES.OSTIA_anomaly;

    const allDateArrays = await Promise.all([
        fetchLayerDates(sstDatesPath),
        fetchLayerDates(sssDatesPath),
        fetchLayerDates(chloroDatesPath),
        fetchLayerDates(ostiaSstDatesPath),
        fetchLayerDates(doppioDatesPath),
        fetchLayerDates(ostiaAnomalyDatesPath)
    ]);

    const allDatesSet = new Set(allDateArrays.flat());
    const uniqueDates = Array.from(allDatesSet);
    
    // Dates are in YYYYDDD format, so a simple string sort is correct.
    return uniqueDates.sort();
}

// Create info modal for layer selection color scheme
const infoModal = `
  <div id="info-overlay"></div>
  <div id="info-modal">
    <span id="info-modal-close">&times;</span>
    <h4>Layer Selection Color Scheme</h4>
    <p class="modal-subtitle">
      To view data availability by day, click on the date box to the left of the timeline. 
      The color of each date on the calendar drop-down indicates which data layers are available. A diagonal stripe indicates 
      that high-resolution SST data is available for that date. Date selection can be done via the calendar or slider. 
      The selected date can be changed with the arrows. If a surface layer is selected, the arrows jump to the next/previous 
      available date for that layer. Otherwise, they change the date by one day.
    </p>
    <ul>
      <li><span class="color-block highlight-all"></span> All layers available (High resolution (HR) SST, gapfilled SST,
      SST anomaly,SSS, and CHL)</li>
      <li><span class="color-block highlight-all-no-sst"></span> All layers except HR SST (gapfilled SST, 
      SST anomaly, SSS and CHL)</li>
      <li><span class="color-block highlight-all-no-sss"></span> All layers except SSS (HR SST, gapfilled SST, SST anomaly, 
      and CHL)</li>
      <li><span class="color-block highlight-all-no-sss-sst"></span> All layers except SSS and HR SST (gapfilled SST, SST anomaly, 
      and CHL)</li>
      <li><span class="color-block highlight-all-sst"></span> All SST layers but no SSS or CHL</li>
      <li><span class="color-block highlight-ostia-only"></span> Only gapfilled and anomaly SST layers available</li>
      <li><span class="color-block highlight-doppio-only"></span> DOPPIO forecast. Available for next 3 days and updates daily. </li>
    </ul>
  </div>
`;

// Add the modal to the DOM
document.body.insertAdjacentHTML('beforeend', infoModal);

// Initialize timeline control
async function initializeTimeline() {
    console.log('Initializing timeline...');
    
    // Setup info modal event listeners
    const infoIcon = document.getElementById('info-icon');
    const infoOverlay = document.getElementById('info-overlay');
    const infoModal = document.getElementById('info-modal');
    const infoModalClose = document.getElementById('info-modal-close');
    if (infoIcon && infoOverlay && infoModal && infoModalClose) {
        infoIcon.addEventListener('click', () => {
            infoOverlay.style.display = 'block';
            infoModal.style.display = 'block';
            document.body.classList.add('modal-open');
        });
        infoModalClose.addEventListener('click', () => {
            infoOverlay.style.display = 'none';
            infoModal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });
        infoOverlay.addEventListener('click', () => {
            infoOverlay.style.display = 'none';
            infoModal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });
    }
    
    const timelineControl = document.querySelector('.timeline-control');
    if (!timelineControl) {
        console.log('Timeline control not found during initialization');
    }
    
    // Get available dates
    availableDates = await fetchAvailableDates();
    console.log('Available dates:', availableDates);
    if (availableDates.length === 0) {
        console.error('No available dates found');
        return;
    }
    

    const timelineDate = document.getElementById('timeline-date');
    const prevButton = document.getElementById('timeline-prev');
    const nextButton = document.getElementById('timeline-next');
    const layerDateInput = document.getElementById('layer-date');
    const timelineSlider = document.getElementById('timeline-slider');
    const sliderStartDate = document.querySelector('.slider-start-date');
    const sliderEndDate = document.querySelector('.slider-end-date');
    
    console.log('Layer date input value on init:', layerDateInput.value);
    
    // Initialize slider
    if (timelineSlider) {
        timelineSlider.min = 0;
        timelineSlider.max = availableDates.length - 1;
        timelineSlider.value = 0;
        
        // Set slider labels
        if (sliderStartDate && sliderEndDate && availableDates.length > 0) {
            const startDate = folderDateToDisplay(availableDates[0]);
            const endDate = folderDateToDisplay(availableDates[availableDates.length - 1]);
            sliderStartDate.textContent = startDate;
            sliderEndDate.textContent = endDate;
        }
    }
    
    // Function to update timeline position based on a date
    function updateTimelinePosition(date) {
        const dateFormatted = convertDateFormat(date, false); // Convert to YYYYDDD format
        const newIndex = availableDates.indexOf(dateFormatted);
        if (newIndex !== -1) {
            currentDateIndex = newIndex;
            // Update slider position
            if (timelineSlider) {
                timelineSlider.value = currentDateIndex;
            }
            return true;
        }
        return false;
    }
    
    // Set initial date from layer date input only if one exists
    if (layerDateInput.value && layerDateInput.value.trim() !== '') {
        console.log('Date found, updating timeline position');
        updateTimelinePosition(layerDateInput.value);
        // Always set input to display format
        layerDateInput.value = folderDateToDisplay(availableDates[currentDateIndex]);
        console.log('Timeline control shown because date exists');
    } else {
        console.log('No date found, timeline still visible');
    }
    
    // Listen for layer date changes (from calendar or direct input)
    layerDateInput.addEventListener('change', () => {
        let newDate = layerDateInput.value;
        console.log('Change event - input value:', newDate);
        
        // Convert MM/DD/YYYY to folder format for internal logic
        let folderDate;
        if (newDate.includes('/')) {
            // Input is in MM/DD/YYYY format
            folderDate = displayToFolderDate(newDate);
            console.log('Converted MM/DD/YYYY to folder format:', folderDate);
        } else {
            // Input is already in folder format (YYYY_DDD)
            folderDate = newDate;
            console.log('Input already in folder format:', folderDate);
        }
        
        if (!updateTimelinePosition(folderDate)) {
            // If exact date not found, find closest date
            const dateObj = new Date(newDate);
            const closestIndex = availableDates.findIndex(date => {
                const dateObj2 = new Date(date.slice(0, 4), 0, parseInt(date.slice(4)));
                return dateObj2 >= dateObj;
            });
            if (closestIndex !== -1) {
                currentDateIndex = closestIndex;
                const closestDate = availableDates[currentDateIndex];
                // Always set input to display format
                layerDateInput.value = folderDateToDisplay(closestDate);
                console.log('Set closest date to display format:', layerDateInput.value);
                // Update slider position
                if (timelineSlider) {
                    timelineSlider.value = currentDateIndex;
                }
            }
        } else {
            // Date was found, ensure input is in display format
            layerDateInput.value = folderDateToDisplay(availableDates[currentDateIndex]);
            console.log('Date found, set input to display format:', layerDateInput.value);
            // Update slider position
            if (timelineSlider) {
                timelineSlider.value = currentDateIndex;
            }
        }
    });
    
    // Make layer-date input clickable to open calendar popup
    layerDateInput.addEventListener('click', openCalendarPopup);
    
    // Slider event listener
    if (timelineSlider) {
        timelineSlider.addEventListener('input', (e) => {
            const newIndex = parseInt(e.target.value);
            if (newIndex !== currentDateIndex) {
                currentDateIndex = newIndex;
                updateDate();
                console.log('Slider moved to index:', currentDateIndex);
            }
        });
        
        // Prevent map interactions on slider
        timelineSlider.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        timelineSlider.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });

        ['mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'pointermove'].forEach(eventType => {
            timelineSlider.addEventListener(eventType, e => {
                e.stopPropagation();
            });
        });
    }
    
    // Previous/Next button click handlers with map zoom prevention
    prevButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        try {
            const currentDate = availableDates[currentDateIndex];
            const previousDate = await findPreviousAvailableDate(currentDate, controlsState.activeLayerType);
            
            if (previousDate) {
                // Find the index of the previous date in the availableDates array
                const newIndex = availableDates.indexOf(previousDate);
                if (newIndex !== -1) {
                    currentDateIndex = newIndex;
                    updateDate();
                    console.log('Moved to previous available date for', controlsState.activeLayerType || 'default', 'new index:', currentDateIndex);
                }
            } else {
                console.log('No previous date available for', controlsState.activeLayerType || 'default');
            }
        } catch (error) {
            console.error('Error finding previous date:', error);
        }
    });
    
    // Prevent double-click zoom on previous button
    prevButton.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });
    
    nextButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        try {
            const currentDate = availableDates[currentDateIndex];
            const nextDate = await findNextAvailableDate(currentDate, controlsState.activeLayerType);
            
            if (nextDate) {
                // Find the index of the next date in the availableDates array
                const newIndex = availableDates.indexOf(nextDate);
                if (newIndex !== -1) {
                    currentDateIndex = newIndex;
                    updateDate();
                    console.log('Moved to next available date for', controlsState.activeLayerType || 'default', 'new index:', currentDateIndex);
                }
            } else {
                console.log('No next date available for', controlsState.activeLayerType || 'default');
            }
        } catch (error) {
            console.error('Error finding next date:', error);
        }
    });
    
    // Prevent double-click zoom on next button
    nextButton.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });
    
    // Prevent map interactions on entire timeline control
    timelineControl.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    timelineControl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });

    // Add keyboard controls
    document.addEventListener('keydown', async (e) => {
        if (e.key === 'ArrowLeft') {
            try {
                const currentDate = availableDates[currentDateIndex];
                const previousDate = await findPreviousAvailableDate(currentDate, controlsState.activeLayerType);
                
                if (previousDate) {
                    const newIndex = availableDates.indexOf(previousDate);
                    if (newIndex !== -1) {
                        currentDateIndex = newIndex;
                        updateDate();
                    }
                }
            } catch (error) {
                console.error('Error finding previous date:', error);
            }
        } else if (e.key === 'ArrowRight') {
            try {
                const currentDate = availableDates[currentDateIndex];
                const nextDate = await findNextAvailableDate(currentDate, controlsState.activeLayerType);
                
                if (nextDate) {
                    const newIndex = availableDates.indexOf(nextDate);
                    if (newIndex !== -1) {
                        currentDateIndex = newIndex;
                        updateDate();
                    }
                }
            } catch (error) {
                console.error('Error finding next date:', error);
            }
        }
    });
}

function updateDate() {
    const currentDate = availableDates[currentDateIndex];
    const layerDateInput = document.getElementById('layer-date');
    const timelineSlider = document.getElementById('timeline-slider');
    const newDate = convertDateFormat(currentDate, true);
    
    // Always set the visible value to MM/DD/YYYY
    layerDateInput.value = folderDateToDisplay(currentDate);
    
    // Update the daterangepicker instance
    const picker = $('#layer-date').data('daterangepicker');
    if (picker) {
        const date = moment(newDate, 'YYYY_DDD');
        picker.setStartDate(date);
        picker.setEndDate(date);
    }
    
    // Update layer paths (use folder format)
    updateLayerPaths(newDate);
    
    // Update slider position
    if (timelineSlider) {
        timelineSlider.value = currentDateIndex;
    }
}

// Export functions for use in other modules
export {
    initializeTimeline,
    updateDate
};

// Add CSS styles for hover effects
if (!document.getElementById('timeline-hover-styles')) {
    const style = document.createElement('style');
    style.id = 'timeline-hover-styles';
    style.textContent = `
        .timeline-date-clickable:hover {
            color: #007bff;
            background-color: rgba(0, 123, 255, 0.1);
            border-radius: 4px;
        }
        
        .timeline-date-clickable {
            transition: all 0.2s ease;
            display: inline-block;
        }
    `;
    document.head.appendChild(style);
} 