#!/usr/bin/env python
# coding: utf-8

# In[30]:


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
from pathlib import Path
from rasterio.warp import calculate_default_transform, reproject, Resampling


# In[31]:


# Define base directory
base_dir = '/home/finn.wimberly/Documents/CCCFA_app_dev/data'
raw_data_dir = '/vast/clidex/data/obs/SSS/SMAP/SMAP_RSS_v6.0/data/8daily'


tiles_dir = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles_mirrored')
os.makedirs(tiles_dir, exist_ok=True)

# Path for the temp_files directory
temp_files_dir = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)

# Get list of existing tile dates
existing_tiles = set()

for folder_name in os.listdir(tiles_dir):
    if os.path.isdir(os.path.join(tiles_dir, folder_name)) and folder_name.startswith('20'):
        # Convert tile folder name (e.g., "2024_211") to raw file format (e.g., "2024211")
        date_str = folder_name.replace('_', '')
        existing_tiles.add(date_str)

# Get list of raw data files to process
raw_files_to_process = []
date_cutoff = 2024214  # Set cutoff as an integer

for filename in os.listdir(raw_data_dir):
    if filename.endswith('.nc'):  # Ensure it's a netCDF file
        
        # Extract the year and day-of-year (DOY) from the filename
        parts = filename.split('_')
        if len(parts) >= 7:  # Ensure filename structure is correct
            year, doy = parts[6], parts[7]  # Extract YYYY and DDD directly

            # Construct YYYYDDD format
            yyyyddd = f"{year}{doy}"  

            # Ensure it's not in existing tiles and meets the date threshold
            if yyyyddd not in existing_tiles and int(yyyyddd) >= date_cutoff:
                raw_files_to_process.append(filename)

# Output filtered file list
print("Files to process:")
print(raw_files_to_process)


# In[32]:


files = []
sss_data = {}
sss = {}
sss_stats = {}

# Get list of files and sort by date
for filename in os.listdir(raw_data_dir):
    if filename.endswith('.nc'):
        parts = filename.split('_')
        if len(parts) >= 7:  # Ensure filename has the expected structure
            year, doy = parts[6], parts[7]  # Extract YYYY and DDD

            # Convert YYYY_DDD to YYYYMMDD format
            date_obj = datetime.strptime(f"{year} {doy}", "%Y %j")
            date_cleaned = date_obj.strftime("%Y%m%d")  # "YYYYMMDD" format
            date_int = int(date_cleaned)

            if filename in raw_files_to_process:
                files.append((date_int, filename))

# Sort files by date (earliest first)
files.sort(key=lambda x: x[0])

# Define Atlantic region bounds
bounds = {
    'min_lon': 274.93,
    'max_lon': 300.06,
    'min_lat': 22.10,
    'max_lat': 46.06
}

# Define Great Lakes approximate bounding box (to mask)
great_lakes_bounds = {
    'min_lon': 276.0,
    'max_lon': 290.0,
    'min_lat': 41.0,
    'max_lat': 46.5
}

# Data dictionaries
sss_data = {}
sss = {}
sss_subset = {}
sss_subset_masked = {}
sss_stats = {}

# Process SSS files
for date_int, filename in files:  # Process sorted files
    file_path = os.path.join(raw_data_dir, filename)
    dict_key = f"{date_int}"

    # Open dataset
    sss_data[dict_key] = xr.open_dataset(file_path)

    # Extract SSS variable
    sss[dict_key] = sss_data[dict_key]['sss_smap_40km'].squeeze()

    # Assign CRS if missing
    if 'crs' not in sss_data[dict_key].attrs:
        sss_data[dict_key] = sss_data[dict_key].rio.write_crs("EPSG:4326")

    # Extract latitude and longitude values
    lat_values = sss_data[dict_key]['lat'].values
    lon_values = sss_data[dict_key]['lon'].values

    # Check if latitude is inverted and fix it
    if lat_values[0] < lat_values[-1]:  # If lat[0] is lower than lat[-1], flip it
        print(f"Flipping latitude for {filename}")

        # Flip **inside the xarray DataArray** instead of converting to NumPy
        sss[dict_key] = sss[dict_key].isel(lat=slice(None, None, -1))  

        # Update the latitude coordinates in xarray
        sss_data[dict_key] = sss_data[dict_key].assign_coords(
            lat=sss_data[dict_key]['lat'][::-1]
        )



    # **Subset using Atlantic bounds**
    sss_subset[dict_key] = sss[dict_key].sel(
        lat=slice(bounds['max_lat'], bounds['min_lat']),  # Ensures correct lat slicing order
        lon=slice(bounds['min_lon'], bounds['max_lon'])
    )

    # **Mask NaN values**
    sss_subset_masked[dict_key] = np.ma.masked_invalid(sss_subset[dict_key].values)

    # **Apply Great Lakes mask**
    lat, lon = np.meshgrid(
        sss_subset[dict_key]['lat'].values,
        sss_subset[dict_key]['lon'].values,
        indexing='ij'
    )
    great_lakes_mask = ((lon >= great_lakes_bounds['min_lon']) & (lon <= great_lakes_bounds['max_lon']) &
                        (lat >= great_lakes_bounds['min_lat']) & (lat <= great_lakes_bounds['max_lat']))

    sss_subset_masked[dict_key] = np.ma.masked_where(great_lakes_mask, sss_subset_masked[dict_key])

    # **Compute min and max values after masking**
    sss_min = sss_subset_masked[dict_key].min()
    sss_max = sss_subset_masked[dict_key].max()

    # **Store statistics**
    sss_stats[dict_key] = {'min': float(sss_min), 'max': float(sss_max)}
    print(f"{filename}: min={sss_min}, max={sss_max}")

    # **Extract coordinate bounds**
    lon_min, lon_max = sss_subset[dict_key]['lon'].values.min(), sss_subset[dict_key]['lon'].values.max()
    lat_min, lat_max = sss_subset[dict_key]['lat'].values.min(), sss_subset[dict_key]['lat'].values.max()

    # **Define correct transform (EPSG:4326)**
    transform = from_bounds(
        lon_min, lat_max,  # Top-left (max latitude)
        lon_max, lat_min,  # Bottom-right (min latitude)
        sss_subset[dict_key].shape[1],  # Raster width (columns)
        sss_subset[dict_key].shape[0]   # Raster height (rows)
    )

    # **Save as GeoTIFF (EPSG:4326)**
    output_file = os.path.join(temp_files_dir, f"sss_data_{dict_key}.tif")
    with rasterio.open(
        output_file,
        'w',
        driver='GTiff',
        height=sss_subset_masked[dict_key].shape[0],
        width=sss_subset_masked[dict_key].shape[1],
        count=1,
        dtype=str(sss_subset_masked[dict_key].dtype),
        crs="EPSG:4326",
        transform=transform
    ) as dst:
        dst.write(sss_subset_masked[dict_key].filled(np.nan), 1)

    print(f"Saved GeoTIFF: {output_file}")


# In[33]:


# # Path to your GeoTIFF
# tif_path = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/SSS/temp_files/sss_data_20250401.tif"

# # Open and read the raster
# with rasterio.open(tif_path) as src:
#     data = src.read(1)
#     bounds = src.bounds
#     transform = src.transform

# # Mask no-data values for plotting
# masked_data = np.ma.masked_equal(data, src.nodata if src.nodata is not None else np.nan)

# # Plot
# plt.figure(figsize=(10, 6))
# plt.imshow(masked_data, cmap='viridis', origin='upper')
# plt.colorbar(label='SSS')
# plt.title("SSS – 2025-04-16")
# plt.xlabel("X (pixel)")
# plt.ylabel("Y (pixel)")
# plt.show()


# In[34]:


# Reproject SSS GeoTIFFs to EPSG:3857
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.tif') or "3857" in filename:
        continue  # Skip already reprojected files

    # Define file paths
    input_tiff = os.path.join(temp_files_dir, filename)
    date_str = filename.split('_')[2].split('.')[0]
    output_tiff = os.path.join(temp_files_dir, f"sss_data_{date_str}_3857.tif")

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

        # Write reprojected GeoTIFF
        with rasterio.open(output_tiff, "w", **kwargs) as dst:
            reproject(
                source=img_data,
                destination=rasterio.band(dst, 1),
                src_transform=src.transform,  # Keep original transform
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs="EPSG:3857",
                resampling=Resampling.bilinear
            )

    print(f"Saved reprojected GeoTIFF: {output_tiff}")


# In[35]:


# # Path to your GeoTIFF
# tif_path = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/SSS/temp_files/sss_data_20250419_3857.tif"

# # Open and read the raster
# with rasterio.open(tif_path) as src:
#     data = src.read(1)
#     bounds = src.bounds
#     transform = src.transform

# # Mask no-data values for plotting
# masked_data = np.ma.masked_equal(data, src.nodata if src.nodata is not None else np.nan)

# # Plot
# plt.figure(figsize=(10, 6))
# plt.imshow(masked_data, cmap='viridis', origin='upper')
# plt.colorbar(label='SSS')
# plt.title("SSS – 2025-04-16")
# plt.xlabel("X (pixel)")
# plt.ylabel("Y (pixel)")
# plt.show()


# In[36]:


# Generate VRT files with enforced bounds
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('_3857.tif'):
        continue  # Process only reprojected files

    date_str = filename.split('_')[2].split('.')[0]
    tiff_3857 = os.path.join(temp_files_dir, filename)
    vrt_file = os.path.join(temp_files_dir, f"sss_data_{date_str}.vrt")

    print(f"Creating VRT for {filename}...")

    # Open the raster to extract its bounds (already in EPSG:3857)
    with rasterio.open(tiff_3857) as src:
        bounds = src.bounds  # (left, bottom, right, top)

    # Extract corner coordinates (directly in EPSG:3857)
    upper_left_x, lower_right_y, lower_right_x, upper_left_y = bounds

    # **Generate VRT with enforced salinity range and correct bounds**
    subprocess.run([
        'gdal_translate', '-of', 'VRT', '-ot', 'Byte',
        '-scale', '31', '36.5', '1', '255',  # Enforce salinity range
        '-a_srs', 'EPSG:3857',
        '-a_ullr',
        str(upper_left_x), str(upper_left_y),
        str(lower_right_x), str(lower_right_y),
        tiff_3857, vrt_file
    ])

    print(f"Created VRT: {vrt_file}")


# In[37]:


# Create colormap file for gdaldem color-relief
color_filename = os.path.join(base_dir, 'processed_data', 'SSS', 'thermal_colormap.txt')

#colors = cmocean.cm.haline(np.linspace(0, 1, 255))  # Use 255 colors
colors = plt.cm.Spectral_r(np.linspace(0, 1, 255))  # Use 255 colors

with open(color_filename, 'w') as f:
    f.write("0 0 0 0 0\n")  # Transparent for masked values
    for i, color in enumerate(colors, start=1):
        f.write(f"{i} {int(color[0]*255)} {int(color[1]*255)} {int(color[2]*255)} 255\n")

for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.vrt'):
        continue

    date_str = filename.split('_')[2].split('.')[0]
    vrt_file = os.path.join(temp_files_dir, filename)
    colored_vrt_file = os.path.join(temp_files_dir, f"colored_{date_str}.vrt")

    #print(f"Creating colorized VRT for {filename}...")

    subprocess.run([
        'gdaldem', 'color-relief', vrt_file, color_filename, colored_vrt_file, '-of', 'VRT', '-alpha'
    ])

    print(f"Created colorized VRT: {colored_vrt_file}")


# In[38]:


# Generate XYZ Tiles with gdal2tiles.py
for filename in os.listdir(temp_files_dir):
    if not filename.startswith('color'):
        continue

    raw_date_str = filename.split('_')[1].split('.')[0]
    #print(raw_date_str)
    year = raw_date_str[:4]
    month = raw_date_str[4:6]
    day = raw_date_str[6:8]

    # Convert MMDD to DDD (Julian Day)
    date_obj = datetime(int(year), int(month), int(day))
    day_of_year = date_obj.timetuple().tm_yday

    # Format YYYY_DDD
    date_str = f"{year}_{day_of_year:03d}"
    #print(date_str)

    # Define paths
    colored_vrt_file = os.path.join(temp_files_dir, f"colored_{raw_date_str}.vrt")
    tiles_directory = os.path.join(tiles_dir, date_str)
    #print(tiles_directory)

    #print(f"Creating tiles in: {tiles_directory}")

    subprocess.run([
        'gdal2tiles.py', 
        '--config', 'GDAL_PAM_ENABLED', 'NO',
        '-p', 'mercator', 
        '-z', '0-7', 
        '-r', 'bilinear', 
        '-w', 'none',
        '--xyz',
        colored_vrt_file, 
        tiles_directory
    ])

    print(f"Generated tiles for {date_str} in {tiles_directory}")


# In[39]:


# Iterate over the stored statistics for SSS data
for dict_key in sss_stats.keys():  # We no longer need to compute min/max
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

    # **Set fixed salinity bounds**
    sss_range = {
        "min_SSS": 31.0,
        "max_SSS": 36.5
    }

    # Save JSON file in the correct tiles folder
    json_file_path = os.path.join(out_dir, "sss_range_global.json")
    with open(json_file_path, "w") as f:
        json.dump(sss_range, f, indent=4)

    print(f"Saved fixed range stats for {dict_key} ({year}_{doy:03d}) to {json_file_path}")


# In[40]:


#Clean up files
shutil.rmtree(temp_files_dir)

# Path for the temp_files directory
temp_files_dir = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)


# Higher zoom levels:

# In[41]:


# Cape cod tiles:

files = []
sss_data = {}
sss = {}
sss_stats = {}

# Get list of files and sort by date
for filename in os.listdir(raw_data_dir):
    if filename.endswith('.nc'):
        parts = filename.split('_')
        if len(parts) >= 7:  # Ensure filename has the expected structure
            year, doy = parts[6], parts[7]  # Extract YYYY and DDD

            # Convert YYYY_DDD to YYYYMMDD format
            date_obj = datetime.strptime(f"{year} {doy}", "%Y %j")
            date_cleaned = date_obj.strftime("%Y%m%d")  # "YYYYMMDD" format
            date_int = int(date_cleaned)

            if filename in raw_files_to_process:
                files.append((date_int, filename))

# Sort files by date (earliest first)
files.sort(key=lambda x: x[0])


# In[42]:


# Define the bounds in lat/lon
bounds = {
    'min_lon': 360-74,
    'max_lon': 360-66,
    'min_lat': 38.8,
    'max_lat': 43.5
}


# Data dictionaries
sss_data = {}
sss = {}
sss_subset = {}
sss_subset_masked = {}
sss_stats = {}

# Process SSS files
for date_int, filename in files:  # Process sorted files
    file_path = os.path.join(raw_data_dir, filename)
    dict_key = f"{date_int}"

    # Open dataset
    sss_data[dict_key] = xr.open_dataset(file_path)

    # Extract SSS variable
    sss[dict_key] = sss_data[dict_key]['sss_smap_40km'].squeeze()

    # Assign CRS if missing
    if 'crs' not in sss_data[dict_key].attrs:
        sss_data[dict_key] = sss_data[dict_key].rio.write_crs("EPSG:4326")

    # Extract latitude and longitude values
    lat_values = sss_data[dict_key]['lat'].values
    lon_values = sss_data[dict_key]['lon'].values

    # Check if latitude is inverted and fix it
    if lat_values[0] < lat_values[-1]:  # If lat[0] is lower than lat[-1], flip it
        print(f"Flipping latitude for {filename}")

        # Flip **inside the xarray DataArray** instead of converting to NumPy
        sss[dict_key] = sss[dict_key].isel(lat=slice(None, None, -1))  

        # Update the latitude coordinates in xarray
        sss_data[dict_key] = sss_data[dict_key].assign_coords(
            lat=sss_data[dict_key]['lat'][::-1]
        )



    # **Subset using Atlantic bounds**
    sss_subset[dict_key] = sss[dict_key].sel(
        lat=slice(bounds['max_lat'], bounds['min_lat']),  # Ensures correct lat slicing order
        lon=slice(bounds['min_lon'], bounds['max_lon'])
    )

    # **Mask NaN values**
    sss_subset_masked[dict_key] = np.ma.masked_invalid(sss_subset[dict_key].values)

    # **Apply Great Lakes mask**
    lat, lon = np.meshgrid(
        sss_subset[dict_key]['lat'].values,
        sss_subset[dict_key]['lon'].values,
        indexing='ij'
    )
    great_lakes_mask = ((lon >= great_lakes_bounds['min_lon']) & (lon <= great_lakes_bounds['max_lon']) &
                        (lat >= great_lakes_bounds['min_lat']) & (lat <= great_lakes_bounds['max_lat']))

    sss_subset_masked[dict_key] = np.ma.masked_where(great_lakes_mask, sss_subset_masked[dict_key])

    # **Compute min and max values after masking**
    sss_min = sss_subset_masked[dict_key].min()
    sss_max = sss_subset_masked[dict_key].max()

    # **Store statistics**
    sss_stats[dict_key] = {'min': float(sss_min), 'max': float(sss_max)}
    print(f"{filename}: min={sss_min}, max={sss_max}")

    # **Extract coordinate bounds**
    lon_min, lon_max = sss_subset[dict_key]['lon'].values.min(), sss_subset[dict_key]['lon'].values.max()
    lat_min, lat_max = sss_subset[dict_key]['lat'].values.min(), sss_subset[dict_key]['lat'].values.max()

    # **Define correct transform (EPSG:4326)**
    transform = from_bounds(
        lon_min, lat_max,  # Top-left (max latitude)
        lon_max, lat_min,  # Bottom-right (min latitude)
        sss_subset[dict_key].shape[1],  # Raster width (columns)
        sss_subset[dict_key].shape[0]   # Raster height (rows)
    )

    # **Save as GeoTIFF (EPSG:4326)**
    output_file = os.path.join(temp_files_dir, f"sss_data_{dict_key}.tif")
    with rasterio.open(
        output_file,
        'w',
        driver='GTiff',
        height=sss_subset_masked[dict_key].shape[0],
        width=sss_subset_masked[dict_key].shape[1],
        count=1,
        dtype=str(sss_subset_masked[dict_key].dtype),
        crs="EPSG:4326",
        transform=transform
    ) as dst:
        dst.write(sss_subset_masked[dict_key].filled(np.nan), 1)

    print(f"Saved GeoTIFF: {output_file}")


# In[43]:


# # Path to your GeoTIFF
# tif_path = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/SSS/temp_files/sss_data_20250416.tif"

# # Open and read the raster
# with rasterio.open(tif_path) as src:
#     data = src.read(1)
#     bounds = src.bounds
#     transform = src.transform

# # Mask no-data values for plotting
# masked_data = np.ma.masked_equal(data, src.nodata if src.nodata is not None else np.nan)

# # Plot
# plt.figure(figsize=(10, 6))
# plt.imshow(masked_data, cmap='viridis', origin='upper')
# plt.colorbar(label='SSS')
# plt.title("SSS – 2025-04-16")
# plt.xlabel("X (pixel)")
# plt.ylabel("Y (pixel)")
# plt.show()


# In[44]:


# Reproject SSS GeoTIFFs to EPSG:3857
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.tif') or "3857" in filename:
        continue  # Skip already reprojected files

    # Define file paths
    input_tiff = os.path.join(temp_files_dir, filename)
    date_str = filename.split('_')[2].split('.')[0]
    output_tiff = os.path.join(temp_files_dir, f"sss_data_{date_str}_3857.tif")

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

        # Write reprojected GeoTIFF
        with rasterio.open(output_tiff, "w", **kwargs) as dst:
            reproject(
                source=img_data,
                destination=rasterio.band(dst, 1),
                src_transform=src.transform,  # Keep original transform
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs="EPSG:3857",
                resampling=Resampling.bilinear
            )

    print(f"Saved reprojected GeoTIFF: {output_tiff}")


# In[45]:


# Generate VRT files with enforced bounds
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('_3857.tif'):
        continue  # Process only reprojected files

    date_str = filename.split('_')[2].split('.')[0]
    tiff_3857 = os.path.join(temp_files_dir, filename)
    vrt_file = os.path.join(temp_files_dir, f"sss_data_{date_str}.vrt")

    print(f"Creating VRT for {filename}...")

    # Open the raster to extract its bounds (already in EPSG:3857)
    with rasterio.open(tiff_3857) as src:
        bounds = src.bounds  # (left, bottom, right, top)

    # Extract corner coordinates (directly in EPSG:3857)
    upper_left_x, lower_right_y, lower_right_x, upper_left_y = bounds

    # **Generate VRT with enforced salinity range and correct bounds**
    subprocess.run([
        'gdal_translate', '-of', 'VRT', '-ot', 'Byte',
        '-scale', '29.5', '34', '1', '255',  # Enforce salinity range
        '-a_srs', 'EPSG:3857',
        '-a_ullr',
        str(upper_left_x), str(upper_left_y),
        str(lower_right_x), str(lower_right_y),
        tiff_3857, vrt_file
    ])

    print(f"Created VRT: {vrt_file}")


# In[46]:


# Step 3: Generate colorized VRTs
# Create colormap file for gdaldem color-relief
color_filename = os.path.join(base_dir, 'processed_data', 'SSS', 'thermal_colormap.txt')

#colors = cmocean.cm.haline(np.linspace(0, 1, 255))  # Use 255 colors
colors = plt.cm.Spectral_r(np.linspace(0, 1, 255))  # Use 255 colors

with open(color_filename, 'w') as f:
    f.write("0 0 0 0 0\n")  # Transparent for masked values
    for i, color in enumerate(colors, start=1):
        f.write(f"{i} {int(color[0]*255)} {int(color[1]*255)} {int(color[2]*255)} 255\n")

for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.vrt'):
        continue

    date_str = filename.split('_')[2].split('.')[0]
    vrt_file = os.path.join(temp_files_dir, filename)
    colored_vrt_file = os.path.join(temp_files_dir, f"colored_{date_str}.vrt")

    #print(f"Creating colorized VRT for {filename}...")

    subprocess.run([
        'gdaldem', 'color-relief', vrt_file, color_filename, colored_vrt_file, '-of', 'VRT', '-alpha'
    ])

    print(f"Created colorized VRT: {colored_vrt_file}")


# In[47]:


# Generate XYZ Tiles with gdal2tiles.py
for filename in os.listdir(temp_files_dir):
    if not filename.startswith('color'):
        continue

    raw_date_str = filename.split('_')[1].split('.')[0]
    #print(raw_date_str)
    year = raw_date_str[:4]
    month = raw_date_str[4:6]
    day = raw_date_str[6:8]

    # Convert MMDD to DDD (Julian Day)
    date_obj = datetime(int(year), int(month), int(day))
    day_of_year = date_obj.timetuple().tm_yday

    # Format YYYY_DDD
    date_str = f"{year}_{day_of_year:03d}"
    #print(date_str)

    # Define paths
    colored_vrt_file = os.path.join(temp_files_dir, f"colored_{raw_date_str}.vrt")
    tiles_directory = os.path.join(tiles_dir, date_str)
    #print(tiles_directory)

    #print(f"Creating tiles in: {tiles_directory}")

    subprocess.run([
        'gdal2tiles.py', 
        '--config', 'GDAL_PAM_ENABLED', 'NO',
        '-p', 'mercator', 
        '-z', '8-10', 
        '-r', 'bilinear', 
        '-w', 'none',
        '--xyz',
        colored_vrt_file, 
        tiles_directory
    ])

    print(f"Generated tiles for {date_str} in {tiles_directory}")


# In[48]:


# Iterate over the stored statistics for SSS data
for dict_key in sss_stats.keys():  # We no longer need to compute min/max
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

    # **Set fixed salinity bounds**
    sss_range = {
        "min_SSS": 29.5,
        "max_SSS": 34
    }

    # Save JSON file in the correct tiles folder
    json_file_path = os.path.join(out_dir, "sss_range_local.json")
    with open(json_file_path, "w") as f:
        json.dump(sss_range, f, indent=4)

    print(f"Saved fixed range stats for {dict_key} ({year}_{doy:03d}) to {json_file_path}")


# In[49]:


#Clean up files
shutil.rmtree(temp_files_dir)

# Path for the temp_files directory
temp_files_dir = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)


# In[50]:


# Get all folder names in the tiles_3day directory and sort them
dates = sorted([
    folder for folder in os.listdir(tiles_dir) 
    if os.path.isdir(os.path.join(tiles_dir, folder)) and folder.startswith('20')
])

print("Found SSS dates:", dates)

# Output the list of dates to a txt file
output_path = os.path.join(base_dir, 'processed_data', 'SSS', 'sss_dates.txt')

# Open the file in write mode
with open(output_path, 'w') as f:
    for date in dates:
        formatted_date = date.replace('_', '')  # Replace underscores with no separator
        f.write(f"{formatted_date}\n")  # Write the formatted date to the file

print(f"Saved list of SSS dates to {output_path}")


# In[ ]:




