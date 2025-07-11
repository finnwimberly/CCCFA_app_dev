// Function to load metadata from the CSV and filter profiles by date
function loadProfilesMetadata(startDate, endDate, dataType = 'CTD') {
  const metadataPath = dataType === 'CTD' 
    ? '../data/CTD_profiles/metadata.csv'
    : '../data/EMOLT/metadata.csv';

  console.log(`Loading ${dataType} profiles from:`, metadataPath);
  console.log('Date range:', startDate, 'to', endDate);

  // Parse input dates with explicit format
  const parsedStartDate = moment(startDate, 'YYYY-MM-DD');
  const parsedEndDate = moment(endDate, 'YYYY-MM-DD');

  return new Promise((resolve, reject) => {
    Papa.parse(metadataPath, {
      download: true,
      header: true,
      complete: (results) => {
        console.log(`Loaded ${results.data.length} ${dataType} profiles`);
        const filteredProfiles = results.data.filter((profile) => {
          // Parse profile date with explicit format (assuming it's in YYYY-MM-DD format in the CSV)
          const profileDate = moment(profile['Date'], 'YYYY-MM-DD');
          return profileDate.isBetween(parsedStartDate, parsedEndDate, 'day', '[]');
        });
        console.log(`Filtered to ${filteredProfiles.length} profiles in date range`);
        resolve(filteredProfiles);
      },
      error: (error) => {
        console.error('Error loading profile metadata:', error);
        reject(error);
      },
    });
  });
}

// Function to load measurement data from a CSV for a specific profile ID
function loadMeasurementData(profileId, dataType = 'CTD') {
  const measurementsPath = dataType === 'CTD'
    ? `../data/CTD_profiles/${profileId}_measurements.csv`
    : `../data/EMOLT/${profileId}_measurements.csv`;

  console.log(`Loading measurements from: ${measurementsPath}`);  // Add logging to help debug

  return new Promise((resolve, reject) => {
    Papa.parse(measurementsPath, {
      download: true,
      header: true,
      complete: (results) => {
        const measurements = {
          temperature: [],
          depth: [],
        };

        // For CTD data, add salinity and density
        if (dataType === 'CTD') {
          measurements.salinity = [];
          measurements.density = [];
        }

        results.data.forEach((row) => {
          if (dataType === 'CTD') {
            // Handle CTD data format
            if (row['Temperature (°C)'] && row['Sea Pressure (dbar)']) {
              measurements.temperature.push(parseFloat(row['Temperature (°C)']));
              measurements.depth.push(parseFloat(row['Sea Pressure (dbar)']));
              measurements.salinity.push(parseFloat(row['Practical Salinity (PSU)']));
              measurements.density.push(parseFloat(row['Density (kg/m-3)']));
            }
          } else {
            // Handle EMOLT data format
            if (row['Temperature (°C)'] && row['Depth (m)']) {
              measurements.temperature.push(parseFloat(row['Temperature (°C)']));
              measurements.depth.push(parseFloat(row['Depth (m)']));
            }
          }
        });

        resolve(measurements);
      },
      error: (error) => {
        console.error('Error loading measurement data:', error);
        reject(error);
      },
    });
  });
}
export { loadProfilesMetadata, loadMeasurementData };

