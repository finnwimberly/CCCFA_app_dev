// legend.js
// Shared colorbar legend utility used by both layers.js and fishbot.js

/**
 * Parse a space-separated colormap text file into a Plotly colorscale array.
 * Skips index 0 (transparent placeholder).
 *
 * @param {string} colormapText - Raw colormap file contents
 * @returns {Array} Plotly-compatible colorscale [[position, rgbaString], ...]
 */
function parseColormap(colormapText) {
  const rgbValues = colormapText.split('\n')
    .filter((line) => line.trim())
    .map((line) => line.split(' ').map(Number));

  const validColors = rgbValues.slice(1);
  return validColors.map((rgb, i) => {
    const [index, r, g, b, a] = rgb;
    return [i / (validColors.length - 1), `rgba(${r}, ${g}, ${b}, ${a / 255})`];
  });
}

/**
 * Hide all legend containers except the active one, resetting their styles.
 *
 * @param {string} activeLegendId - The ID of the legend container to keep visible
 */
function hideOtherLegends(activeLegendId) {
  const allLegendContainers = document.querySelectorAll('[id$="-legend"]');
  allLegendContainers.forEach(container => {
    if (container.id !== activeLegendId) {
      container.style.display = 'none';
      container.innerHTML = '';
      container.style.background = 'none';
      container.style.border = 'none';
      container.style.boxShadow = 'none';
      container.style.padding = '0';
      container.style.margin = '0';
    }
  });
}

/**
 * Style a legend container with the standard appearance.
 *
 * @param {HTMLElement} container
 */
function styleLegendContainer(container) {
  container.style.background = 'white';
  container.style.border = '1px solid #ddd';
  container.style.borderRadius = '4px';
  container.style.padding = '10px';
  container.style.margin = '10px';
  container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
  container.style.display = 'block';
}

/**
 * Create a Plotly-based colorbar legend.
 *
 * @param {Object} opts
 * @param {string}  opts.legendId      - DOM element ID for the legend container
 * @param {string}  opts.colormapUrl   - URL to fetch the colormap text file
 * @param {number}  opts.minValue      - Minimum value for the colorbar (already unit-converted)
 * @param {number}  opts.maxValue      - Maximum value for the colorbar (already unit-converted)
 * @param {string}  opts.title         - Legend title text (e.g. "SST (°C)")
 * @param {Object}  [opts.tickOverride] - Optional tick config override (for CHL log scale, etc.)
 *   @param {string}  tickOverride.tickmode  - 'array' or 'linear'
 *   @param {Array}   [tickOverride.tickvals]
 *   @param {Array}   [tickOverride.ticktext]
 *   @param {number}  [tickOverride.tick0]
 *   @param {number}  [tickOverride.dtick]
 */
function createColorbarLegend({ legendId, colormapUrl, minValue, maxValue, title, tickOverride }) {
  const legendContainer = document.getElementById(legendId);
  if (!legendContainer) {
    console.error(`Legend container '${legendId}' not found`);
    return;
  }

  hideOtherLegends(legendId);
  styleLegendContainer(legendContainer);

  fetch(colormapUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch colormap: ${colormapUrl}`);
      return res.text();
    })
    .then((colormapText) => {
      const colorscale = parseColormap(colormapText);

      const mob = window.innerWidth <= 768;

      const cbBase = {
        orientation: mob ? 'h' : 'v', len: 0.85,
        thickness: mob ? 15 : 20, tickformat: '.1f',
        x: 0.5, xanchor: 'center', y: 0.5, yanchor: 'middle'
      };

      const layout = {
        title: {
          text: title,
          font: { size: mob ? 11 : 14, family: 'Arial, sans-serif', color: '#333' }
        },
        width: mob ? 280 : 120,
        height: mob ? 70 : 280,
        margin: mob ? { l: 10, r: 10, t: 25, b: 0 } : { l: 0, r: 30, t: 40, b: 20 },
        xaxis: { visible: false },
        yaxis: { visible: false },
        coloraxis: { colorbar: { ...cbBase } }
      };

      // Build colorbar tick config
      const tickConfig = tickOverride || {
        tickmode: 'linear',
        tick0: minValue,
        dtick: (maxValue - minValue) / 5
      };

      const legendData = {
        z: [[minValue, maxValue]],
        type: 'heatmap',
        colorscale: colorscale,
        showscale: true,
        hoverinfo: 'none',
        opacity: 0,
        colorbar: { ...cbBase, ...tickConfig }
      };

      // Clear and render
      legendContainer.innerHTML = '';

      Plotly.newPlot(legendId, [legendData], layout, { displayModeBar: false })
        .then(() => {
          legendContainer.style.display = 'block';
        })
        .catch(err => {
          console.error(`Error creating Plotly legend for '${legendId}':`, err);
        });
    })
    .catch((err) => {
      console.error(`Error loading legend colormap from ${colormapUrl}:`, err);
      legendContainer.style.display = 'none';
    });
}

export { createColorbarLegend, parseColormap, hideOtherLegends };
