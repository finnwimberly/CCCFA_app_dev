# import xarray as xr
# import numpy as np
# import matplotlib.pyplot as plt
# import cartopy.crs as ccrs
# import cartopy
# from matplotlib.patches import Rectangle
# import json
# #from geopy.distance import great_circle
# import os
# import glob
# import subprocess
# import re

# # Grab all daily files
# all_files = glob.glob('/vast/clidex/data/obs/SST/OSTIA/data/daily/*.nc')
# # Filter for files with years 2025 and later
# daily_files = sorted([
#     f for f in all_files
#     if (match := re.search(r'(\d{4})', os.path.basename(f))) and int(match.group(1)) >= 2025
# ])

# base_path = '/vast/clidex/data/obs/SST/OSTIA/data/METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2_multi-vars_84.97W-40.03W_20.02N-49.97N_2007-01-01-2024-12-31.nc'
# # Load
# base_sst = xr.open_dataset(base_path)['analysed_sst']
# daily_sst = xr.open_mfdataset(daily_files, combine='by_coords')['analysed_sst']

# #Subset daily to match bounds of 07-24
# # Define region bounds from base_sst
# lat_range = slice(20, 50)
# lon_range = slice(-85, -40)
# daily_sst = daily_sst.sel(latitude=lat_range, longitude=lon_range)

# combined_sst = xr.concat([base_sst, daily_sst], dim='time')

# # Define regions
# regions = {
#     'OC': {'lon': (-70, -69.5), 'lat': (41.5, 42.3), 'name': 'Outer Cape'},
#     'IC': {'lon': (-70.5, -70), 'lat': (41.7, 42.3), 'name': 'Inner Cape'},
#     'GoM': {'lon': (-71, -68), 'lat': (42, 44), 'name': 'Gulf of Maine'},
#     'RI': {'lon': (-72, -70.75), 'lat': (40.5, 41.5), 'name': 'Rhode Island'},
#     'NJ': {'lon': (-74.5, -73), 'lat': (39.25, 40.25), 'name': 'New Jersey'}
# }
# # Initialize dictionary
# time_series = {}
# for region, coords in regions.items():
#     # Regional daily mean -> ensure it's strictly 1D over time
#     sst = combined_sst.sel(
#         longitude=slice(coords['lon'][0], coords['lon'][1]),
#         latitude=slice(coords['lat'][0], coords['lat'][1])
#     ).mean(dim=('latitude', 'longitude')).squeeze(drop=True).compute()

#     # DOY climatology
#     clim_doy = sst.groupby('time.dayofyear').mean('time')

#     # Date-aligned climatology (same time dim as sst) — no .transform in older xarray
#     clim_aligned = sst.groupby('time.dayofyear').map(lambda g: g.mean('time')).squeeze(drop=True)

#     # Anomalies
#     ssta = (sst - clim_aligned).squeeze(drop=True)

#     # --- Helpers for safe JSON serialization ---
#     def da_to_dict(da, *, celsius=False):
#         """Convert a 1D DataArray(time) to {YYYY-MM-DD: float or None}."""
#         da1d = da.squeeze(drop=True)
#         # Kelvin->C if requested
#         vals = (da1d - 273.15).values if celsius else da1d.values
#         times = da1d['time'].values
#         return {
#             str(np.datetime_as_string(t, unit='D')): float(v) if np.isfinite(v) else None
#             for t, v in zip(times, vals)
#         }

#     # Build dicts (note: ssta is already in °C units as differences)
#     sst_dict = da_to_dict(sst, celsius=True)
#     ssta_dict = da_to_dict(ssta, celsius=False)          # anomaly (°C)
#     clim_aligned_dict = da_to_dict(clim_aligned, celsius=True)

#     time_series[region] = {
#         'name': coords['name'],
#         'sst': sst_dict,            # absolute SST [°C]
#         'ssta': ssta_dict,          # anomaly [°C]
#         'clim': clim_aligned_dict   # per-date baseline [°C]
#     }

# # Write to JSON
# output_path = '/vast/clidex/data/obs/CCCFA/processed_data/OSTIA_SST/time_series/sst_timeseries.json'
# with open(output_path, 'w') as f:
#     json.dump(time_series, f)
# #print(f"Dashboard-ready SST anomaly time series written to: {output_path}")

import xarray as xr
import numpy as np
import json
import os
import glob
import re

# Grab all daily files from 2025 onwards
all_files = glob.glob('/vast/clidex/data/obs/SST/OSTIA/data/daily/*.nc')
daily_files = sorted([
    f for f in all_files
    if (match := re.search(r'(\d{4})', os.path.basename(f))) and int(match.group(1)) >= 2025
])

# Load base (2007-2024) and daily (2025+) data
base_path = '/vast/clidex/data/obs/SST/OSTIA/data/METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2_multi-vars_84.97W-40.03W_20.02N-49.97N_2007-01-01-2024-12-31.nc'
base_sst = xr.open_dataset(base_path)['analysed_sst']
daily_sst = xr.open_mfdataset(daily_files, combine='by_coords')['analysed_sst']

# Subset daily to match base bounds
lat_range = slice(20, 50)
lon_range = slice(-85, -40)
daily_sst = daily_sst.sel(latitude=lat_range, longitude=lon_range)

# Combine time series
combined_sst = xr.concat([base_sst, daily_sst], dim='time')

# Define regions
regions = {
    'OC': {'lon': (-70, -69.5), 'lat': (41.5, 42.3), 'name': 'Outer Cape'},
    'IC': {'lon': (-70.5, -70), 'lat': (41.7, 42.3), 'name': 'Inner Cape'},
    'GoM': {'lon': (-71, -68), 'lat': (42, 44), 'name': 'Gulf of Maine'},
    'RI': {'lon': (-72, -70.75), 'lat': (40.5, 41.5), 'name': 'Rhode Island'},
    'NJ': {'lon': (-74.5, -73), 'lat': (39.25, 40.25), 'name': 'New Jersey'}
}

time_series = {}

for region, coords in regions.items():
    # Regional mean
    sst_region = combined_sst.sel(
        longitude=slice(coords['lon'][0], coords['lon'][1]),
        latitude=slice(coords['lat'][0], coords['lat'][1])
    ).mean(dim=('latitude', 'longitude')).compute()

    # Subset to 2007–2024 for climatology
    sst_base = sst_region.sel(time=slice("2007-01-01", "2024-12-31"))

    # Compute baseline climatology (mean for each day-of-year)
    clim_doy = sst_base.groupby("time.dayofyear").mean("time")

    # Compute anomalies for full time series (broadcast baseline)
    ssta = sst_region.groupby("time.dayofyear") - clim_doy

    # Align baseline to each timestamp (same as before)
    clim_aligned = sst_region - ssta
    
    # Convert Kelvin to Celsius
    sst_c = sst_region - 273.15
    clim_aligned_c = clim_aligned - 273.15
    
    # Format for JSON (SSTA already in °C as difference)
    sst_dict = {
        str(np.datetime_as_string(t, unit='D')): float(v) if np.isfinite(v) else None
        for t, v in zip(sst_c.time.values, sst_c.values)
    }
    ssta_dict = {
        str(np.datetime_as_string(t, unit='D')): float(v) if np.isfinite(v) else None
        for t, v in zip(ssta.time.values, ssta.values)
    }
    clim_dict = {
        str(np.datetime_as_string(t, unit='D')): float(v) if np.isfinite(v) else None
        for t, v in zip(clim_aligned_c.time.values, clim_aligned_c.values)
    }
    
    time_series[region] = {
        'name': coords['name'],
        'sst': sst_dict,     # absolute SST [°C]
        'ssta': ssta_dict,   # anomaly [°C]
        'clim': clim_dict    # per-date baseline [°C]
    }

# Write to JSON
output_path = '/vast/clidex/data/obs/CCCFA/processed_data/OSTIA_SST/time_series/sst_timeseries.json'
with open(output_path, 'w') as f:
    json.dump(time_series, f)

print(f"Dashboard-ready SST time series written to: {output_path}")