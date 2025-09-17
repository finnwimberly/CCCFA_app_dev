#!/usr/bin/env python
# coding: utf-8

# In[24]:


from erddapy import ERDDAP
import pandas as pd
import os
import random

# Initialize ERDDAP server connection
e = ERDDAP(
    server='https://erddap.ondeckdata.com/erddap',
    protocol='tabledap'
)

# Set the dataset ID (this is the tabledap ID, which should match exactly)
e.dataset_id = 'fishbot_realtime'

# Set filters correctly (no extra quotes around string values)
e.constraints = {
    'time>=': '2024-08-01T00:00:00Z'
}

# Choose variables to retrieve
e.variables = {
    'time': 'time',
    'latitude': 'latitude', 
    'longitude': 'longitude',
    'temperature': 'temperature',
    'dissolved_oxygen': 'dissolved_oxygen',
    'salinity': 'salinity',
    'depth': 'depth',
    'data_provider': 'data_provider',
    'grid_id': 'grid_id',
    'stat_area': 'stat_area',
    'fishery_dependent': 'fishery_dependent'
}

# Convert to pandas DataFrame
df = e.to_pandas(parse_dates=True)

df.columns = df.columns.str.strip().str.replace(r"\s*\(.*\)", "", regex=True).str.lower()

# Optional: Convert columns to numeric types (safely handle mixed types)
for col in ['latitude', 'longitude', 'depth', 'temperature', 'dissolved_oxygen', 'salinity']:
    df[col] = pd.to_numeric(df[col], errors='coerce')

#df


# In[52]:


# Define the directory where you want to save the files
output_dir = '/vast/clidex/data/obs/CCCFA/processed_data/FIShBOT'
os.makedirs(output_dir, exist_ok=True)

filename = f"{output_dir}/fishbot.csv"

df.to_csv(filename, index=False)