// Function to load metadata from the CSV and filter profiles by date
function loadProfilesMetadata(startDate, endDate) {
  return new Promise((resolve, reject) => {
    Papa.parse('../data/CTD_profiles/metadata.csv', {
      download: true,
      header: true,
      complete: (results) => {
        const filteredProfiles = results.data.filter((profile) => {
          const profileDate = moment(profile['Date']);
          return profileDate.isBetween(startDate, endDate, 'day', '[]');
        });

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
function loadMeasurementData(profileId) {
  return new Promise((resolve, reject) => {
    const filePath = `../data/CTD_profiles/${profileId}_measurements.csv`;

    Papa.parse(filePath, {
      download: true,
      header: true,
      complete: (results) => {
        const measurements = {
          temperature: [],
          salinity: [],
          density: [],
          depth: [],
        };

        results.data.forEach((row) => {
          measurements.temperature.push(parseFloat(row['Temperature (°C)']));
          measurements.salinity.push(parseFloat(row['Practical Salinity (PSU)']));
          measurements.density.push(parseFloat(row['Density (kg/m-3)']));
          measurements.depth.push(parseFloat(row['Sea Pressure (dbar)']));
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
