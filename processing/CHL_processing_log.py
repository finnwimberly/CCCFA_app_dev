#!/usr/bin/env python
# coding: utf-8

# In[92]:


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


# In[110]:


# Define base directory
base_dir = '/home/finn.wimberly/Documents/CCCFA_app_dev/data'
raw_data_dir = os.path.join(base_dir, 'raw_data', 'CHL', 'GlobColour', 'daily')

tiles_dir = os.path.join(base_dir, 'processed_data', 'CHL', 'tiles')
os.makedirs(tiles_dir, exist_ok=True)

# Path for the temp_files directory
temp_files_dir = os.path.join(base_dir, 'processed_data', 'CHL', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)

# Get list of existing tile dates
existing_tiles = set()

for folder_name in os.listdir(tiles_dir):
    if os.path.isdir(os.path.join(tiles_dir, folder_name)) and folder_name.startswith('20'):
        # Convert tile folder name (e.g., 2024_211) to raw file format (e.g., 2024211)
        date_str = folder_name.replace('_', '')
        existing_tiles.add(date_str)

# Get list of raw data files to process
raw_files_to_process = []

for filename in os.listdir(raw_data_dir):
    if filename.endswith('.nc'):  # Ensure it's a netCDF file
        # Extract date from raw file name (e.g., cmems_obs-oc_glo_bgc-plankton_my_l3-multi-4km_P1D_CHL-flags_85.06W-59.98W_22.10N-46.02N_2025-04-21.nc)
        date_in_filename = filename.split('_')[-1].split('.')[0]  # Extract "2025-04-21"
        date_cleaned = date_in_filename.replace("-", "")  # Remove dashes -> "20250421"
        
        year = date_cleaned[:4]
        month = date_cleaned[4:6]
        day = date_cleaned[6:8]

        # Convert MMDD to DDD (Julian Day)
        date_obj = datetime(int(year), int(month), int(day))
        day_of_year = date_obj.timetuple().tm_yday

        # Format YYYY_DDD
        date_str = f"{year}{day_of_year:03d}"
        
        # Only process files from 2024214 onwards
        if date_str >= "2024214" and date_str not in existing_tiles:  # Only check if tile doesn't exist
            raw_files_to_process.append(filename)

# Output filtered file list
print("Files to process:")
print(raw_files_to_process)


# In[94]:


#Attempt at dynamic log scaling
def apply_log_scaling(data):
    """Apply log transformation and normalize based on actual data min/max, handling masked values properly."""
    
    # Convert to masked array, preserving NaNs
    masked_data = np.ma.masked_invalid(data)
    
    # Extract actual min/max ignoring NaNs (2nd and 98th percentiles to avoid outliers)
    valid_data = masked_data.compressed()  # Convert MaskedArray to regular array
    if valid_data.size == 0:  # If all values are NaN, return empty
        return masked_data
    
    data_min, data_max = np.percentile(valid_data, [0, 99])
    
    # Ensure log safety
    data_min = max(data_min, 0.001)  # Avoid log10(0)
    data_max = max(data_max, data_min * 20)  # Prevent zero range
    
    # Compute log scaling
    log_min, log_max = np.log10(data_min), np.log10(data_max)
    log_data = np.ma.log10(np.clip(masked_data, data_min, data_max))

    # Normalize to 1-255 range
    scaled_data = 1 + (254 * (log_data - log_min) / (log_max - log_min))

    # Preserve NoData values
    return np.ma.masked_where(masked_data.mask, scaled_data)


# In[95]:


files = []
chl_data = {}
chl = {}
chl_stats = {}

# Get list of files and sort by date
for filename in os.listdir(raw_data_dir):
    if filename.endswith('.nc'):
        date_part = filename.split('_')[-1].split('.')[0]  # Extract "2025-02-02"
        date_cleaned = date_part.replace("-", "")  # "20250202"
        date_int = int(date_cleaned)
        if filename in raw_files_to_process:
            files.append((date_int, filename))

# Sort files by date
files.sort(key=lambda x: x[0])

# Iterate over files
for date_int, filename in files:
    file_path = os.path.join(raw_data_dir, filename)
    dict_key = f"{date_int}"

    # Open dataset
    chl_data[dict_key] = xr.open_dataset(file_path)
    chl[dict_key] = chl_data[dict_key]['CHL'].squeeze()

    # Mask NaN values before applying log scaling
    chl_masked = np.ma.masked_invalid(chl[dict_key])
    
    #chl_min_original, chl_max_original = np.nanpercentile(chl_masked.compressed(), [0, 99])

    #Update that allows for empty arrays
    valid_data = chl_masked.compressed()  # Convert MaskedArray to a regular array of valid (non-NaN) values

    if valid_data.size == 0:
        # If there's NO data at all for this region/time, skip percentile or set them to NaN
        print(f"[WARNING] No valid data for {dict_key}. Creating empty TIF with all NaN.")

        # Create an array of all masked values
        chl_scaled = np.ma.masked_all_like(chl_masked)

        # Optionally record NaN range, or skip
        chl_min_original, chl_max_original = np.nan, np.nan
    else:
        # If we have at least some data, do your usual percentile calculations
        chl_min_original, chl_max_original = np.nanpercentile(valid_data, [0, 99])

        # Apply your log scaling function
        chl_scaled = apply_log_scaling(chl_masked)



    # Apply log scaling WITHOUT losing masked values
    chl_scaled = apply_log_scaling(chl_masked)  # No .filled(np.nan)!
    
    chl_stats[dict_key] = {'min': float(chl_min_original), 'max': float(chl_max_original)}

    # Assign CRS if missing
    if 'crs' not in chl_data[dict_key].attrs:
        chl_data[dict_key] = chl_data[dict_key].rio.write_crs("EPSG:32662")

    #print(f"Assigned CRS for {filename}: {chl_data[dict_key].rio.crs}")

    # Extract coordinate bounds
    lon_min, lon_max = chl_data[dict_key]['longitude'].values.min(), chl_data[dict_key]['longitude'].values.max()
    lat_min, lat_max = chl_data[dict_key]['latitude'].values.min(), chl_data[dict_key]['latitude'].values.max()

    #print(f"Latitude order before checking: {chl_data[dict_key]['latitude'].values}")

    # **Ensure CRS is EPSG:4326**
    if -180 <= lon_min <= 180 and -90 <= lat_min <= 90:
        #print(f"Data appears to be in degrees; setting CRS as EPSG:4326 for {filename}.")
        chl_data[dict_key] = chl_data[dict_key].rio.write_crs("EPSG:4326")
    
    # **If CRS is EPSG:32662, reproject to EPSG:4326**
    if chl_data[dict_key].rio.crs.to_epsg() == 32662:
        chl_data[dict_key] = chl_data[dict_key].rio.reproject("EPSG:4326")

        #print(f"Reprojected {filename} to EPSG:4326.")

    # **Check if latitude is inverted**
    if chl_data[dict_key]['latitude'][0] < chl_data[dict_key]['latitude'][-1]:  
        #print(f"Flipping latitude order for {filename}")
        
        # Flip data **AND** latitude axis
        chl_scaled = np.flipud(chl_scaled)  
        chl_data[dict_key] = chl_data[dict_key].assign_coords(
            latitude=chl_data[dict_key]['latitude'][::-1]
        )

    #print(f"Latitude order AFTER checking: {chl_data[dict_key]['latitude'].values}")

    # **Define correct transform**
    transform = from_bounds(
        lon_min, lat_max,  # Top-left (max latitude)
        lon_max, lat_min,  # Bottom-right (min latitude)
        chl[dict_key].shape[1],  # Raster width (columns)
        chl[dict_key].shape[0]   # Raster height (rows)
    )

    # **Save as GeoTIFF**
    output_file = os.path.join(temp_files_dir, f"chl_data_{dict_key}.tif")
    with rasterio.open(
        output_file,
        'w',
        driver='GTiff',
        height=chl_scaled.shape[0],
        width=chl_scaled.shape[1],
        count=1,
        dtype=str(chl_scaled.dtype),
        crs="EPSG:4326",
        transform=transform
    ) as dst:
        dst.write(chl_scaled.filled(np.nan), 1)

    print(f"Saved GeoTIFF: {output_file}")


# In[96]:


#chl_stats


# In[97]:


# test_file = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/CHL/temp_files/chl_data_20240801.tif"

# with rasterio.open(test_file) as src:
#     img = src.read(1)  # Read first band
#     plt.imshow(np.ma.masked_invalid(img), cmap="viridis")
#     plt.colorbar()
#     plt.title("CHL Data (First File)")
#     plt.show()


# In[98]:


# Reproject GeoTIFFs to EPSG:3857
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.tif') or "3857" in filename:
        continue
        
    # Open the original GeoTIFF
    input_tiff = os.path.join(temp_files_dir, filename)
    
    date_str = filename.split('_')[2].split('.')[0]
    output_tiff = os.path.join(temp_files_dir, f"chl_data_{date_str}_3857.tif")

    with rasterio.open(input_tiff) as src:
        # Get the original latitude range
        lat_min, lat_max = src.bounds.bottom, src.bounds.top

        # Check if latitude axis is inverted
        if lat_min > lat_max:
            #print(f"Flipping latitude for {filename}")
            img_data = src.read(1)
            img_data = np.flipud(img_data)  # Flip image vertically
        else:
            img_data = src.read(1)

        # Calculate new transformation for reprojection
        transform, width, height = calculate_default_transform(
            src.crs, "EPSG:3857", src.width, src.height, *src.bounds
        )

        # Update metadata
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
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs="EPSG:3857",
                resampling=Resampling.bilinear
            )

    #print(f"Saved reprojected GeoTIFF: {output_tiff}")


# In[99]:


# test_file = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/CHL2/temp_files/chl_data_20240801_3857.tif"

# with rasterio.open(test_file) as src:
#     img = src.read(1)  # Read first band
#     plt.imshow(np.ma.masked_invalid(img), cmap="viridis")
#     plt.colorbar()
#     plt.title("CHL Data (Second File)")
#     plt.show()


# In[100]:


# Generate VRT files
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('_3857.tif'):
        continue

    date_str = filename.split('_')[2].split('.')[0]
    tiff_3857 = os.path.join(temp_files_dir, filename)
    vrt_file = os.path.join(temp_files_dir, f"chl_data_{date_str}.vrt")

    #print(f"Creating VRT for {filename}...")

    subprocess.run([
        'gdal_translate', '-of', 'VRT', '-a_srs', 'EPSG:3857', 
        tiff_3857, vrt_file
    ])

    #print(f"Created VRT: {vrt_file}")


# In[101]:


# Step 3: Generate colorized VRTs
# Create colormap file for gdaldem color-relief
color_filename = os.path.join(base_dir, 'processed_data', 'CHL', 'thermal_colormap.txt')

colors = cmocean.cm.speed(np.linspace(0, 1, 255))  # Use 255 colors
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

    #print(f"Created colorized VRT: {colored_vrt_file}")


# In[102]:


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

    print(f"Creating tiles in: {tiles_directory}")

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

    #print(f"Generated tiles for {date_str} in {tiles_directory}")


# In[103]:


# Iterate over chl_stats dictionary
for dict_key in chl_stats.keys():
  # Convert dict_key (YYYYMMDD) -> (YYYY_DDD)
  year = dict_key[:4]  # Extract year (YYYY)
  month = dict_key[4:6]  # Extract month (MM)
  day = dict_key[6:8]  # Extract day (DD)

  # Convert to day-of-year (DDD)
  date_obj = datetime.strptime(f"{year}{month}{day}", "%Y%m%d")
  doy = date_obj.timetuple().tm_yday  # Get day-of-year (1-365)

  # Construct new directory name in YYYY_DDD format
  out_dir = os.path.join(tiles_dir, f"{year}_{doy:03d}")  # Ensure DDD is 3-digit
  #print(out_dir)

  # Create a dictionary with the chlorophyll range
  chl_range = {
      "min_chl": chl_stats[dict_key]['min'],
      "max_chl": chl_stats[dict_key]['max']
  }

  # Save JSON file in the correct tiles folder
  json_file_path = os.path.join(out_dir, "chl_range_global.json")
  with open(json_file_path, "w") as f:
      json.dump(chl_range, f, indent=4)

  #print(f"Saved range stats for {dict_key} ({year}_{doy:03d}) to {json_file_path}")


# In[107]:


#Clean up files
shutil.rmtree(temp_files_dir)

# Path for the temp_files directory
temp_files_dir = os.path.join(base_dir, 'processed_data', 'CHL', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)


# Cape cod tiles:

# In[105]:


tiles_dir = os.path.join(base_dir, 'processed_data', 'CHL', 'tiles')
os.makedirs(tiles_dir, exist_ok=True)


# In[112]:


# Define the bounds in lat/lon
cape_cod_bounds_latlon = {
    'min_lon': -74,
    'max_lon': -66,
    'min_lat': 38.8,
    'max_lat': 43.5
}

files = []
chl_data = {}
chl = {}
chl_stats = {}

# Get list of files and sort by date
for filename in os.listdir(raw_data_dir):
    if filename.endswith('.nc'):
        date_part = filename.split('_')[-1].split('.')[0]  # Extract "2025-02-02"
        date_cleaned = date_part.replace("-", "")  # "20250202"
        date_int = int(date_cleaned)
        if filename in raw_files_to_process:
            files.append((date_int, filename))

# Sort files by date
files.sort(key=lambda x: x[0])

# Process files
for date_int, filename in files:  # Process only the first 3 files for testing
    file_path = os.path.join(raw_data_dir, filename)
    dict_key = f"{date_int}"

    # Open dataset
    chl_data[dict_key] = xr.open_dataset(file_path)

    # Extract CHL variable
    chl_var = chl_data[dict_key]['CHL'].squeeze()

    # Mask values outside the Cape Cod region
    chl_var_masked = chl_var.where(
        (chl_data[dict_key]['longitude'] >= cape_cod_bounds_latlon['min_lon']) &
        (chl_data[dict_key]['longitude'] <= cape_cod_bounds_latlon['max_lon']) &
        (chl_data[dict_key]['latitude'] >= cape_cod_bounds_latlon['min_lat']) &
        (chl_data[dict_key]['latitude'] <= cape_cod_bounds_latlon['max_lat']),
        np.nan  # Set everything outside the bounds to NaN
    )

    # Store the masked CHL data
    chl[dict_key] = chl_var_masked
    
    chl_masked = np.ma.masked_invalid(chl[dict_key])
    valid_data = chl_masked.compressed()  # Convert MaskedArray to a regular array of valid (non-NaN) values

    if valid_data.size == 0:
        # If there's NO data at all for this region/time, skip percentile or set them to NaN
        print(f"[WARNING] No valid data for {dict_key}. Creating empty TIF with all NaN.")

        # Create an array of all masked values
        chl_scaled = np.ma.masked_all_like(chl_masked)

        # Optionally record NaN range, or skip
        chl_min_original, chl_max_original = np.nan, np.nan
    else:
        # If we have at least some data, do your usual percentile calculations
        chl_min_original, chl_max_original = np.nanpercentile(valid_data, [0, 99])

        # Apply your log scaling function
        chl_scaled = apply_log_scaling(chl_masked)

    # (Optional) Store or print your min/max stats in chl_stats
    chl_stats[dict_key] = {'min': float(chl_min_original), 'max': float(chl_max_original)}

#     # Convert to masked array
#     chl_masked = np.ma.masked_invalid(chl[dict_key])
    
#     chl_min_original, chl_max_original = np.nanpercentile(chl_masked.compressed(), [0, 99])


#     # Apply log scaling WITHOUT losing masked values
#     chl_scaled = apply_log_scaling(chl_masked)  # No .filled(np.nan)!
    
#     chl_stats[dict_key] = {'min': float(chl_min_original), 'max': float(chl_max_original)}

    # Assign CRS if missing
    if 'crs' not in chl_data[dict_key].attrs:
        chl_data[dict_key] = chl_data[dict_key].rio.write_crs("EPSG:32662")

    #print(f"Assigned CRS for {filename}: {chl_data[dict_key].rio.crs}")

    # Extract coordinate bounds
    lon_min, lon_max = chl_data[dict_key]['longitude'].values.min(), chl_data[dict_key]['longitude'].values.max()
    lat_min, lat_max = chl_data[dict_key]['latitude'].values.min(), chl_data[dict_key]['latitude'].values.max()

    #print(f"Latitude order before checking: {chl_data[dict_key]['latitude'].values}")

    # **Ensure CRS is EPSG:4326**
    if -180 <= lon_min <= 180 and -90 <= lat_min <= 90:
        #print(f"Data appears to be in degrees; setting CRS as EPSG:4326 for {filename}.")
        chl_data[dict_key] = chl_data[dict_key].rio.write_crs("EPSG:4326")
    
    # **If CRS is EPSG:32662, reproject to EPSG:4326**
    if chl_data[dict_key].rio.crs.to_epsg() == 32662:
        chl_data[dict_key] = chl_data[dict_key].rio.reproject("EPSG:4326")

        #print(f"Reprojected {filename} to EPSG:4326.")

    # **Check if latitude is inverted**
    if chl_data[dict_key]['latitude'][0] < chl_data[dict_key]['latitude'][-1]:  
        #print(f"Flipping latitude order for {filename}")
        
        # Flip data **AND** latitude axis
        chl_scaled = np.flipud(chl_scaled)  
        chl_data[dict_key] = chl_data[dict_key].assign_coords(
            latitude=chl_data[dict_key]['latitude'][::-1]
        )

    #print(f"Latitude order AFTER checking: {chl_data[dict_key]['latitude'].values}")

    # **Define correct transform**
    transform = from_bounds(
        lon_min, lat_max,  # Top-left (max latitude)
        lon_max, lat_min,  # Bottom-right (min latitude)
        chl[dict_key].shape[1],  # Raster width (columns)
        chl[dict_key].shape[0]   # Raster height (rows)
    )

    # **Save as GeoTIFF**
    output_file = os.path.join(temp_files_dir, f"chl_data_{dict_key}.tif")
    with rasterio.open(
        output_file,
        'w',
        driver='GTiff',
        height=chl_scaled.shape[0],
        width=chl_scaled.shape[1],
        count=1,
        dtype=str(chl_scaled.dtype),
        crs="EPSG:4326",
        transform=transform
    ) as dst:
        dst.write(chl_scaled.filled(np.nan), 1)

    print(f"Saved GeoTIFF: {output_file}")


# In[115]:


# test_file = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/CHL/temp_files/chl_data_20240810.tif"

# with rasterio.open(test_file) as src:
#     img = src.read(1)  # Read first band
#     plt.imshow(np.ma.masked_invalid(img), cmap="viridis")
#     plt.colorbar()
#     plt.title("CHL Data (First File)")
#     plt.show()


# In[116]:


# Reproject GeoTIFFs to EPSG:3857
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.tif') or "3857" in filename:
        continue
        
    # Open the original GeoTIFF
    input_tiff = os.path.join(temp_files_dir, filename)
    
    date_str = filename.split('_')[2].split('.')[0]
    output_tiff = os.path.join(temp_files_dir, f"chl_data_{date_str}_3857.tif")

    with rasterio.open(input_tiff) as src:
        # Get the original latitude range
        lat_min, lat_max = src.bounds.bottom, src.bounds.top

        # Check if latitude axis is inverted
        if lat_min > lat_max:
            print(f"Flipping latitude for {filename}")
            img_data = src.read(1)
            img_data = np.flipud(img_data)  # Flip image vertically
        else:
            img_data = src.read(1)

        # Calculate new transformation for reprojection
        transform, width, height = calculate_default_transform(
            src.crs, "EPSG:3857", src.width, src.height, *src.bounds
        )

        # Update metadata
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
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs="EPSG:3857",
                resampling=Resampling.bilinear
            )

    #print(f"Saved reprojected GeoTIFF: {output_tiff}")


# In[119]:


# test_file = "/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/CHL/temp_files/chl_data_20240801_3857.tif"

# with rasterio.open(test_file) as src:
#     img = src.read(1)  # Read first band
#     plt.imshow(np.ma.masked_invalid(img), cmap="viridis")
#     plt.colorbar()
#     plt.title("CHL Data (Second File)")
#     plt.show()


# In[120]:


# Generate VRT files
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('_3857.tif'):
        continue

    date_str = filename.split('_')[2].split('.')[0]
    tiff_3857 = os.path.join(temp_files_dir, filename)
    vrt_file = os.path.join(temp_files_dir, f"chl_data_{date_str}.vrt")

    print(f"Creating VRT for {filename}...")

    subprocess.run([
        'gdal_translate', '-of', 'VRT', '-a_srs', 'EPSG:3857', 
        tiff_3857, vrt_file
    ])

    #print(f"Created VRT: {vrt_file}")


# In[121]:


# Step 3: Generate colorized VRTs
# Create colormap file for gdaldem color-relief
color_filename = os.path.join(base_dir, 'processed_data', 'CHL', 'thermal_colormap.txt')

colors = cmocean.cm.speed(np.linspace(0, 1, 255))  # Use 255 colors
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

    print(f"Creating colorized VRT for {filename}...")

    subprocess.run([
        'gdaldem', 'color-relief', vrt_file, color_filename, colored_vrt_file, '-of', 'VRT', '-alpha'
    ])

    print(f"Created colorized VRT: {colored_vrt_file}")


# In[122]:


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

    print(f"Creating tiles in: {tiles_directory}")

    # subprocess.run([
    #     'gdal2tiles.py', 
    #     '--config', 'GDAL_PAM_ENABLED', 'NO',
    #     '-p', 'mercator', 
    #     '-z', '8-10', 
    #     '-r', 'bilinear', 
    #     '-w', 'none',
    #     '--xyz',
    #     colored_vrt_file, 
    #     tiles_directory
    # ])
    
    # Generate tiles using gdal2tiles with internal parallel processing
    gdal2tiles_command = [
        'gdal2tiles.py', 
        '--config', 'GDAL_PAM_ENABLED', 'NO',
        '--profile=mercator', 
        '--webviewer=none', 
        '--xyz',
        '--processes=24',  # Let gdal2tiles handle multiprocessing
        '--tiledriver=PNG',
        '-z', '8-10',  # Adjust zoom levels as needed
        colored_vrt_file, 
        tiles_directory
    ]

    # Run the command
    subprocess.run(gdal2tiles_command)

    #print(f"Generated tiles for {date_str} in {tiles_directory}")


# In[123]:


# Iterate over chl_stats dictionary
for dict_key in chl_stats.keys():
   # Convert dict_key (YYYYMMDD) -> (YYYY_DDD)
   year = dict_key[:4]  # Extract year (YYYY)
   month = dict_key[4:6]  # Extract month (MM)
   day = dict_key[6:8]  # Extract day (DD)

   # Convert to day-of-year (DDD)
   date_obj = datetime.strptime(f"{year}{month}{day}", "%Y%m%d")
   doy = date_obj.timetuple().tm_yday  # Get day-of-year (1-365)

   # Construct new directory name in YYYY_DDD format
   out_dir = os.path.join(tiles_dir, f"{year}_{doy:03d}")  # Ensure DDD is 3-digit
   #print(out_dir)

   # Create a dictionary with the chlorophyll range
   chl_range = {
       "min_chl": chl_stats[dict_key]['min'],
       "max_chl": chl_stats[dict_key]['max']
   }

   # Save JSON file in the correct tiles folder
   json_file_path = os.path.join(out_dir, "chl_range_local.json")
   with open(json_file_path, "w") as f:
       json.dump(chl_range, f, indent=4)

   #print(f"Saved range stats for {dict_key} ({year}_{doy:03d}) to {json_file_path}")


# In[124]:


#Clean up files
shutil.rmtree(temp_files_dir)


# In[126]:


# Get all folder names in the tiles_3day directory and sort them
dates = sorted([folder for folder in os.listdir(tiles_dir) if os.path.isdir(os.path.join(tiles_dir, folder))])

print("Found Chloro dates:", dates)

# Output the list of dates to a txt file
output_path = os.path.join(base_dir, 'processed_data', 'CHL', 'chl_dates.txt')

# Open the file in write mode
with open(output_path, 'w') as f:
    for date in dates:
        formatted_date = date.replace('_', '')  # Replace underscores with no separator
        f.write(f"{formatted_date}\n")  # Write the formatted date to the file

print(f"Saved list of Chloro dates to {output_path}")




