import pandas as pd
import os

# Define the URL
url = 'https://erddap.ondeckdata.com/erddap/tabledap/shelf_fleet_profiles_1m_binned.htmlTable?sea_pressure%2Clatitude%2Clongitude%2Ctemperature%2Cconductivity%2Cchlorophyll%2Cdescent_rate%2Cacceleration%2Cpractical_salinity%2Cabsolute_salinity%2Cconservative_temperature%2Cdensity%2Cprofile_id%2Cproject_id%2Ctime&project_id=%22cccfa_outer_cape%22&time>=2024-08-01T00%3A00%3A00Z'

# Read the HTML table
temp_df = pd.read_html(url)
df = temp_df[1]

df.columns = ['{}_{}'.format(col[0], col[1]) for col in df.columns]

# Create a dictionary to hold DataFrames for each profile_id
processed_data = {}
metadata = {}

columns_of_interest = [
    'sea_pressure_dbar', 
    'temperature_degree_C', 
    'practical_salinity_PSU', 
    'density_kg/m-3',
    'latitude_degrees_north', 
    'longitude_degrees_east', 
    'profile_id_Unnamed: 12_level_1'
]

# Group the data by profile_id and create a DataFrame for each
for profile in df['profile_id_Unnamed: 12_level_1'].unique():
    # Filter the DataFrame for the current profile_id
    df_filtered = df[df['profile_id_Unnamed: 12_level_1'] == profile][columns_of_interest]

    # Create a new DataFrame with only the measurements
    measurements_df = df_filtered[['sea_pressure_dbar', 'temperature_degree_C', 'practical_salinity_PSU', 'density_kg/m-3']]
    measurements_df.columns = ['Sea Pressure (dbar)', 'Temperature (°C)', 'Practical Salinity (PSU)', 'Density (kg/m-3)']
    measurements_df.set_index('Sea Pressure (dbar)', inplace=True)
    
    # Store metadata
    latitude = df_filtered['latitude_degrees_north'].iloc[0]
    longitude = df_filtered['longitude_degrees_east'].iloc[0]
    
    # Extract the date from the Profile ID (third string of numbers)
    # Assuming Profile ID format: 323_235354_20240912_1247
    date_str = profile.split('_')[2]  # Extract '20240912'
    date_formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"  # Format as 'YYYY-MM-DD'

    # Store metadata in a separate dictionary or variable
    metadata[profile] = {
        'Latitude': latitude,
        'Longitude': longitude,
        'Profile ID': profile,
        'Date': date_formatted  # Add the date to the metadata
    }

    # Store the measurements DataFrame in the dictionary
    processed_data[profile] = measurements_df

# Define the directory where you want to save the files
output_dir = '/vast/clidex/data/obs/CCCFA/processed_data/CTD_profiles'
os.makedirs(output_dir, exist_ok=True)

# Create a list to store metadata entries
metadata_list = []

# Save each profile's data and gather metadata
for profile in processed_data.keys():
    # Save the measurements DataFrame to a CSV file
    measurements_df = processed_data[profile]
    measurements_filename = f"{output_dir}/{profile}_measurements.csv"
    measurements_df.to_csv(measurements_filename, index=True)

    # Append metadata to the list
    metadata_list.append({
        'Profile ID': profile,
        'Latitude': metadata[profile]['Latitude'],
        'Longitude': metadata[profile]['Longitude'],
        'Date' : metadata[profile]['Date'],
        'File Name': measurements_filename
    })

# Create a DataFrame from the metadata list
metadata_df = pd.DataFrame(metadata_list)

# Save the metadata DataFrame to a CSV file
metadata_filename = f"{output_dir}/metadata.csv"
metadata_df.to_csv(metadata_filename, index=False)
