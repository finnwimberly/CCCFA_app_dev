#!/usr/bin/env python
# coding: utf-8

# In[1]:


import pandas as pd
import os

# Define the URL
url = 'https://erddap.ondeckdata.com/erddap/tabledap/shelf_fleet_profiles_1m_binned.htmlTable?sea_pressure%2Clatitude%2Clongitude%2Ctemperature%2Cconductivity%2Cchlorophyll%2Cdescent_rate%2Cacceleration%2Cpractical_salinity%2Cabsolute_salinity%2Cconservative_temperature%2Cdensity%2Cprofile_id%2Cproject_id%2Ctime&time>=2024-08-01T00%3A00%3A00Z'

# Read the HTML table
temp_df = pd.read_html(url)
df = temp_df[1]

df.columns = ['{}_{}'.format(col[0], col[1]) for col in df.columns]

# # Create a dictionary to hold DataFrames for each profile_id
# processed_data = {}
# metadata = {}

# columns_of_interest = [
#     'sea_pressure_dbar', 
#     'temperature_degree_C', 
#     'practical_salinity_PSU', 
#     'density_kg/m-3',
#     'latitude_degrees_north', 
#     'longitude_degrees_east', 
#     'profile_id_Unnamed: 12_level_1',
#     'project_id_Unnamed: 13_level_1'
# ]

# # Group the data by profile_id and create a DataFrame for each
# for profile in df['profile_id_Unnamed: 12_level_1'].unique():
#     # Filter the DataFrame for the current profile_id
#     df_filtered = df[df['profile_id_Unnamed: 12_level_1'] == profile][columns_of_interest]

#     # Create a new DataFrame with only the measurements
#     measurements_df = df_filtered[['sea_pressure_dbar', 'temperature_degree_C', 'practical_salinity_PSU', 'density_kg/m-3']]
#     measurements_df.columns = ['Sea Pressure (dbar)', 'Temperature (°C)', 'Practical Salinity (PSU)', 'Density (kg/m-3)']
#     measurements_df.set_index('Sea Pressure (dbar)', inplace=True)
    
#     # Store metadata
#     latitude = df_filtered['latitude_degrees_north'].iloc[0]
#     longitude = df_filtered['longitude_degrees_east'].iloc[0]
    
#     # Extract the date from the Profile ID (third string of numbers)
#     # Assuming Profile ID format: 323_235354_20240912_1247
#     date_str = profile.split('_')[2]  # Extract '20240912'
#     date_formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"  # Format as 'YYYY-MM-DD'

#     group = df_filtered['project_id_Unnamed: 13_level_1'].iloc[0]

#     # Store metadata in a separate dictionary or variable
#     metadata[profile] = {
#         'Latitude': latitude,
#         'Longitude': longitude,
#         'Profile ID': profile,
#         'Date': date_formatted,
#         'Group' : group
#     }

#     # Store the measurements DataFrame in the dictionary
#     processed_data[profile] = measurements_df

# # Define the directory where you want to save the files
# output_dir = '/vast/clidex/data/obs/CCCFA/processed_data/CTD_profiles'
# os.makedirs(output_dir, exist_ok=True)

# #Define regions
# region_bounds = {
#     'GoM': {'lat': [42, 44], 'lon': [-71, -68]},      # Gulf of Maine
#     'OC':  {'lat': [41.5, 42.3], 'lon': [-70, -69.5]},  # Outer Cape
#     'IC':  {'lat': [41.7, 42.33], 'lon': [-70.5, -70]},  # Outer Cape
#     'RI':  {'lat': [40.5, 41.5], 'lon': [-72, -70.75]}, # Rhode Island
#     'NJ':  {'lat': [39.25, 40.25], 'lon': [-74.5, -73]} # New Jersey
# }

# # Updated function to return all matching regions
# def get_regions(lat, lon):
#     matching_regions = []
#     for region, bounds in region_bounds.items():
#         if (bounds['lat'][0] <= lat <= bounds['lat'][1] and 
#             bounds['lon'][0] <= lon <= bounds['lon'][1]):
#             matching_regions.append(region)
#     return matching_regions if matching_regions else ['Unknown']

# # Prepare metadata list
# metadata_list = []

# for profile in processed_data.keys():
#     lat = metadata[profile]['Latitude']
#     lon = metadata[profile]['Longitude']
    
#     # Determine regions (can be multiple)
#     regions = get_regions(lat, lon)
#     regions_str = ', '.join(regions)
    
#     # Get month from date
#     date = metadata[profile]['Date']
#     month = pd.to_datetime(date).strftime('%B')
    
#     # File path for the measurement CSV
#     file_path = f"{output_dir}/{profile}_measurements.csv"
    
#     # Save measurements CSV
#     processed_data[profile].to_csv(file_path)
    
#     # Add metadata entry
#     metadata_list.append({
#         'Profile ID': profile,
#         'Latitude': lat,
#         'Longitude': lon,
#         'Date': date,
#         'Group': metadata[profile]['Group'],
#         'Regions': regions_str,  # Note plural here
#         'Month': month,
#         'File Name': file_path
#     })

# # Save combined metadata CSV
# metadata_df = pd.DataFrame(metadata_list)
# metadata_filename = f"{output_dir}/metadata.csv"
# metadata_df.to_csv(metadata_filename, index=False)

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
    'profile_id_Unnamed: 12_level_1',
    'project_id_Unnamed: 13_level_1',
    'time_UTC'
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
    
    #ARCHIVED PROFILE ID STRUCTURES
    # Extract the date from the Profile ID (third string of numbers)
    # Assuming Profile ID format: 323_235354_20240912_1247
    # date_str = profile.split('_')[2]  # Extract '20240912'
    # date_formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"  # Format as 'YYYY-MM-DD'

    #NEW PROFILE ID STRUCTURE
    time0 = pd.to_datetime(df_filtered['time_UTC'], utc=True).min()
    date_formatted = time0.date().isoformat()  

    group = df_filtered['project_id_Unnamed: 13_level_1'].iloc[0]

    # Store metadata in a separate dictionary or variable
    metadata[profile] = {
        'Latitude': latitude,
        'Longitude': longitude,
        'Profile ID': profile,
        'Date': date_formatted,
        'Group' : group
    }

    # Store the measurements DataFrame in the dictionary
    processed_data[profile] = measurements_df

# Define the directory where you want to save the files
output_dir = '/vast/clidex/data/obs/CCCFA/processed_data/CTD_profiles'
os.makedirs(output_dir, exist_ok=True)

#Define regions
region_bounds = {
    'GoM': {'lat': [42, 44], 'lon': [-71, -68]},      # Gulf of Maine
    'OC':  {'lat': [41.5, 42.3], 'lon': [-70, -69.5]},  # Outer Cape
    'IC':  {'lat': [41.7, 42.33], 'lon': [-70.5, -70]},  # Outer Cape
    'RI':  {'lat': [40.5, 41.5], 'lon': [-72, -70.75]}, # Rhode Island
    'NJ':  {'lat': [39.25, 40.25], 'lon': [-74.5, -73]} # New Jersey
}

# Updated function to return all matching regions
def get_regions(lat, lon):
    matching_regions = []
    for region, bounds in region_bounds.items():
        if (bounds['lat'][0] <= lat <= bounds['lat'][1] and 
            bounds['lon'][0] <= lon <= bounds['lon'][1]):
            matching_regions.append(region)
    return matching_regions if matching_regions else ['Unknown']

# Prepare metadata list
metadata_list = []

for profile in processed_data.keys():
    lat = metadata[profile]['Latitude']
    lon = metadata[profile]['Longitude']
    
    # Determine regions (can be multiple)
    regions = get_regions(lat, lon)
    regions_str = ', '.join(regions)
    
    # Get month from date
    date = metadata[profile]['Date']
    month = pd.to_datetime(date).strftime('%B')
    
    # File path for the measurement CSV
    file_path = f"{output_dir}/{profile}_measurements.csv"
    
    # Save measurements CSV
    processed_data[profile].to_csv(file_path)
    
    # Add metadata entry
    metadata_list.append({
        'Profile ID': profile,
        'Latitude': lat,
        'Longitude': lon,
        'Date': date,
        'Group': metadata[profile]['Group'],
        'Regions': regions_str,  # Note plural here
        'Month': month,
        'File Name': file_path
    })

# Save combined metadata CSV
metadata_df = pd.DataFrame(metadata_list)
metadata_filename = f"{output_dir}/metadata.csv"
metadata_df.to_csv(metadata_filename, index=False)