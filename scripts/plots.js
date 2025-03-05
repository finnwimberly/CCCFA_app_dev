// import { selectedProfiles } from './map.js';
import { generateColor } from './utils.js';
import { loadMeasurementData } from './data-loading.js';

import { state } from './state.js';


let plotData = {
  temp: [],
  sal: [],
  dens: [],
};

// function initializePlots() {
//   const commonLayout = {
//     margin: {
//       t: 60,  // reduced top margin
//       r: 60,  // right margin
//       b: 60,  // reduced bottom margin
//       l: 60   // left margin for axis labels
//     },
//     autosize: true,
//     showlegend: false,
//     height: 350, // explicit height
//     paper_bgcolor: 'rgba(0,0,0,0)',
//     plot_bgcolor: 'rgba(0,0,0,0)'
//   };

//   // Temperature vs Depth plot
//   Plotly.newPlot('temp-plot', [], {
//     ...commonLayout,
//     xaxis: { 
//       title: 'Temperature (°F)',
//       titlefont: { size: 14 }
//     },
//     yaxis: { 
//       title: 'Depth (ftm)', 
//       autorange: 'reversed',
//       titlefont: { size: 14 }
//     }
//   });

//   // Salinity vs Depth plot
//   Plotly.newPlot('sal-plot', [], {
//     ...commonLayout,
//     xaxis: { 
//       title: 'Salinity (PSU)',
//       titlefont: { size: 14 }
//     },
//     yaxis: { 
//       title: 'Depth (ftm)', 
//       autorange: 'reversed',
//       titlefont: { size: 14 }
//     }
//   });

//   // Density vs Depth plot
//   Plotly.newPlot('dens-plot', [], {
//     ...commonLayout,
//     xaxis: { 
//       title: 'Density (kg/m³)',
//       titlefont: { size: 14 }
//     },
//     yaxis: { 
//       title: 'Depth (ftm)', 
//       autorange: 'reversed',
//       titlefont: { size: 14 }
//     }
//   });
// }

function initializePlots() {
  const commonLayout = {
    margin: {
      t: 60,  // reduced top margin
      r: 60,  // increased right margin for legend
      b: 60,  // bottom margin
      l: 60   // left margin for axis labels
    },
    autosize: true,
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
    height: 350,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)'
  };

  // Temperature vs Depth plot
  Plotly.newPlot('temp-plot', [], {
    ...commonLayout,
    xaxis: { 
      title: 'Temperature (°F)',
      titlefont: { size: 14 }
    },
    yaxis: { 
      title: 'Depth (ftm)', 
      autorange: 'reversed',
      titlefont: { size: 14 }
    }
  });

  // Salinity vs Depth plot
  Plotly.newPlot('sal-plot', [], {
    ...commonLayout,
    xaxis: { 
      title: 'Salinity (PSU)',
      titlefont: { size: 14 }
    },
    yaxis: { 
      title: 'Depth (ftm)', 
      autorange: 'reversed',
      titlefont: { size: 14 }
    }
  });

  // Density vs Depth plot
  Plotly.newPlot('dens-plot', [], {
    ...commonLayout,
    xaxis: { 
      title: 'Density (kg/m³)',
      titlefont: { size: 14 }
    },
    yaxis: { 
      title: 'Depth (ftm)', 
      autorange: 'reversed',
      titlefont: { size: 14 }
    }
  });
}

// async function plotCTDMeasurements(profileId, measurements, color) {
//   console.log(`Plotting profile: ${profileId}`);
//   console.log(`Measurements:`, measurements);
//   console.log(`Color assigned: ${color}`);

//   const { temperature, salinity, density, depth } = measurements;
//   const unitSystem = document.querySelector('input[name="unit"]:checked').value;

//   // Convert measurements
//   const depthConverted = unitSystem === "imperial" ? depth.map(d => d * 0.546807) : depth;
//   const temperatureConverted = unitSystem === "imperial" ? temperature.map(t => (t * 9/5) + 32) : temperature;

//   // Add traces with profile ID as part of the `meta` property
//   await Plotly.addTraces('temp-plot', {
//     x: temperatureConverted,
//     y: depthConverted,
//     mode: 'lines+markers',
//     name: `Profile ${profileId}`,
//     meta: { profileId },
//     line: { shape: 'linear', color: color },
//     marker: { color: color }
//   });

//   await Plotly.addTraces('sal-plot', {
//     x: salinity,
//     y: depthConverted,
//     mode: 'lines+markers',
//     name: `Profile ${profileId}`,
//     meta: { profileId },
//     line: { shape: 'linear', color: color },
//     marker: { color: color }
//   });

//   await Plotly.addTraces('dens-plot', {
//     x: density,
//     y: depthConverted,
//     mode: 'lines+markers',
//     name: `Profile ${profileId}`,
//     meta: { profileId },
//     line: { shape: 'linear', color: color },
//     marker: { color: color }
//   });

//   console.log(`Traces for profile ${profileId} added successfully.`);
// }

async function plotCTDMeasurements(profileId, measurements, color) {
  const { temperature, salinity, density, depth } = measurements;
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;

  // Convert measurements
  const depthConverted = unitSystem === "imperial" ? depth.map(d => d * 0.546807) : depth;
  const temperatureConverted = unitSystem === "imperial" ? temperature.map(t => (t * 9/5) + 32) : temperature;

  // Extract and format date from profile ID (format: XXX_XXXXXX_YYYYMMDD_HHMM)
  let legendName;
  try {
    const datePart = profileId.split('_')[2]; // Get the YYYYMMDD part
    const year = datePart.substring(0, 4);
    const month = datePart.substring(4, 6);
    const day = datePart.substring(6, 8);
    legendName = `${month}/${day}/${year}`;
  } catch (error) {
    console.warn(`Error formatting date for profile ${profileId}:`, error);
    legendName = `Profile ${profileId}`;
  }

  // Add traces with profile ID and date in legend
  await Plotly.addTraces('sal-plot', {
    x: salinity,
    y: depthConverted,
    mode: 'lines+markers',
    name: legendName,
    meta: { profileId },
    line: { shape: 'linear', color: color },
    marker: { color: color },
    showlegend: true
  });

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

function removeCTDMeasurements(profileId) {
  console.log(`Attempting to remove profile: ${profileId}`);

  if (!state.selectedProfiles[profileId]) {
    console.warn(`Profile ${profileId} not found.`);
    console.log(`Current state of selectedProfiles:`, state.selectedProfiles);
    return;
  }

  try {
    // Get plots to iterate through
    const plots = ['temp-plot', 'sal-plot', 'dens-plot'];

    for (const plot of plots) {
      const plotData = document.getElementById(plot).data;

      // Find traces matching the profileId
      const traceIndices = plotData
        .map((trace, index) => (trace.meta?.profileId === profileId ? index : null))
        .filter((index) => index !== null);

      console.log(`Removing traces for profile ${profileId} in plot ${plot}:`, traceIndices);

      // Remove all traces for the profile
      Plotly.deleteTraces(plot, traceIndices);
    }

    // Clean up `selectedProfiles`
    delete state.selectedProfiles[profileId];
    console.log(`Successfully removed traces for profile ${profileId}`);
  } catch (error) {
    console.error(`Error removing traces for profile ${profileId}:`, error);
  }
}


// Helper function to get trace index by profile ID
function getTraceIndex(plotId, profileId) {
  const plotData = document.getElementById(plotId).data;

  // Find the trace with the matching profileId
  const traceIndex = plotData.findIndex((trace) => trace.meta?.profileId === profileId);

  if (traceIndex === -1) {
    console.warn(`Trace for profile ${profileId} not found in ${plotId}`);
  }
  return traceIndex;
}

// Function to update the axis labels
function updateAxisLabels() {
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;
  const depthLabel = unitSystem === "imperial" ? "Depth (ftm)" : "Depth (m)";
  const tempLabel = unitSystem === "imperial" ? "Temperature (°F)" : "Temperature (°C)";

  // Update the labels for each plot
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

function handleUnitChange(selectedProfiles) {
  const unitSystem = document.querySelector('input[name="unit"]:checked').value;
  console.log(`Unit system changed to: ${unitSystem}`);

  Object.keys(state.selectedProfiles).forEach((profileId) => {
    const profile = state.selectedProfiles[profileId];
    const { measurements } = profile;

    // Convert data
    const depthConverted =
      unitSystem === 'imperial'
        ? measurements.depth.map((d) => d * 0.546807) // meters to fathoms
        : measurements.depth.map((d) => d); // fathoms to meters


    const temperatureConverted =
      unitSystem === 'imperial'
        ? measurements.temperature.map((t) => (t * 9) / 5 + 32) // Celsius to Fahrenheit
        : measurements.temperature.map((t) => t); // Fahrenheit to Celsius

    // Update plots for this profile
    const tempTraceUpdate = { x: [temperatureConverted], y: [depthConverted] };
    const salTraceUpdate = { y: [depthConverted] };
    const densTraceUpdate = { y: [depthConverted] };

    // Use `Plotly.restyle` to update the plots without replotting everything
    Plotly.restyle('temp-plot', tempTraceUpdate, getTraceIndex('temp-plot', profileId));
    Plotly.restyle('sal-plot', salTraceUpdate, getTraceIndex('sal-plot', profileId));
    Plotly.restyle('dens-plot', densTraceUpdate, getTraceIndex('dens-plot', profileId));

    console.log(`Updated plot data for profile ${profileId} to ${unitSystem} units.`);
  });

  // Update axis labels after data is converted
  updateAxisLabels();
}

export { initializePlots, plotCTDMeasurements, removeCTDMeasurements, getTraceIndex, handleUnitChange, updateAxisLabels };