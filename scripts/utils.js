// Generate unique colors for profiles using HSL
function generateColor(index) {
    const hue = (index * 137.5) % 360; // Use golden ratio to spread colors evenly
    return `hsl(${hue}, 70%, 50%)`;
  }
  
  // Convert temperature units (Celsius to Fahrenheit or vice versa)
  function convertTemperature(value, fromUnit, toUnit) {
    if (fromUnit === 'C' && toUnit === 'F') {
      return (value * 9) / 5 + 32;
    } else if (fromUnit === 'F' && toUnit === 'C') {
      return ((value - 32) * 5) / 9;
    }
    return value; // Return unchanged if no conversion is needed
  }
  
  // Convert depth units (meters to fathoms or vice versa)
  function convertDepth(value, fromUnit, toUnit) {
    if (fromUnit === 'm' && toUnit === 'ftm') {
      return value * 0.546807; // 1 meter = 0.546807 fathoms
    } else if (fromUnit === 'ftm' && toUnit === 'm') {
      return value / 0.546807;
    }
    return value; // Return unchanged if no conversion is needed
  }
  
  // Format a date string for display
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  
  // Calculate average of an array
  function calculateAverage(values) {
    if (!values.length) return null;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }
  
  // Get a subset of an array based on start and end indices
  function getArraySubset(array, start, end) {
    return array.slice(start, end);
  }
  
  // Calculate surface and bottom temperatures
  function calculateSurfaceAndBottomTemps(measurements, topCount = 5, bottomCount = 5) {
    const { temperature } = measurements;
  
    const topTemps = getArraySubset(temperature, -topCount); // Last `topCount` values
    const bottomTemps = getArraySubset(temperature, 0, bottomCount); // First `bottomCount` values
  
    return {
      surfaceTemp: calculateAverage(topTemps),
      bottomTemp: calculateAverage(bottomTemps),
    };
  }
  
  // Calculate depth range
  function calculateDepthRange(measurements, unitSystem = 'metric') {
    const { depth } = measurements;
  
    const surfaceDepth = depth[depth.length - 1]; // Shallowest depth
    const bottomDepth = depth[0]; // Deepest depth
  
    return {
      surfaceDepth: unitSystem === 'imperial' ? convertDepth(surfaceDepth, 'm', 'ftm') : surfaceDepth,
      bottomDepth: unitSystem === 'imperial' ? convertDepth(bottomDepth, 'm', 'ftm') : bottomDepth,
    };
  }
  
  export {
    generateColor,
    convertTemperature,
    convertDepth,
    formatDate,
    calculateAverage,
    calculateSurfaceAndBottomTemps,
    calculateDepthRange,
  };