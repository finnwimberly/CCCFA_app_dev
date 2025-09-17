import xarray as xr
import numpy as np
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy
from matplotlib.patches import Rectangle
import json
#from geopy.distance import great_circle
import os
import glob
import subprocess
import re

# Grab all daily files
all_files = glob.glob('/vast/clidex/data/obs/SST/OSTIA/data/daily/*.nc')
# Filter for files with years 2025 and later
daily_files = sorted([
    f for f in all_files
    if (match := re.search(r'(\d{4})', os.path.basename(f))) and int(match.group(1)) >= 2025
])

base_path = '/vast/clidex/data/obs/SST/OSTIA/data/METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2_multi-vars_84.97W-40.03W_20.02N-49.97N_2007-01-01-2024-12-31.nc'
# Load
base_sst = xr.open_dataset(base_path)['analysed_sst']
daily_sst = xr.open_mfdataset(daily_files, combine='by_coords')['analysed_sst']

#Subset daily to match bounds of 07-24
# Define region bounds from base_sst
lat_range = slice(20, 50)
lon_range = slice(-85, -40)
daily_sst = daily_sst.sel(latitude=lat_range, longitude=lon_range)

combined_sst = xr.concat([base_sst, daily_sst], dim='time')

# Define regions
regions = {
    'OC': {'lon': (-70, -69.5), 'lat': (41.5, 42.3), 'name': 'Outer Cape'},
    'IC': {'lon': (-70.5, -70), 'lat': (41.7, 42.3), 'name': 'Inner Cape'},
    'GoM': {'lon': (-71, -68), 'lat': (42, 44), 'name': 'Gulf of Maine'},
    'RI': {'lon': (-72, -70.75), 'lat': (40.5, 41.5), 'name': 'Rhode Island'},
    'NJ': {'lon': (-74.5, -73), 'lat': (39.25, 40.25), 'name': 'New Jersey'}
}
# Initialize dictionary
time_series = {}
for region, coords in regions.items():
    # Compute regional daily mean (sliced, averaged, then computed)
    sst = combined_sst.sel(
        longitude=slice(coords['lon'][0], coords['lon'][1]),
        latitude=slice(coords['lat'][0], coords['lat'][1])
    ).mean(dim=('latitude', 'longitude')).compute()
    # Compute anomalies after loading the data
    ssta = sst.groupby('time.dayofyear') - sst.groupby('time.dayofyear').mean('time')
    
    # Convert Kelvin to Celsius and format SST for JSON (safe string keys and float values)
    sst_dict = {
        str(np.datetime_as_string(t, unit='D')): float(v - 273.15) if np.isfinite(v) else None
        for t, v in zip(sst.time.values, sst.values)
    }
    
    # Format SST anomalies for JSON (safe string keys and float values)
    # Note: anomalies are already in temperature units (Celsius) since they're differences
    ssta_dict = {
        str(np.datetime_as_string(t, unit='D')): float(v) if np.isfinite(v) else None
        for t, v in zip(ssta.time.values, ssta.values)
    }
    
    # Store in dictionary
    time_series[region] = {
        'sst': sst_dict,
        'ssta': ssta_dict,
        'name': coords['name']
    }

    # Write to JSON
output_path = '/vast/clidex/data/obs/CCCFA/processed_data/OSTIA_SST/time_series/sst_timeseries.json'
with open(output_path, 'w') as f:
    json.dump(time_series, f)
#print(f"Dashboard-ready SST anomaly time series written to: {output_path}")