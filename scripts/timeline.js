import { map } from './map-setup.js';
import { updateLayerPaths } from './layers.js';
import { activeLayerType } from './controls.js';

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

//  available dates from the JSON file
async function fetchAvailableDates() {
    try {
        const response = await fetch('../data/OSTIA_SST/sst_dates.txt');
        if (!response.ok) {
            throw new Error('Failed to fetch available dates');
        }
        const text = await response.text();
        const dates = text.trim().split('\n');
        return dates.sort((a, b) => new Date(a) - new Date(b));
    } catch (error) {
        console.error('Error fetching available dates:', error);
        return [];
    }
}

// Initialize timeline control
async function initializeTimeline() {
    console.log('Initializing timeline...');
    
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
            updateTimelineDisplay();
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
        updateTimelineDisplay();
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
                updateTimelineDisplay();
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
    prevButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (activeLayerType === 'SST') {
            if (currentDateIndex > 2) {
                currentDateIndex -= 3;
                updateDate();
                console.log('Moved to previous SST date, new index:', currentDateIndex);
            } else {
                // Do nothing if less than 3 days from start
                console.log('Cannot move back by 3 days from current SST date, staying at current date.');
            }
        } else {
            if (currentDateIndex > 0) {
                currentDateIndex--;
                updateDate();
                console.log('Moved to previous date, new index:', currentDateIndex);
            } else {
                console.log('Already at first date');
            }
        }
    });
    
    // Prevent double-click zoom on previous button
    prevButton.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });
    
    nextButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (activeLayerType === 'SST') {
            if (currentDateIndex < availableDates.length - 3) {
                currentDateIndex += 3;
                updateDate();
                console.log('Moved to next SST date, new index:', currentDateIndex);
            } else {
                // Do nothing if less than 3 days from end
                console.log('Cannot move forward by 3 days from current SST date, staying at current date.');
            }
        } else {
            if (currentDateIndex < availableDates.length - 1) {
                currentDateIndex++;
                updateDate();
                console.log('Moved to next date, new index:', currentDateIndex);
            } else {
                console.log('Already at last date');
            }
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
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            if (currentDateIndex > 0) {
                currentDateIndex--;
                updateDate();
            }
        } else if (e.key === 'ArrowRight') {
            if (currentDateIndex < availableDates.length - 1) {
                currentDateIndex++;
                updateDate();
            }
        }
    });
}

function updateTimelineDisplay() {
    const timelineDate = document.getElementById('timeline-date');
    
    // Update date display
    const currentDate = availableDates[currentDateIndex];
    // Convert YYYYDDD to a proper date for display
    const year = currentDate.slice(0, 4);
    const dayOfYear = parseInt(currentDate.slice(4));
    // Create date by adding days to January 1st of the year
    const date = new Date(year, 0, 1); // January 1st
    date.setDate(date.getDate() + dayOfYear - 1); // Subtract 1 because day 1 is January 1st
    timelineDate.textContent = moment(date).format('MMM D, YYYY');
    
    // Make the date clickable with hover effects
    timelineDate.style.cursor = 'pointer';
    timelineDate.style.transition = 'all 0.2s ease';
    
    // Add hover effects via CSS classes
    timelineDate.classList.add('timeline-date-clickable');
    
    // Remove any existing click listeners to avoid duplicates
    timelineDate.removeEventListener('click', openCalendarPopup);
    
    // Add click listener to open calendar
    timelineDate.addEventListener('click', openCalendarPopup);
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
    updateTimelineDisplay();
    
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