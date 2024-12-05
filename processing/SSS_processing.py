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


# In[3]:


# Define directories
base_dir = '/vast/clidex/data/obs/CCCFA'
raw_data_dir = os.path.join(base_dir, 'raw_data', 'SSS')
tiles_dir = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles_mirrored')

# Get list of existing tile dates
existing_tiles = set()

for folder_name in os.listdir(tiles_dir):
    if os.path.isdir(os.path.join(tiles_dir, folder_name)) and folder_name.startswith('2024_'):
        # Convert tile folder name (e.g., 2024_211) to raw file format (e.g., 2024211)
        date_str = folder_name  #.replace('_', '')
        existing_tiles.add(date_str)

# Get list of raw data files to process
raw_files_to_process = []

for filename in os.listdir(raw_data_dir):
    if filename.endswith('.nc'):  # Adjusted to match .nc files
        # Extract date from raw file name (e.g., RSS_smap_SSS_L3_8day_running_2024_210_FNL_v06.0.nc -> 2024_210)
        date_in_filename = '_'.join(filename.split('_')[6:8])  # Extract 2024_210
        if date_in_filename not in existing_tiles:
            raw_files_to_process.append(filename)

# Output filtered file list
print("Files to process:")
print(raw_files_to_process)


# In[4]:


# Path for the temp_files directory
temp_files_dir = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)

# Load all SSS data files in the directory and store in a dictionary
sss_data = {}
sss = {}
sss_subset = {}
sss_subset_masked = {}

raw_data_dir = os.path.join(base_dir, 'raw_data', 'SSS')

# Define Atlantic region bounds
bounds = {
    'min_lon': 274.93,
    'max_lon': 300.06,
    'min_lat': 22.10,
    'max_lat': 46.06
}

# Define Great Lakes approximate bounding box
great_lakes_bounds = {
    'min_lon': 276.0,
    'max_lon': 290.0,
    'min_lat': 41.0,
    'max_lat': 46.5
}

# Use the filtered file list for processing
files = []
for filename in raw_files_to_process:  # Use the filtered file list
    if filename.endswith('.nc'):  
        date_str = '_'.join(filename.split('_')[6:8])  # Extract date string (e.g., '2024_210')
        files.append((date_str, filename))

files.sort()  # Sort by the extracted date
#print(files)

# Load the data
for date_str, filename in files:

    file_path = os.path.join(raw_data_dir, filename)
    sss_data[date_str] = xr.open_dataset(file_path)
    
    # Store the SST data
    sss[date_str] = sss_data[date_str]['sss_smap_40km'].squeeze()

    # Subset the data using Atlantic bounds
    sss_subset[date_str] = sss[date_str].sel(lat=slice(bounds['min_lat'], bounds['max_lat']), lon=slice(bounds['min_lon'], bounds['max_lon']))

    # Mask invalid data
    sss_subset_masked[date_str] = np.ma.masked_invalid(sss_subset[date_str].values)

    # Apply Great Lakes mask
    lat, lon = np.meshgrid(sss_subset[date_str]['lat'].values, sss_subset[date_str]['lon'].values, indexing='ij')
    great_lakes_mask = ((lon >= great_lakes_bounds['min_lon']) & (lon <= great_lakes_bounds['max_lon']) &
                        (lat >= great_lakes_bounds['min_lat']) & (lat <= great_lakes_bounds['max_lat']))
    
    sss_subset_masked[date_str] = np.ma.masked_where(great_lakes_mask, sss_subset_masked[date_str])

    # Define transform (origin: top-left corner) and resolution
    transform = from_origin(sss_subset[date_str]['lon'].values.min(), sss_subset[date_str]['lat'].values.max(), 750, 750)  # 250m resolution

    # Save the masked SST data as a GeoTIFF
    with rasterio.open(
        os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files', f"sss_data_{date_str}.tif"), 
        'w', 
        driver='GTiff', 
        height=sss_subset_masked[date_str].shape[0], 
        width=sss_subset_masked[date_str].shape[1], 
        count=1, 
        dtype=str(sss_subset_masked[date_str].dtype),
        crs='EPSG:3857', 
        transform=transform
    ) as dst:
        dst.write(sss_subset_masked[date_str].filled(np.nan), 1)


# In[5]:


def fix_geotiff_bounds(sss_data, temp_directory, base_dir):
    """
    Fix the bounds of GeoTIFF files using SSS data coordinates.
    
    Parameters:
    -----------
    sss_data : dict
        Dictionary containing SSS xarray datasets
    temp_directory : str
        Path to directory containing temporary files
    base_dir : str
        Base directory path
    """
    # Process each file in the temp directory
    for filename in os.listdir(temp_directory):
            
        # Get the date from filename
        date_str = filename[9:17]
        #print(date_str)
        
        # Input and output file paths
        input_file = os.path.join(temp_directory, filename)
        fixed_file = os.path.join(temp_directory, f"{filename.split('.')[0]}_fixed.tif")

        # Get bounds from SSS data for this date
        min_lon = float(sss_subset[date_str]['lon'].values.min())
        max_lon = float(sss_subset[date_str]['lon'].values.max())
        min_lat = float(sss_subset[date_str]['lat'].values.min())
        max_lat = float(sss_subset[date_str]['lat'].values.max())
        
        # print(f"Processing {filename}")
        # print(f"Bounds: lon [{min_lon:.2f}, {max_lon:.2f}], lat [{min_lat:.2f}, {max_lat:.2f}]")

        # Open and fix the file
        with rasterio.open(input_file, 'r+') as src:
            # Calculate new transform
            transform = from_bounds(min_lon, min_lat, max_lon, max_lat, 
                                 src.width, src.height)
            
            # Update metadata
            kwargs = src.meta.copy()
            kwargs.update({
                'transform': transform,
                'crs': 'EPSG:3857'
            })

            # Write fixed file
            with rasterio.open(fixed_file, 'w', **kwargs) as dst:
                dst.write(src.read())
        
        # print(f"Created fixed file: {fixed_file}")

# Usage:
fix_geotiff_bounds(sss_data, temp_files_dir, base_dir)


# In[6]:


for filename in os.listdir(temp_files_dir):
    if not filename.endswith('fixed.tif'):
        continue
        
    # Get the date from filename
    date_str = filename[9:17]  # Extract '2024_XXX' from filename
    
    # Input and output file paths
    fixed_file = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files', f"sss_data_{date_str}_fixed.tif")
    vrt_file = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files', f"temp_{date_str}.vrt")
    tiles_directory = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles')

    # Open the fixed file and get its bounds
    with rasterio.open(fixed_file) as src:
        bounds = src.bounds
        # print(bounds)

    # Set the corner coordinates using the bounds
    upper_left_x1, lower_right_y1, lower_right_x1, upper_left_y1 = bounds

    # Create a transformer to convert from EPSG:4326 to EPSG:3857
    transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    upper_left_x, upper_left_y = transformer.transform(upper_left_x1, upper_left_y1)
    lower_right_x, lower_right_y = transformer.transform(lower_right_x1, lower_right_y1)

    # print("Upper Left X:", upper_left_x)
    # print("Upper Left Y:", upper_left_y)
    # print("Lower Right X:", lower_right_x)
    # print("Lower Right Y:", lower_right_y)

#     # Create and run gdal_translate command
    translate_command = [
        'gdal_translate', '-of', 'VRT', '-ot', 'Byte', '-scale',
        '-a_srs', 'EPSG:3857',
        '-a_ullr',
        str(upper_left_x), str(upper_left_y),
        str(lower_right_x), str(lower_right_y),
        fixed_file, vrt_file
    ]
    
    subprocess.run(translate_command)


# In[7]:


# Create a color file for gdal_translate
colors = cmocean.cm.haline(np.linspace(0, 1, 255))  # Use 255 colors instead of 256
color_filename = os.path.join(base_dir, 'processed_data', 'SSS', 'thermal_colormap.txt')
with open(color_filename, 'w') as f:
    f.write("0 0 0 0 0\n")  # Add transparent color for masked values (index 0)
    for i, color in enumerate(colors, start=1):
        f.write(f"{i} {int(color[0]*255)} {int(color[1]*255)} {int(color[2]*255)} 255\n")


        
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.vrt'):
        continue
        
    # Get the date from filename
    date_str = filename[5:13]

    # Create a colored VRT file
    colored_vrt_file = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files', f"colored_{date_str}.vrt")
    gdaldem_command = [
        'gdaldem', 'color-relief', vrt_file, color_filename, colored_vrt_file, '-of', 'VRT', '-alpha'
    ]
    subprocess.run(gdaldem_command)


# In[65]:


# for filename in os.listdir(temp_files_dir):
#     if not filename.startswith('color'):
#         continue
        
#     # Get the date from filename
#     date_str = filename[8:16]  # Extract '2024_XXX' from filename
#     colored_vrt_file = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files', f"colored_{date_str}.vrt")
#     # print(colored_vrt_file)

#     tiles_directory = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles', date_str)
#     # print(tiles_directory)


#     # #Generate tiles
#     gdal2tiles_command = [
#         'gdal2tiles.py', 
#         '--config', 'GDAL_PAM_ENABLED', 'NO',
#         '-p', 'mercator', 
#         '-z', '0-7', 
#         '-r', 'bilinear', 
#         '-w', 'none',
#         '--xyz',
#         colored_vrt_file, 
#         tiles_directory
#     ]

#     # Run gdal2tiles to generate tiles
#     subprocess.run(gdal2tiles_command)


# In[8]:


from pathlib import Path

# Define paths
base_dir = Path('/vast/clidex/data/obs/CCCFA')
original_tiles_dir = base_dir / 'processed_data' / 'SSS' / 'tiles'
temp_dir = base_dir / 'processed_data' / 'SSS' / 'temp_files'
mirrored_tiles_dir = base_dir / 'processed_data' / 'SSS' / 'tiles_mirrored'

# Create directories
temp_dir.mkdir(parents=True, exist_ok=True)
mirrored_tiles_dir.mkdir(parents=True, exist_ok=True)

# Process each colored VRT
for vrt_file in list(temp_dir.glob('colored_*.vrt')):  # Process first 3 files
    date_str = vrt_file.name[8:16]
    print(f"Processing {date_str}")
    
    # Create intermediate files
    warped_tif = temp_dir / f"warped_{date_str}.tif"
    gcp_vrt = temp_dir / f"gcp_{date_str}.vrt"
    flipped_tif = temp_dir / f"flipped_{date_str}.tif"
    
    # First, warp to consistent projection
    subprocess.run([
        'gdalwarp',
        '-t_srs', 'EPSG:3857',
        '-r', 'bilinear',
        str(vrt_file),
        str(warped_tif)
    ], check=True)
    
    # Get image dimensions and bounds
    with rasterio.open(warped_tif) as src:
        bounds = src.bounds
        height = src.height
        width = src.width
    
    # Add GCPs to flip the image
    subprocess.run([
        'gdal_translate',
        '-of', 'VRT',
        '-a_srs', 'EPSG:3857',
        '-gcp', '0', '0', str(bounds.left), str(bounds.bottom),
        '-gcp', str(width), '0', str(bounds.right), str(bounds.bottom),
        '-gcp', '0', str(height), str(bounds.left), str(bounds.top),
        '-gcp', str(width), str(height), str(bounds.right), str(bounds.top),
        str(warped_tif),
        str(gcp_vrt)
    ], check=True)
    
    # Apply the GCP transformation
    subprocess.run([
        'gdalwarp',
        '-r', 'bilinear',
        '-ts', str(width), str(height),
        '-overwrite',
        '-co', 'COMPRESS=LZW',
        str(gcp_vrt),
        str(flipped_tif)
    ], check=True)
    
    # Generate tiles from flipped TIF
    output_dir = mirrored_tiles_dir / date_str
    subprocess.run([
        'gdal2tiles.py',
        '--config', 'GDAL_PAM_ENABLED', 'NO',
        '-p', 'mercator',
        '-z', '0-7',
        '-r', 'bilinear',
        '-w', 'none',
        '--xyz',
        str(flipped_tif),
        str(output_dir)
    ], check=True)
    
    print(f"Created mirrored tiles for {date_str}")
    
    # Clean up intermediate files
    warped_tif.unlink(missing_ok=True)
    gcp_vrt.unlink(missing_ok=True)
    flipped_tif.unlink(missing_ok=True)

print("Completed mirroring tiles!")


# In[9]:


range_dir = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles_mirrored')
for filename in os.listdir(range_dir):
    
    date_str = filename
    
    # Skip if the date doesn't exist in the SSS dictionary
    if date_str not in sss:
        # print(f"No data found for {date_str}, skipping...")
        continue

    #Define max/min values
    min_SSS = float(sss_subset_masked[filename].min())
    max_SSS = float(sss_subset_masked[filename].max())

    # Create a dictionary with the temperature range
    temp_range = {
        "min_SSS": round(min_SSS, 2),
        "max_SSS": round(max_SSS, 2)
    }

    # Save to JSON file
    with open(os.path.join(range_dir, filename, 'sss_range_global.json'), 'w') as f:
        json.dump(temp_range, f) 


# Now lets make our refined cape view:

# In[10]:


# Define base directory
base_dir = '/vast/clidex/data/obs/CCCFA'

# Path for the temp_files directory
temp_files_dir = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)

# Load all SSS data files in the directory and store in a dictionary
sss_data = {}
sss = {}
sss_subset = {}
sss_subset_masked = {}

raw_data_dir = os.path.join(base_dir, 'raw_data', 'SSS')

# Define the bounds in lat/lon
bounds = {
    'min_lon': 360-74,
    'max_lon': 360-66,
    'min_lat': 40.5,
    'max_lat': 43.5
}

# Use the filtered file list for processing
files = []
for filename in raw_files_to_process:  # Use the filtered file list
    if filename.endswith('.nc'):  
        date_str = '_'.join(filename.split('_')[6:8])  # Extract date string (e.g., '2024_210')
        files.append((date_str, filename))

files.sort()  # Sort by the extracted date
print(files)

# Load the data
for date_str, filename in files:

    file_path = os.path.join(raw_data_dir, filename)
    sss_data[date_str] = xr.open_dataset(file_path)
    
    # Store the SST data
    sss[date_str] = sss_data[date_str]['sss_smap_40km'].squeeze()

    # Subset the data using Atlantic bounds
    sss_subset[date_str] = sss[date_str].sel(lat=slice(bounds['min_lat'], bounds['max_lat']), lon=slice(bounds['min_lon'], bounds['max_lon']))

    # Mask invalid data
    sss_subset_masked[date_str] = np.ma.masked_invalid(sss_subset[date_str])

    # Define transform (origin: top-left corner) and resolution
    transform = from_origin(sss_subset[date_str]['lon'].values.min(), sss_subset[date_str]['lat'].values.max(), 250, 250)  # 250m resolution

    # Save the masked SST data as a GeoTIFF
    with rasterio.open(
        os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files', f"sss_data_{date_str}_local.tif"), 
        'w', 
        driver='GTiff', 
        height=sss_subset_masked[date_str].shape[0], 
        width=sss_subset_masked[date_str].shape[1], 
        count=1, 
        dtype=str(sss_subset_masked[date_str].dtype),
        crs='EPSG:3857', 
        transform=transform
    ) as dst:
        dst.write(sss_subset_masked[date_str].filled(np.nan), 1)


# In[11]:


def fix_geotiff_bounds(sss_data, temp_directory, base_dir):
    """
    Fix the bounds of GeoTIFF files using SSS data coordinates.
    
    Parameters:
    -----------
    sss_data : dict
        Dictionary containing SSS xarray datasets
    temp_directory : str
        Path to directory containing temporary files
    base_dir : str
        Base directory path
    """
    # Process each file in the temp directory
    for filename in os.listdir(temp_directory):
        if not filename.endswith('local.tif'):
            continue
            
        # Get the date from filename
        date_str = filename[9:17]
        # print(date_str)
        
        # Input and output file paths
        input_file = os.path.join(temp_directory, filename)
        fixed_file = os.path.join(temp_directory, f"{filename.split('.')[0]}_fixed.tif")

        # Get bounds from SSS data for this date
        min_lon = float(sss_subset[date_str]['lon'].values.min())
        max_lon = float(sss_subset[date_str]['lon'].values.max())
        min_lat = float(sss_subset[date_str]['lat'].values.min())
        max_lat = float(sss_subset[date_str]['lat'].values.max())
        
        # print(f"Processing {filename}")
        # print(f"Bounds: lon [{min_lon:.2f}, {max_lon:.2f}], lat [{min_lat:.2f}, {max_lat:.2f}]")

        # Open and fix the file
        with rasterio.open(input_file, 'r+') as src:
            # Calculate new transform
            transform = from_bounds(min_lon, min_lat, max_lon, max_lat, 
                                 src.width, src.height)
            
            # Update metadata
            kwargs = src.meta.copy()
            kwargs.update({
                'transform': transform,
                'crs': 'EPSG:3857'
            })

            # Write fixed file
            with rasterio.open(fixed_file, 'w', **kwargs) as dst:
                dst.write(src.read())
        
        # print(f"Created fixed file: {fixed_file}")

# Usage:
fix_geotiff_bounds(sss_data, temp_files_dir, base_dir)


# In[12]:


for filename in os.listdir(temp_files_dir):
    if not filename.endswith('local_fixed.tif'):
        continue
        
    # Get the date from filename
    date_str = filename[9:17]  # Extract '2024_XXX' from filename
    
    # Input and output file paths
    fixed_file = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files', f"sss_data_{date_str}_local_fixed.tif")
    vrt_file = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files', f"temp_{date_str}_local.vrt")
    tiles_directory = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles_local')

    # Open the fixed file and get its bounds
    with rasterio.open(fixed_file) as src:
        bounds = src.bounds
        # print(bounds)

    # Set the corner coordinates using the bounds
    upper_left_x1, lower_right_y1, lower_right_x1, upper_left_y1 = bounds

    # Create a transformer to convert from EPSG:4326 to EPSG:3857
    transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    upper_left_x, upper_left_y = transformer.transform(upper_left_x1, upper_left_y1)
    lower_right_x, lower_right_y = transformer.transform(lower_right_x1, lower_right_y1)

    # print("Upper Left X:", upper_left_x)
    # print("Upper Left Y:", upper_left_y)
    # print("Lower Right X:", lower_right_x)
    # print("Lower Right Y:", lower_right_y)

#     # Create and run gdal_translate command
    translate_command = [
        'gdal_translate', '-of', 'VRT', '-ot', 'Byte', '-scale',
        '-a_srs', 'EPSG:3857',
        '-a_ullr',
        str(upper_left_x), str(upper_left_y),
        str(lower_right_x), str(lower_right_y),
        fixed_file, vrt_file
    ]
    
    subprocess.run(translate_command)


# In[13]:


for filename in os.listdir(temp_files_dir):
    if not filename.endswith('local.vrt'):
        continue
        
    # Get the date from filename
    date_str = filename[5:13]

    # Create a colored VRT file
    colored_vrt_file = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files', f"colored_{date_str}_local.vrt")
    gdaldem_command = [
        'gdaldem', 'color-relief', vrt_file, color_filename, colored_vrt_file, '-of', 'VRT', '-alpha'
    ]
    subprocess.run(gdaldem_command)


# In[72]:


# for filename in os.listdir(temp_files_dir):
#     if not filename.startswith('color'):
#         continue
        
#     # Get the date from filename
#     date_str = filename[8:16]  # Extract '2024_XXX' from filename
#     colored_vrt_file = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files', f"colored_{date_str}.vrt")
#     # print(colored_vrt_file)

#     tiles_directory = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles', date_str)
#     # print(tiles_directory)


#     # #Generate tiles
#     gdal2tiles_command = [
#         'gdal2tiles.py', 
#         '--config', 'GDAL_PAM_ENABLED', 'NO',
#         '-p', 'mercator', 
#         '-z', '0-7', 
#         '-r', 'bilinear', 
#         '-w', 'none',
#         '--xyz',
#         colored_vrt_file, 
#         tiles_directory
#     ]

#     # Run gdal2tiles to generate tiles
#     subprocess.run(gdal2tiles_command)


# In[14]:


from pathlib import Path

# Define paths
base_dir = Path('/vast/clidex/data/obs/CCCFA')
# original_tiles_dir = base_dir / 'processed_data' / 'SSS' / 'tiles'
temp_dir = base_dir / 'processed_data' / 'SSS' / 'temp_files'
mirrored_tiles_dir = base_dir / 'processed_data' / 'SSS' / 'tiles_mirrored_local'

# Create directories
temp_dir.mkdir(parents=True, exist_ok=True)
mirrored_tiles_dir.mkdir(parents=True, exist_ok=True)

# Process each colored VRT
for vrt_file in list(temp_dir.glob('colored_*_local.vrt')): 
    date_str = vrt_file.name[8:16]
    # print(f"Processing {date_str}")
    
    # Create intermediate files
    warped_tif = temp_dir / f"warped_{date_str}.tif"
    gcp_vrt = temp_dir / f"gcp_{date_str}.vrt"
    flipped_tif = temp_dir / f"flipped_{date_str}.tif"
    
    # First, warp to consistent projection
    subprocess.run([
        'gdalwarp',
        '-t_srs', 'EPSG:3857',
        '-r', 'bilinear',
        str(vrt_file),
        str(warped_tif)
    ], check=True)
    
    # Get image dimensions and bounds
    with rasterio.open(warped_tif) as src:
        bounds = src.bounds
        height = src.height
        width = src.width
    
    # Add GCPs to flip the image
    subprocess.run([
        'gdal_translate',
        '-of', 'VRT',
        '-a_srs', 'EPSG:3857',
        '-gcp', '0', '0', str(bounds.left), str(bounds.bottom),
        '-gcp', str(width), '0', str(bounds.right), str(bounds.bottom),
        '-gcp', '0', str(height), str(bounds.left), str(bounds.top),
        '-gcp', str(width), str(height), str(bounds.right), str(bounds.top),
        str(warped_tif),
        str(gcp_vrt)
    ], check=True)
    
    # Apply the GCP transformation
    subprocess.run([
        'gdalwarp',
        '-r', 'bilinear',
        '-ts', str(width), str(height),
        '-overwrite',
        '-co', 'COMPRESS=LZW',
        str(gcp_vrt),
        str(flipped_tif)
    ], check=True)
    
    # Generate tiles from flipped TIF
    output_dir = mirrored_tiles_dir / date_str
    subprocess.run([
        'gdal2tiles.py',
        '--config', 'GDAL_PAM_ENABLED', 'NO',
        '-p', 'mercator',
        '-z', '8-10',
        '-r', 'bilinear',
        '-w', 'none',
        '--xyz',
        str(flipped_tif),
        str(output_dir)
    ], check=True)
    
    print(f"Created mirrored tiles for {date_str}")
    
    # Clean up intermediate files
    warped_tif.unlink(missing_ok=True)
    gcp_vrt.unlink(missing_ok=True)
    flipped_tif.unlink(missing_ok=True)

# print("Completed mirroring tiles!")


# In[15]:


for vrt_file in list(temp_dir.glob('colored_*_local.vrt')):  # Process first 3 files
    date_str = vrt_file.name[8:16]
    # Define the source and destination directories
    source_directory = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles_mirrored_local', date_str)
    destination_directory = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles_mirrored', date_str)

    # Ensure the destination directory exists
    os.makedirs(destination_directory, exist_ok=True)

    # Move each subdirectory from source to destination
    for item in os.listdir(source_directory):
        source_path = os.path.join(source_directory, item)
        destination_path = os.path.join(destination_directory, item)
        
        # Move the directory or file
        if os.path.isdir(source_path):
            shutil.move(source_path, destination_path)
        else:
            shutil.copy2(source_path, destination_path)

    # Optionally, remove the now-empty source directory
    shutil.rmtree(source_directory)


# In[16]:


range_dir = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles_mirrored')
for filename in os.listdir(range_dir):
    
    date_str = filename
    
    # Skip if the date doesn't exist in the SSS dictionary
    if date_str not in sss:
        # print(f"No data found for {date_str}, skipping...")
        continue

    #Define max/min values
    min_SSS = float(sss_subset_masked[filename].min())
    max_SSS = float(sss_subset_masked[filename].max())

    # Create a dictionary with the temperature range
    temp_range = {
        "min_SSS": round(min_SSS, 2),
        "max_SSS": round(max_SSS, 2)
    }

    # Save to JSON file
    with open(os.path.join(range_dir, filename, 'sss_range_local.json'), 'w') as f:
        json.dump(temp_range, f) 


# Removing all intermittent steps to save space:

# In[17]:


#Tidying up folders and removing unnecessary files
local_tiles_dir = os.path.join(base_dir, 'processed_data', 'SSS', 'tiles_mirrored_local')
shutil.rmtree(local_tiles_dir)

temp_directory = os.path.join(base_dir, 'processed_data', 'SSS', 'temp_files')
shutil.rmtree(temp_directory)


# In[ ]:




