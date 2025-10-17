#!/usr/bin/env python
# coding: utf-8

# In[1]:


import xarray as xr
import numpy as np
import rasterio
import subprocess
from rasterio.transform import from_origin
from rasterio.transform import from_bounds
import matplotlib.pyplot as plt
import cmocean
import pyproj
import os
from pyproj import Transformer
import shutil
import json
from datetime import datetime
import re
from pathlib import Path
from rasterio.warp import calculate_default_transform, reproject, Resampling
from matplotlib.colors import Normalize


# In[2]:


# Define base directory
base_dir = '/home/finn.wimberly/Documents/CCCFA_app_dev/data'
raw_data_dir = '/vast/clidex/data/obs/SST/OSTIA/data/daily/'

# Create output directories
tiles_dir = os.path.join(base_dir, 'processed_data', 'OSTIA_SST', 'tiles')
os.makedirs(tiles_dir, exist_ok=True)

# Path for the temp_files directory
temp_files_dir = os.path.join(base_dir, 'processed_data', 'OSTIA_SST', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)


# In[3]:


# Get list of existing tile dates
existing_tiles = set()

for folder_name in os.listdir(tiles_dir):
    if os.path.isdir(os.path.join(tiles_dir, folder_name)) and folder_name.startswith('20'):
        # Convert tile folder name (e.g., "2024_211") to raw file format (e.g., "20240730")
        year, doy = folder_name.split('_')
        date_obj = datetime.strptime(f"{year} {doy}", "%Y %j")
        date_cleaned = date_obj.strftime("%Y%m%d")  # "YYYYMMDD" format
        existing_tiles.add(date_cleaned)

# Regular expression pattern to extract dates from filenames
date_pattern = re.compile(r"(\d{4}-\d{2}-\d{2})\.nc")

# Get list of raw data files to process
raw_files_to_process = []
date_cutoff = 20240801  # YYYYMMDD format cutoff date

for filename in os.listdir(raw_data_dir):
    if filename.endswith('.nc'):
        match = date_pattern.search(filename)
        if match:
            date_str = match.group(1)
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            date_cleaned = date_obj.strftime("%Y%m%d")  # "YYYYMMDD" format
            
            # Ensure it's not in existing tiles and meets the date threshold
            if date_cleaned not in existing_tiles and int(date_cleaned) >= date_cutoff:
                raw_files_to_process.append(filename)

# Output filtered file list
print("Files to process:")
print(raw_files_to_process)


# In[4]:


# Sort files by date
files = []
for filename in raw_files_to_process:
    match = date_pattern.search(filename)
    if match:
        date_str = match.group(1)
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        date_cleaned = date_obj.strftime("%Y%m%d")  # "YYYYMMDD" format
        date_int = int(date_cleaned)
        files.append((date_int, filename))

# Sort files by date (earliest first)
files.sort(key=lambda x: x[0])

# Define region of interest (North Atlantic, similar to SSS bounds)
bounds = {
    'min_lon': 274.93 - 360,
    'max_lon': 300.06 - 360,
    'min_lat': 22.10,
    'max_lat': 46.06
}

# Data dictionaries to store information
sst_data = {}
sst = {}
sst_subset = {}
sst_subset_masked = {}
sst_stats = {}

# Process SST files
for date_int, filename in files:
    file_path = os.path.join(raw_data_dir, filename)
    dict_key = f"{date_int}"
    date_str = filename.split('.')[0]  # For file naming
    
    print(f"\n==================== Processing {filename} ====================")
    
    # Open dataset
    sst_data[dict_key] = xr.open_dataset(file_path)
    sst[dict_key] = sst_data[dict_key]['analysed_sst'].squeeze()
    
    # Assign CRS if missing
    if 'crs' not in sst_data[dict_key].attrs:
        sst_data[dict_key] = sst_data[dict_key].rio.write_crs("EPSG:4326")
    
    # Extract latitude and longitude values
    lat_values = sst_data[dict_key]['latitude'].values
    lon_values = sst_data[dict_key]['longitude'].values
    
    # Check if longitude is in -180 to 180 range and convert to 0 to 360 range if needed
    if np.any(lon_values < 0):
        print(f"Converting longitudes from -180/180 to 0/360 range for {filename}")
        sst_data[dict_key] = sst_data[dict_key].assign_coords(
            longitude=(((sst_data[dict_key]['longitude'] + 180) % 360) - 180)
        )
    
    # Ensure bounds are in the same format as the data
    region_bounds = {
        'min_lon': bounds['min_lon'],
        'max_lon': bounds['max_lon'],
        'min_lat': bounds['min_lat'],
        'max_lat': bounds['max_lat']
    }
    
    # If negative bounds, ensure data has negative longitudes
    if region_bounds['min_lon'] < 0:
        if np.all(lon_values >= 0): 
            print(f"Converting longitudes from 0/360 to -180/180 range for {filename}")
            sst_data[dict_key] = sst_data[dict_key].assign_coords(
                longitude=((sst_data[dict_key]['longitude'] + 180) % 360) - 180
            )
    
    # Check if latitude is inverted and fix it
    if lat_values[0] < lat_values[-1]:  # If lat[0] is lower than lat[-1], flip it
        print(f"Flipping latitude for {filename}")
        sst[dict_key] = sst[dict_key].isel(latitude=slice(None, None, -1))
        sst_data[dict_key] = sst_data[dict_key].assign_coords(
            latitude=sst_data[dict_key]['latitude'][::-1]
        )
    
    # Subset using bounds
    sst_subset[dict_key] = sst[dict_key].sel(
        latitude=slice(bounds['max_lat'], bounds['min_lat']),
        longitude=slice(bounds['min_lon'], bounds['max_lon'])
    )
    
    # Convert from Kelvin to Celsius
    sst_subset[dict_key] = sst_subset[dict_key] - 273.15
    
    # Mask NaN values
    sst_subset_masked[dict_key] = np.ma.masked_invalid(sst_subset[dict_key].values)
    
    # Compute min and max values after masking
    sst_min = np.ma.min(sst_subset_masked[dict_key])
    sst_max = np.ma.max(sst_subset_masked[dict_key])
    
    # Store statistics
    sst_stats[dict_key] = {'min': float(sst_min), 'max': float(sst_max)}
    print(f"{filename}: min={sst_min}°C, max={sst_max}°C")
    
    # Extract coordinate bounds
    lon_min, lon_max = float(sst_subset[dict_key]['longitude'].min()), float(sst_subset[dict_key]['longitude'].max())
    lat_min, lat_max = float(sst_subset[dict_key]['latitude'].min()), float(sst_subset[dict_key]['latitude'].max())
    
    # Define correct transform (EPSG:4326)
    transform = from_bounds(
        lon_min, lat_min,  # Lower left
        lon_max, lat_max,  # Upper right
        sst_subset[dict_key].shape[1],  # Width (columns)
        sst_subset[dict_key].shape[0]   # Height (rows)
    )
    
    # Save as GeoTIFF (EPSG:4326)
    output_file = os.path.join(temp_files_dir, f"sst_data_{dict_key}.tif")
    with rasterio.open(
        output_file,
        'w',
        driver='GTiff',
        height=sst_subset_masked[dict_key].shape[0],
        width=sst_subset_masked[dict_key].shape[1],
        count=1,
        dtype=str(sst_subset_masked[dict_key].dtype),
        crs="EPSG:4326",
        transform=transform
    ) as dst:
        dst.write(sst_subset_masked[dict_key].filled(np.nan), 1)
    
    print(f"Saved GeoTIFF: {output_file}")


# In[5]:


# # Path to your GeoTIFF file
# tiff_path = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/OSTIA_SST/temp_files/sst_data_20250310.tif"

# # Open the GeoTIFF
# with rasterio.open(tiff_path) as src:
#     data = src.read(1)  # Read first band
#     extent = [src.bounds.left, src.bounds.right, src.bounds.bottom, src.bounds.top]  # Get geographic bounds

# # Plot the data
# plt.figure(figsize=(10, 6))
# plt.imshow(data, cmap=cmocean.cm.thermal, extent=extent, origin="upper")
# plt.colorbar(label="Sea Surface Temperature (°C)")
# plt.title("SST GeoTIFF Preview - 2024-08-01")
# plt.xlabel("Longitude")
# plt.ylabel("Latitude")
# plt.grid(False)
# plt.show()


# In[6]:


# Reproject SST GeoTIFFs to EPSG:3857
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.tif') or "3857" in filename:
        continue  # Skip already reprojected files
    
    # Define file paths
    input_tiff = os.path.join(temp_files_dir, filename)
    date_str = filename.split('_')[2].split('.')[0]
    output_tiff = os.path.join(temp_files_dir, f"sst_data_{date_str}_3857.tif")
    
    print(f"\n==================== Reprojecting {filename} ====================")
    
    with rasterio.open(input_tiff) as src:
        # Get the original latitude range
        lat_min, lat_max = src.bounds.bottom, src.bounds.top
        
        # Check if latitude axis is inverted (flipped)
        if lat_min > lat_max:
            print(f"Flipping latitude for {filename} before reprojection")
            img_data = src.read(1)
            img_data = np.flipud(img_data)  # Flip image vertically
        else:
            img_data = src.read(1)
        
        # Calculate new transformation for EPSG:3857 reprojection
        transform, width, height = calculate_default_transform(
            src.crs, "EPSG:3857", src.width, src.height, *src.bounds
        )
        
        # Update metadata for reprojected GeoTIFF
        kwargs = src.meta.copy()
        kwargs.update({
            "crs": "EPSG:3857",
            "transform": transform,
            "width": width,
            "height": height
        })
        
        # Create a destination array for the reprojected data
        dst_array = np.zeros((height, width), dtype=kwargs['dtype'])
        
        # Write reprojected GeoTIFF
        with rasterio.open(output_tiff, "w", **kwargs) as dst:
            reproject(
                source=img_data,
                destination=rasterio.band(dst, 1),
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs="EPSG:3857",
                resampling=Resampling.bilinear
            )
    
    print(f"Saved reprojected GeoTIFF: {output_tiff}")


# In[7]:


# # Path to your GeoTIFF file
# tiff_path = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/OSTIA_SST/temp_files/sst_data_20250310_3857.tif"

# # Open the GeoTIFF
# with rasterio.open(tiff_path) as src:
#     data = src.read(1)  # Read first band
#     extent = [src.bounds.left, src.bounds.right, src.bounds.bottom, src.bounds.top]  # Get geographic bounds

# # Plot the data
# plt.figure(figsize=(10, 6))
# plt.imshow(data, cmap=cmocean.cm.thermal, extent=extent, origin="upper")
# plt.colorbar(label="Sea Surface Temperature (°C)")
# plt.title("SST GeoTIFF Preview - 2024-08-01")
# plt.xlabel("Longitude")
# plt.ylabel("Latitude")
# plt.grid(False)
# plt.show()


# In[8]:


# Generate VRT files with enforced bounds
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('_3857.tif'):
        continue  # Process only reprojected files
    
    date_str = filename.split('_')[2].split('.')[0]
    tiff_3857 = os.path.join(temp_files_dir, filename)
    vrt_file = os.path.join(temp_files_dir, f"sst_data_{date_str}.vrt")
    
    print(f"\n==================== Creating VRT for {filename} ====================")
    
    # Open the raster to extract its bounds (already in EPSG:3857)
    with rasterio.open(tiff_3857) as src:
        bounds = src.bounds  # (left, bottom, right, top)
    
    # Extract corner coordinates (directly in EPSG:3857)
    upper_left_x, lower_right_y, lower_right_x, upper_left_y = bounds
    
    # Generate VRT with enforced SST range (approximately 0-30°C) and correct bounds
    subprocess.run([
        'gdal_translate', '-of', 'VRT', '-ot', 'Byte',
        '-scale', '0', '30', '1', '255',  # Enforce SST range in Celsius
        '-a_srs', 'EPSG:3857',
        '-a_ullr',
        str(upper_left_x), str(upper_left_y),
        str(lower_right_x), str(lower_right_y),
        tiff_3857, vrt_file
    ])
    
    print(f"Created VRT: {vrt_file}")


# In[9]:


# Create colormap file for gdaldem color-relief
color_filename = os.path.join(base_dir, 'processed_data', 'OSTIA_SST', 'thermal_colormap.txt')
colors = cmocean.cm.thermal(np.linspace(0, 1, 255))  # Use 255 colors for thermal colormap

with open(color_filename, 'w') as f:
    f.write("0 0 0 0 0\n")  # Transparent for masked values
    for i, color in enumerate(colors, start=1):
        f.write(f"{i} {int(color[0]*255)} {int(color[1]*255)} {int(color[2]*255)} 255\n")

# Generate colorized VRTs
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.vrt'):
        continue
    
    date_str = filename.split('_')[2].split('.')[0]
    vrt_file = os.path.join(temp_files_dir, filename)
    colored_vrt_file = os.path.join(temp_files_dir, f"colored_{date_str}.vrt")
    
    subprocess.run([
        'gdaldem', 'color-relief', vrt_file, color_filename, colored_vrt_file, '-of', 'VRT', '-alpha'
    ])
    
    print(f"Created colorized VRT: {colored_vrt_file}")


# In[10]:


# Generate XYZ Tiles with gdal2tiles.py
for filename in os.listdir(temp_files_dir):
    if not filename.startswith('color'):
        continue
    
    raw_date_str = filename.split('_')[1].split('.')[0]
    year = raw_date_str[:4]
    month = raw_date_str[4:6]
    day = raw_date_str[6:8]
    
    # Convert MMDD to DDD (Julian Day)
    date_obj = datetime(int(year), int(month), int(day))
    day_of_year = date_obj.timetuple().tm_yday
    
    # Format YYYY_DDD
    date_str = f"{year}_{day_of_year:03d}"
    
    # Define paths
    colored_vrt_file = os.path.join(temp_files_dir, f"colored_{raw_date_str}.vrt")
    tiles_directory = os.path.join(tiles_dir, date_str)
    
    print(f"\n==================== Generating tiles for {date_str} ====================")
    
    subprocess.run([
        'gdal2tiles.py', 
        '--config', 'GDAL_PAM_ENABLED', 'NO',
        '-p', 'mercator', 
        '-z', '0-7',  # Adjust zoom levels as needed
        '-r', 'bilinear', 
        '-w', 'none',
        '--xyz',
        '--processes=8',  # Let gdal2tiles handle multiprocessing
        colored_vrt_file, 
        tiles_directory
    ])
    
    print(f"Generated tiles for {date_str} in {tiles_directory}")


# In[11]:


# Iterate over the stored statistics for SST data
for dict_key in sst_stats.keys():
    # Convert dict_key (YYYYMMDD) → (YYYY_DDD)
    year = dict_key[:4]  # Extract year (YYYY)
    month = dict_key[4:6]  # Extract month (MM)
    day = dict_key[6:8]  # Extract day (DD)
    
    # Convert to day-of-year (DDD)
    date_obj = datetime.strptime(f"{year}{month}{day}", "%Y%m%d")
    doy = date_obj.timetuple().tm_yday  # Get day-of-year (1-365)
    
    # Construct new directory name in YYYY_DDD format
    out_dir = os.path.join(tiles_dir, f"{year}_{doy:03d}")  # Ensure DDD is 3-digit
    
    # Ensure the directory exists
    os.makedirs(out_dir, exist_ok=True)
    
    # Set fixed SST range in Celsius
    sst_range = {
        "min_SST": sst_stats[dict_key]['min'],
        "max_SST": sst_stats[dict_key]['max']
    }
    
    # Save JSON file in the correct tiles folder
    json_file_path = os.path.join(out_dir, "sst_range_global.json")
    with open(json_file_path, "w") as f:
        json.dump(sst_range, f, indent=4)
    
    print(f"Saved fixed range stats for {dict_key} ({year}_{doy:03d}) to {json_file_path}")


# In[12]:


# Clean up files
shutil.rmtree(temp_files_dir)

# Recreate temp_files directory for future runs
temp_files_dir = os.path.join(base_dir, 'processed_data', 'OSTIA_SST', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)


# In[13]:


# Get all folder names in the tiles directory and sort them
dates = sorted([
    folder for folder in os.listdir(tiles_dir) 
    if os.path.isdir(os.path.join(tiles_dir, folder)) and folder.startswith('20')
])

print("Found SST dates:", dates)

# Output the list of dates to a txt file
output_path = os.path.join(base_dir, 'processed_data', 'OSTIA_SST', 'sst_dates.txt')

# Open the file in write mode
with open(output_path, 'w') as f:
    for date in dates:
        formatted_date = date.replace('_', '')  # Replace underscores with no separator
        f.write(f"{formatted_date}\n")  # Write the formatted date to the file

print(f"Saved list of SST dates to {output_path}") 


# Refined Cape cod view

# In[14]:


# Sort files by date
files = []
for filename in raw_files_to_process:
    match = date_pattern.search(filename)
    if match:
        date_str = match.group(1)
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        date_cleaned = date_obj.strftime("%Y%m%d")  # "YYYYMMDD" format
        date_int = int(date_cleaned)
        files.append((date_int, filename))

# Sort files by date (earliest first)
files.sort(key=lambda x: x[0])

# Define region of interest (North Atlantic, similar to SSS bounds)
bounds = {
    'min_lon': -74,
    'max_lon': -66,
    'min_lat': 38.8,
    'max_lat': 43.5
}

# Data dictionaries to store information
sst_data = {}
sst = {}
sst_subset = {}
sst_subset_masked = {}
sst_stats = {}

# Process SST files
for date_int, filename in files:
    file_path = os.path.join(raw_data_dir, filename)
    dict_key = f"{date_int}"
    date_str = filename.split('.')[0]  # For file naming
    
    print(f"\n==================== Processing {filename} ====================")
    
    # Open dataset
    sst_data[dict_key] = xr.open_dataset(file_path)
    sst[dict_key] = sst_data[dict_key]['analysed_sst'].squeeze()
    
    # Assign CRS if missing
    if 'crs' not in sst_data[dict_key].attrs:
        sst_data[dict_key] = sst_data[dict_key].rio.write_crs("EPSG:4326")
    
    # Extract latitude and longitude values
    lat_values = sst_data[dict_key]['latitude'].values
    lon_values = sst_data[dict_key]['longitude'].values
    
    # Check if longitude is in -180 to 180 range and convert to 0 to 360 range if needed
    if np.any(lon_values < 0):
        print(f"Converting longitudes from -180/180 to 0/360 range for {filename}")
        sst_data[dict_key] = sst_data[dict_key].assign_coords(
            longitude=(((sst_data[dict_key]['longitude'] + 180) % 360) - 180)
        )
    
    # Ensure bounds are in the same format as the data
    region_bounds = {
        'min_lon': bounds['min_lon'],
        'max_lon': bounds['max_lon'],
        'min_lat': bounds['min_lat'],
        'max_lat': bounds['max_lat']
    }
    
    # If negative bounds, ensure data has negative longitudes
    if region_bounds['min_lon'] < 0:
        if np.all(lon_values >= 0): 
            print(f"Converting longitudes from 0/360 to -180/180 range for {filename}")
            sst_data[dict_key] = sst_data[dict_key].assign_coords(
                longitude=((sst_data[dict_key]['longitude'] + 180) % 360) - 180
            )
    
    # Check if latitude is inverted and fix it
    if lat_values[0] < lat_values[-1]:  # If lat[0] is lower than lat[-1], flip it
        print(f"Flipping latitude for {filename}")
        sst[dict_key] = sst[dict_key].isel(latitude=slice(None, None, -1))
        sst_data[dict_key] = sst_data[dict_key].assign_coords(
            latitude=sst_data[dict_key]['latitude'][::-1]
        )
    
    # Subset using bounds
    sst_subset[dict_key] = sst[dict_key].sel(
        latitude=slice(bounds['max_lat'], bounds['min_lat']),
        longitude=slice(bounds['min_lon'], bounds['max_lon'])
    )
    
    # Convert from Kelvin to Celsius
    sst_subset[dict_key] = sst_subset[dict_key] - 273.15
    
    # Mask NaN values
    sst_subset_masked[dict_key] = np.ma.masked_invalid(sst_subset[dict_key].values)
    
    # Compute min and max values after masking
    sst_min = np.ma.min(sst_subset_masked[dict_key])
    sst_max = np.ma.max(sst_subset_masked[dict_key])
    
    # Store statistics
    sst_stats[dict_key] = {'min': float(sst_min), 'max': float(sst_max)}
    print(f"{filename}: min={sst_min}°C, max={sst_max}°C")
    
    # Extract coordinate bounds
    lon_min, lon_max = float(sst_subset[dict_key]['longitude'].min()), float(sst_subset[dict_key]['longitude'].max())
    lat_min, lat_max = float(sst_subset[dict_key]['latitude'].min()), float(sst_subset[dict_key]['latitude'].max())
    
    # Define correct transform (EPSG:4326)
    transform = from_bounds(
        lon_min, lat_min,  # Lower left
        lon_max, lat_max,  # Upper right
        sst_subset[dict_key].shape[1],  # Width (columns)
        sst_subset[dict_key].shape[0]   # Height (rows)
    )
    
    # Save as GeoTIFF (EPSG:4326)
    output_file = os.path.join(temp_files_dir, f"sst_data_{dict_key}.tif")
    with rasterio.open(
        output_file,
        'w',
        driver='GTiff',
        height=sst_subset_masked[dict_key].shape[0],
        width=sst_subset_masked[dict_key].shape[1],
        count=1,
        dtype=str(sst_subset_masked[dict_key].dtype),
        crs="EPSG:4326",
        transform=transform
    ) as dst:
        dst.write(sst_subset_masked[dict_key].filled(np.nan), 1)
    
    print(f"Saved GeoTIFF: {output_file}")


# In[15]:


# # Path to your GeoTIFF file
# tiff_path = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/OSTIA_SST/temp_files/sst_data_20240801.tif"

# # Open the GeoTIFF
# with rasterio.open(tiff_path) as src:
#     data = src.read(1)  # Read first band
#     extent = [src.bounds.left, src.bounds.right, src.bounds.bottom, src.bounds.top]  # Get geographic bounds

# # Plot the data
# plt.figure(figsize=(10, 6))
# plt.imshow(data, cmap=cmocean.cm.thermal, extent=extent, origin="upper")
# plt.colorbar(label="Sea Surface Temperature (°C)")
# plt.title("SST GeoTIFF Preview - 2024-08-01")
# plt.xlabel("Longitude")
# plt.ylabel("Latitude")
# plt.grid(False)
# plt.show()


# In[16]:


# Reproject SST GeoTIFFs to EPSG:3857
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.tif') or "3857" in filename:
        continue  # Skip already reprojected files
    
    # Define file paths
    input_tiff = os.path.join(temp_files_dir, filename)
    date_str = filename.split('_')[2].split('.')[0]
    output_tiff = os.path.join(temp_files_dir, f"sst_data_{date_str}_3857.tif")
    
    print(f"\n==================== Reprojecting {filename} ====================")
    
    with rasterio.open(input_tiff) as src:
        # Get the original latitude range
        lat_min, lat_max = src.bounds.bottom, src.bounds.top
        
        # Check if latitude axis is inverted (flipped)
        if lat_min > lat_max:
            print(f"Flipping latitude for {filename} before reprojection")
            img_data = src.read(1)
            img_data = np.flipud(img_data)  # Flip image vertically
        else:
            img_data = src.read(1)
        
        # Calculate new transformation for EPSG:3857 reprojection
        transform, width, height = calculate_default_transform(
            src.crs, "EPSG:3857", src.width, src.height, *src.bounds
        )
        
        # Update metadata for reprojected GeoTIFF
        kwargs = src.meta.copy()
        kwargs.update({
            "crs": "EPSG:3857",
            "transform": transform,
            "width": width,
            "height": height
        })
        
        # Create a destination array for the reprojected data
        dst_array = np.zeros((height, width), dtype=kwargs['dtype'])
        
        # Write reprojected GeoTIFF
        with rasterio.open(output_tiff, "w", **kwargs) as dst:
            reproject(
                source=img_data,
                destination=rasterio.band(dst, 1),
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs="EPSG:3857",
                resampling=Resampling.bilinear
            )
    
    print(f"Saved reprojected GeoTIFF: {output_tiff}")


# In[17]:


# # Path to your GeoTIFF file
# tiff_path = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/OSTIA_SST/temp_files/sst_data_20240801_3857.tif"

# # Open the GeoTIFF
# with rasterio.open(tiff_path) as src:
#     data = src.read(1)  # Read first band
#     extent = [src.bounds.left, src.bounds.right, src.bounds.bottom, src.bounds.top]  # Get geographic bounds

# # Plot the data
# plt.figure(figsize=(10, 6))
# plt.imshow(data, cmap=cmocean.cm.thermal, extent=extent, origin="upper")
# plt.colorbar(label="Sea Surface Temperature (°C)")
# plt.title("SST GeoTIFF Preview - 2024-08-01")
# plt.xlabel("Longitude")
# plt.ylabel("Latitude")
# plt.grid(False)
# plt.show()


# In[18]:


# Generate VRT files with enforced bounds
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('_3857.tif'):
        continue  # Process only reprojected files
    
    date_str = filename.split('_')[2].split('.')[0]
    tiff_3857 = os.path.join(temp_files_dir, filename)
    vrt_file = os.path.join(temp_files_dir, f"sst_data_{date_str}.vrt")
    
    print(f"\n==================== Creating VRT for {filename} ====================")
    
    # Open the raster to extract its bounds (already in EPSG:3857)
    with rasterio.open(tiff_3857) as src:
        bounds = src.bounds  # (left, bottom, right, top)
    
    # Extract corner coordinates (directly in EPSG:3857)
    upper_left_x, lower_right_y, lower_right_x, upper_left_y = bounds
    
    # Generate VRT with enforced SST range (approximately 0-30°C) and correct bounds
    subprocess.run([
        'gdal_translate', '-of', 'VRT', '-ot', 'Byte',
        '-scale', '0', '30', '1', '255',  # Enforce SST range in Celsius
        '-a_srs', 'EPSG:3857',
        '-a_ullr',
        str(upper_left_x), str(upper_left_y),
        str(lower_right_x), str(lower_right_y),
        tiff_3857, vrt_file
    ])
    
    print(f"Created VRT: {vrt_file}")


# In[19]:


# Create colormap file for gdaldem color-relief
color_filename = os.path.join(base_dir, 'processed_data', 'OSTIA_SST', 'thermal_colormap.txt')
colors = cmocean.cm.thermal(np.linspace(0, 1, 255))  # Use 255 colors for thermal colormap

with open(color_filename, 'w') as f:
    f.write("0 0 0 0 0\n")  # Transparent for masked values
    for i, color in enumerate(colors, start=1):
        f.write(f"{i} {int(color[0]*255)} {int(color[1]*255)} {int(color[2]*255)} 255\n")

# Generate colorized VRTs
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.vrt'):
        continue
    
    date_str = filename.split('_')[2].split('.')[0]
    vrt_file = os.path.join(temp_files_dir, filename)
    colored_vrt_file = os.path.join(temp_files_dir, f"colored_{date_str}.vrt")
    
    subprocess.run([
        'gdaldem', 'color-relief', vrt_file, color_filename, colored_vrt_file, '-of', 'VRT', '-alpha'
    ])
    
    print(f"Created colorized VRT: {colored_vrt_file}")


# In[20]:


# Generate XYZ Tiles with gdal2tiles.py
for filename in os.listdir(temp_files_dir):
    if not filename.startswith('color'):
        continue
    
    raw_date_str = filename.split('_')[1].split('.')[0]
    year = raw_date_str[:4]
    month = raw_date_str[4:6]
    day = raw_date_str[6:8]
    
    # Convert MMDD to DDD (Julian Day)
    date_obj = datetime(int(year), int(month), int(day))
    day_of_year = date_obj.timetuple().tm_yday
    
    # Format YYYY_DDD
    date_str = f"{year}_{day_of_year:03d}"
    
    # Define paths
    colored_vrt_file = os.path.join(temp_files_dir, f"colored_{raw_date_str}.vrt")
    tiles_directory = os.path.join(tiles_dir, date_str)
    
    print(f"\n==================== Generating tiles for {date_str} ====================")
    
    subprocess.run([
        'gdal2tiles.py', 
        '--config', 'GDAL_PAM_ENABLED', 'NO',
        '-p', 'mercator', 
        '-z', '8-10',  # Adjust zoom levels as needed
        '-r', 'bilinear', 
        '-w', 'none',
        '--xyz',
        '--processes=24',  # Let gdal2tiles handle multiprocessing
        colored_vrt_file, 
        tiles_directory
    ])
    
    print(f"Generated tiles for {date_str} in {tiles_directory}")


# In[21]:


# Iterate over the stored statistics for SST data
for dict_key in sst_stats.keys():
    # Convert dict_key (YYYYMMDD) → (YYYY_DDD)
    year = dict_key[:4]  # Extract year (YYYY)
    month = dict_key[4:6]  # Extract month (MM)
    day = dict_key[6:8]  # Extract day (DD)
    
    # Convert to day-of-year (DDD)
    date_obj = datetime.strptime(f"{year}{month}{day}", "%Y%m%d")
    doy = date_obj.timetuple().tm_yday  # Get day-of-year (1-365)
    
    # Construct new directory name in YYYY_DDD format
    out_dir = os.path.join(tiles_dir, f"{year}_{doy:03d}")  # Ensure DDD is 3-digit
    
    # Ensure the directory exists
    os.makedirs(out_dir, exist_ok=True)
    
    # Set fixed SST range in Celsius
    sst_range = {
        "min_SST": sst_stats[dict_key]['min'],
        "max_SST": sst_stats[dict_key]['max']
    }
    
    # Save JSON file in the correct tiles folder
    json_file_path = os.path.join(out_dir, "sst_range_local.json")
    with open(json_file_path, "w") as f:
        json.dump(sst_range, f, indent=4)
    
    print(f"Saved fixed range stats for {dict_key} ({year}_{doy:03d}) to {json_file_path}")


# In[22]:


# Clean up files
shutil.rmtree(temp_files_dir)

# Recreate temp_files directory for future runs
temp_files_dir = os.path.join(base_dir, 'processed_data', 'OSTIA_SST', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)


# In[23]:


# Get all folder names in the tiles directory and sort them
dates = sorted([
    folder for folder in os.listdir(tiles_dir) 
    if os.path.isdir(os.path.join(tiles_dir, folder)) and folder.startswith('20')
])

print("Found SST dates:", dates)

# Output the list of dates to a txt file
output_path = os.path.join(base_dir, 'processed_data', 'OSTIA_SST', 'sst_dates.txt')

# Open the file in write mode
with open(output_path, 'w') as f:
    for date in dates:
        formatted_date = date.replace('_', '')  # Replace underscores with no separator
        f.write(f"{formatted_date}\n")  # Write the formatted date to the file

print(f"Saved list of SST dates to {output_path}") 


# In[ ]:




