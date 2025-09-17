#!/usr/bin/env python
# coding: utf-8

import xarray as xr
import numpy as np
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy
from matplotlib.patches import Rectangle
import json
import pandas as pd
import os
import glob
import subprocess
import re
import cftime

# Grab all monthly files
base_dir = '/vast/clidex/data/obs/SSS/SMAP/SMAP_RSS_v6.0/data'
all_files = glob.glob(os.path.join(base_dir, 'monthly/*.nc'))

# Filter for files with years 2015 and later
monthly_files = sorted([
    f for f in all_files
    if (match := re.search(r'(\d{4})', os.path.basename(f))) and int(match.group(1)) >= 2015
])

monthly_sss = xr.open_mfdataset(monthly_files, combine='by_coords')['sss_smap_40km']

# Subset to match bounds
lat_range = slice(20, 50)
lon_range = slice(275, 320)
monthly_sss = monthly_sss.sel(lat=lat_range, lon=lon_range)

# Load climatology
climatology = 'SMAP_SSS_monthly_climatology_2016_04_2024_03.nc'
clim_da = xr.open_dataset(os.path.join(base_dir, climatology), decode_times=False)['sss_smap_40km']

# Replace float time with month-aligned datetime64 values
clim_da['time'] = pd.date_range('2000-01-01', periods=12, freq='MS') + pd.Timedelta(days=14)

# Define regions
regions = {
    'OC': {'lon': (290, 290.5), 'lat': (41.5, 42.3), 'name': 'Outer Cape'},
    'IC': {'lon': (289.5, 290), 'lat': (41.7, 42.3), 'name': 'Inner Cape'},
    'GoM': {'lon': (289, 292), 'lat': (42, 44), 'name': 'Gulf of Maine'},
    'RI': {'lon': (288, 289.75), 'lat': (40.5, 41.5), 'name': 'Rhode Island'},
    'NJ': {'lon': (286.5, 287), 'lat': (39.25, 40.25), 'name': 'New Jersey'}
}

time_series = {}

for region, coords in regions.items():
    # slice region
    sss_region = monthly_sss.sel(
        lon=slice(coords['lon'][0], coords['lon'][1]),
        lat=slice(coords['lat'][0], coords['lat'][1])
    ).mean(dim=('lat', 'lon')).compute()

    # slice climatology
    clim_region = clim_da.sel(
        lon=slice(coords['lon'][0], coords['lon'][1]),
        lat=slice(coords['lat'][0], coords['lat'][1])
    ).mean(dim=('lat', 'lon')).compute()

    # convert climatology to month-based indexing
    clim_monthly = clim_region.assign_coords(month=clim_region['time'].dt.month)
    clim_monthly = clim_monthly.swap_dims({'time': 'month'}).drop_vars('time')

    # compute anomaly
    sssa = sss_region.groupby('time.month') - clim_monthly

    # Format raw SSS for JSON (safe string keys and float values)
    sss_dict = {
        str(np.datetime_as_string(t, unit='D')): float(v) if np.isfinite(v) else None
        for t, v in zip(sss_region.time.values, sss_region.values)
    }

    # Format SSS anomalies for JSON (safe string keys and float values)
    sssa_dict = {
        str(np.datetime_as_string(t, unit='D')): float(v) if np.isfinite(v) else None
        for t, v in zip(sssa.time.values, sssa.values)
    }

    # Store in dictionary
    time_series[region] = {
        'sss': sss_dict,
        'sssa': sssa_dict,
        'name': coords['name']
    }

# Write to JSON
output_path = '/vast/clidex/data/obs/CCCFA/processed_data/SSS/time_series/sss_timeseries.json'
with open(output_path, 'w') as f:
    json.dump(time_series, f)


# In[ ]:




