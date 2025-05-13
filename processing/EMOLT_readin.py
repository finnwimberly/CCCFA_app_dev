#!/usr/bin/env python
# coding: utf-8

# This notebook develops an automated workflow for reading in ERDDAP research fleet data sets (both CCCFA and Shelf fleet). The code will be used as template for WHOI/CCCFA joint collection efforts. 
# 
# Last update: 20 Feb 2025 | FFW

# In[1]:


import erddapy
print(erddapy.__version__)


# In[2]:


from erddapy import ERDDAP
import pandas as pd
import os

# Initialize ERDDAP server connection
e = ERDDAP(
    server='https://erddap.ondeckdata.com/erddap',
    protocol='tabledap'
)

# Set the dataset ID (this is the tabledap ID, which should match exactly)
e.dataset_id = 'emolt_data'

# Set filters correctly (no extra quotes around string values)
e.constraints = {
    'time>=': '2024-08-01T00:00:00Z',
    'segment_type=': 'Profiling Down',
}

# Choose variables to retrieve
e.variables = [
    'time',
    'latitude',
    'longitude',
    'depth',
    'temperature',
    'segment_type',
    'tow_id'
]

# Convert to pandas DataFrame
df = e.to_pandas(parse_dates=True)

df.columns = df.columns.str.strip().str.replace(r"\s*\(.*\)", "", regex=True).str.lower()

# Optional: Convert columns to numeric types (safely handle mixed types)
for col in ['latitude', 'longitude', 'depth', 'temperature']:
    df[col] = pd.to_numeric(df[col], errors='coerce')

#df.head()


# In[3]:


#Fix column names
#df.columns = ['_'.join(col).strip() if isinstance(col, tuple) else col for col in df.columns]

#Ensure datetime
df.loc[:, 'time'] = pd.to_datetime(df['time'])


# In[4]:


# Create a dictionary to hold DataFrames for each tow_id (profile)
processed_data = {}
metadata = {}

columns_of_interest = [
    'depth', 
    'temperature', 
    'latitude', 
    'longitude', 
    'tow_id',
    'time'
]

# Group the data by tow_id (which replaces profile_id)
for tow_id in df['tow_id'].unique():
    # Filter the DataFrame for the current tow_id
    df_filtered = df[df['tow_id'] == tow_id][columns_of_interest]

    # Create a new DataFrame with only the measurements
    measurements_df = df_filtered[['depth', 'temperature']]
    measurements_df.columns = ['Depth (m)', 'Temperature (°C)']
    measurements_df.set_index('Depth (m)', inplace=True)
    
    # Store metadata
    latitude = df_filtered['latitude'].iloc[0]
    longitude = df_filtered['longitude'].iloc[0]

    # Extract the date from time_UTC
    date_formatted = df_filtered['time'].iloc[0].strftime('%Y-%m-%d')  # Convert datetime to 'YYYY-MM-DD'

    # Store metadata in a dictionary
    metadata[tow_id] = {
        'Latitude': latitude,
        'Longitude': longitude,
        'Tow ID': tow_id,
        'Date': date_formatted  # Extracted from time_UTC
    }

    # Store the measurements DataFrame in the dictionary
    processed_data[tow_id] = measurements_df


# In[ ]:


# Define the directory where you want to save the files
output_dir = '/vast/clidex/data/obs/CCCFA/processed_data/EMOLT'
os.makedirs(output_dir, exist_ok=True)

# Create a list to store metadata entries
metadata_list = []

# Save each profile's data and gather metadata
for tow_id in processed_data.keys():
    # Save the measurements DataFrame to a CSV file
    measurements_df = processed_data[tow_id]
    measurements_filename = f"{output_dir}/{tow_id}_measurements.csv"
    measurements_df.to_csv(measurements_filename, index=True)

    # Append metadata to the list
    metadata_list.append({
        'Profile ID': tow_id,
        'Latitude': metadata[tow_id]['Latitude'],
        'Longitude': metadata[tow_id]['Longitude'],
        'Date' : metadata[tow_id]['Date'],
        'File Name': measurements_filename
    })

# Create a DataFrame from the metadata list
metadata_df = pd.DataFrame(metadata_list)

# Save the metadata DataFrame to a CSV file
metadata_filename = f"{output_dir}/metadata.csv"
metadata_df.to_csv(metadata_filename, index=False)


# In[ ]:




