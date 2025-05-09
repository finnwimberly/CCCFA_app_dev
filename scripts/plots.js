// Remove this commented-out import
// import { selectedProfiles } from './map.js';
import { generateColor } from './utils.js';
import { loadMeasurementData } from './data-loading.js';

import { state } from './state.js';


let plotData = {
  temp: [],
  sal: [],
  dens: [],
};

function initializePlots() {
  const commonLayout = {
    margin: {
      t: 60,  // reduced top margin
      r: 60,  // increased right margin for legend
      b: 60,  // bottom margin
      l: 60   // left margin for axis labels
    },
    autosize: true,
    responsive: true,
    showlegend: true, // Enable legend
    legend: {
      x: 0.5,       // Center horizontally
      y: 1.3,       // Position above the plot
      xanchor: 'center',
      yanchor: 'top',
      orientation: 'h',    // Horizontal layout
      traceorder: 'normal',
      itemwidth: 80,      // Control width of each legend item
      itemsizing: 'constant',
      xgap: 10,          // Add space between legend items
      font: { size: 9 }, // Slightly smaller font
      bgcolor: 'rgba(255,255,255,0.8)',
      bordercolor: '#ddd',
      borderwidth: 1
    },
    height: null, // Remove fixed height
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)'
  };

  // Function to handle plot resizing
  function resizePlots() {
    const plotContainers = document.querySelectorAll('.plot-container');
    plotContainers.forEach(container => {
      const plotId = container.getAttribute('data-plot-id');
      if (!plotId) return; // Skip if no plot ID is set
      
      const width = container.offsetWidth;
      const height = width * (3/4); // Maintain 4:3 aspect ratio
      
      Plotly.relayout(plotId, {
        'width': width,
        'height': height
      });
    });
  }

  // Initialize each plot
  const plotConfigs = [
    {
      id: 'temp-plot',
    xaxis: { 
      title: 'Temperature (°F)',
      titlefont: { size: 14 }
    },
    yaxis: { 
      title: 'Depth (ftm)', 
      autorange: 'reversed',
      titlefont: { size: 14 }
    }
    },
    {
      id: 'sal-plot',
    xaxis: { 
      title: 'Salinity (PSU)',
      titlefont: { size: 14 }
    },
    yaxis: { 
      title: 'Depth (ftm)', 
      autorange: 'reversed',
      titlefont: { size: 14 }
    }
    },
    {
      id: 'dens-plot',
    xaxis: { 
      title: 'Density (kg/m³)',
      titlefont: { size: 14 }
    },
    yaxis: { 
      title: 'Depth (ftm)', 
      autorange: 'reversed',
      titlefont: { size: 14 }
    }
    }
  ];

  // Initialize each plot and set up its container
  plotConfigs.forEach(config => {
    const container = document.getElementById(config.id);
    if (!container) {
      console.warn(`Container for ${config.id} not found`);
      return;
    }
    
    // Set the data-plot-id attribute
    container.setAttribute('data-plot-id', config.id);
    
    // Initialize the plot
    Plotly.newPlot(config.id, [], {
      ...commonLayout,
      ...config
    });
  });

  // Add resize observer to handle container size changes
  const resizeObserver = new ResizeObserver(entries => {
    resizePlots();
  });

  // Observe all plot containers
  document.querySelectorAll('.plot-container').forEach(container => {
    resizeObserver.observe(container);
  });

  // Also listen for window resize events
  window.addEventListener('resize', resizePlots);

  // Initial resize
  resizePlots();
}

async function plotCTDMeasurements(profileId, measurements, color) {
  const { temperature, depth } = measurements;
  const dataType = state.selectedProfiles[profileId].dataType;
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;

  // Convert measurements
  const depthConverted = unitSystem === "imperial" ? depth.map(d => d * 0.546807) : depth;
  const temperatureConverted = unitSystem === "imperial" ? temperature.map(t => (t * 9/5) + 32) : temperature;

  // Extract and format date from profile ID or use date from state
  let legendName;
  if (state.selectedProfiles[profileId].date) {
    const date = state.selectedProfiles[profileId].date;
    try {
      const formattedDate = new Date(date).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      legendName = `${formattedDate} (${dataType})`;
    } catch (error) {
      legendName = `${date} (${dataType})`;
    }
  } else {
    try {
      const datePart = profileId.split('_')[2]; // Get the YYYYMMDD part
      const year = datePart.substring(0, 4);
      const month = datePart.substring(4, 6);
      const day = datePart.substring(6, 8);
      legendName = `${month}/${day}/${year} (${dataType})`;
    } catch (error) {
      console.warn(`Error formatting date for profile ${profileId}:`, error);
      legendName = `Profile ${profileId} (${dataType})`;
    }
  }

  // Always plot temperature
  await Plotly.addTraces('temp-plot', {
    x: temperatureConverted,
    y: depthConverted,
    mode: 'lines+markers',
    name: legendName,
    meta: { profileId },
    line: { shape: 'linear', color: color },
    marker: { color: color },
    showlegend: false
  });

  // Only plot salinity and density for CTD data
  if (dataType === 'CTD' && measurements.salinity && measurements.density) {
    const { salinity, density } = measurements;
    
    await Plotly.addTraces('sal-plot', {
      x: salinity,
      y: depthConverted,
      mode: 'lines+markers',
      name: legendName,
      meta: { profileId },
      line: { shape: 'linear', color: color },
      marker: { color: color },
      showlegend: false
    });

    await Plotly.addTraces('dens-plot', {
      x: density,
      y: depthConverted,
      mode: 'lines+markers',
      name: legendName,
      meta: { profileId },
      line: { shape: 'linear', color: color },
      marker: { color: color },
      showlegend: false
    });
  }
}

function removeCTDMeasurements(profileId) {
  console.log(`Attempting to remove profile: ${profileId}`);

  if (!state.selectedProfiles[profileId]) {
    console.warn(`Profile ${profileId} not found.`);
    console.log(`Current state of selectedProfiles:`, state.selectedProfiles);
    return;
  }

  const dataType = state.selectedProfiles[profileId].dataType;

  try {
    // Always remove from temperature plot
    const tempPlot = document.getElementById('temp-plot');
    const tempTraces = tempPlot.data
      .map((trace, index) => (trace.meta?.profileId === profileId ? index : null))
      .filter((index) => index !== null);
    
    Plotly.deleteTraces('temp-plot', tempTraces);

    // Only remove from salinity and density plots if it's CTD data
    if (dataType === 'CTD') {
      const salPlot = document.getElementById('sal-plot');
      const salTraces = salPlot.data
        .map((trace, index) => (trace.meta?.profileId === profileId ? index : null))
        .filter((index) => index !== null);
      
      Plotly.deleteTraces('sal-plot', salTraces);

      const densPlot = document.getElementById('dens-plot');
      const densTraces = densPlot.data
        .map((trace, index) => (trace.meta?.profileId === profileId ? index : null))
        .filter((index) => index !== null);
      
      Plotly.deleteTraces('dens-plot', densTraces);
    }

    console.log(`Successfully removed traces for profile ${profileId}`);
  } catch (error) {
    console.error(`Error removing traces for profile ${profileId}:`, error);
  }
}

// Helper function to get trace index by profile ID
function getTraceIndex(plotId, profileId) {
  const plotData = document.getElementById(plotId).data;
  return plotData.findIndex((trace) => trace.meta?.profileId === profileId);
}

function handleUnitChange(selectedProfiles) {
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;

  Object.entries(selectedProfiles).forEach(([profileId, profile]) => {
    const { measurements, dataType } = profile;
    if (!measurements) return;

    // Convert data
    const depthConverted = measurements.depth.map(d => 
      unitSystem === 'imperial' ? d * 0.546807 : d
    );
    const temperatureConverted = measurements.temperature.map(t =>
      unitSystem === 'imperial' ? (t * 9/5) + 32 : t
    );

    // Update temperature plot for both CTD and EMOLT
    const tempTraceIndex = getTraceIndex('temp-plot', profileId);
    if (tempTraceIndex !== -1) {
      Plotly.restyle('temp-plot', {
        x: [temperatureConverted],
        y: [depthConverted]
      }, [tempTraceIndex]);
    }

    // Only update salinity and density for CTD data
    if (dataType === 'CTD') {
      const salTraceIndex = getTraceIndex('sal-plot', profileId);
      if (salTraceIndex !== -1) {
        Plotly.restyle('sal-plot', {
          y: [depthConverted]
        }, [salTraceIndex]);
      }

      const densTraceIndex = getTraceIndex('dens-plot', profileId);
      if (densTraceIndex !== -1) {
        Plotly.restyle('dens-plot', {
          y: [depthConverted]
        }, [densTraceIndex]);
      }
    }
  });

  // Update axis labels
  const depthLabel = unitSystem === "imperial" ? "Depth (ftm)" : "Depth (m)";
  const tempLabel = unitSystem === "imperial" ? "Temperature (°F)" : "Temperature (°C)";

  Plotly.relayout('temp-plot', {
    'xaxis.title.text': tempLabel,
    'yaxis.title.text': depthLabel
  });

  Plotly.relayout('sal-plot', {
    'yaxis.title.text': depthLabel
  });

  Plotly.relayout('dens-plot', {
    'yaxis.title.text': depthLabel
  });
}

export { initializePlots, plotCTDMeasurements, removeCTDMeasurements, handleUnitChange };