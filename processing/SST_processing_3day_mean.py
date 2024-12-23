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
base_dir = '/home/finn.wimberly/Documents/CCCFA_app_dev/Project/data'
raw_data_dir = '/vast/clidex/data/obs/SST/NOAAVIIRS'
tiles_dir = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day')

# Get list of existing tile dates
existing_tiles = set()

for folder_name in os.listdir(tiles_dir):
    if os.path.isdir(os.path.join(tiles_dir, folder_name)) and folder_name.startswith('2024_'):
        # Convert tile folder name (e.g., 2024_211) to raw file format (e.g., 2024211)
        date_str = folder_name.replace('_', '')
        existing_tiles.add(date_str)

# Get list of raw data files to process
raw_files_to_process = []

for filename in os.listdir(raw_data_dir):
    if filename.endswith('.nc4') and 'DAILY' not in filename:  # Ensure it's a 3-day file
        # Extract date from raw file name (e.g., ACSPOCW_2024211_3DAY_MULTISAT_SST-NGT_EC_750M.nc4 -> 2024211)
        date_in_filename = filename.split('_')[1]  # Extract 2024211
        if date_in_filename not in existing_tiles and int(date_in_filename) >= 2024210:
            raw_files_to_process.append(filename)

# Output filtered file list
print("Files to process:")
print(raw_files_to_process)


# In[5]:


# Path for the temp_files directory
temp_files_dir = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day')
os.makedirs(temp_files_dir, exist_ok=True)

# Load all SST data files in the directory and store in a dictionary
sst_data = {}
sst = {}
raw_data_dir = '/vast/clidex/data/obs/SST/NOAAVIIRS'

# Load the data for filtered files
files = []
for filename in raw_files_to_process:  # Use the filtered file list
    day = int(filename.split('_')[1][4:])  # Extract day of year from raw filename (e.g., 2024211 -> 211)
    files.append((day, filename))

files.sort()  # Sort by day of year

# Load the data
for day, filename in files:
    file_path = os.path.join(raw_data_dir, filename)
    sst_data[f"2024{day:03d}"] = xr.open_dataset(file_path)
    
    # Store the SST data
    sst[f"2024{day:03d}"] = sst_data[f"2024{day:03d}"]['sst'].squeeze()

    # Mask NaN values (or use your specific missing value markers)
    sst_masked = np.ma.masked_invalid(sst[f"2024{day:03d}"])

    # Define transform (origin: top-left corner) and resolution
    transform = from_origin(sst_data[f"2024{day:03d}"]['lon'].values.min(), sst_data[f"2024{day:03d}"]['lat'].values.max(), 750, 750)  # 750m resolution
    print(transform)

    # Save the SST data as a GeoTIFF
    output_file = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"sst_data_2024{day:03d}.tif")
    with rasterio.open(
        output_file, 
        'w', 
        driver='GTiff', 
        height=sst_masked.shape[0], 
        width=sst_masked.shape[1], 
        count=1, 
        dtype=str(sst_masked.dtype),
        crs='EPSG:3857', 
        transform=transform
    ) as dst:
        dst.write(sst_masked.filled(np.nan), 1)
    print(f"Saved GeoTIFF: {output_file}")


# In[6]:


def fix_geotiff_bounds(sst_data, temp_directory, base_dir):
    """
    Fix the bounds of GeoTIFF files using SST data coordinates.
    
    Parameters:
    -----------
    sst_data : dict
        Dictionary containing SST xarray datasets
    temp_directory : str
        Path to directory containing temporary files
    base_dir : str
        Base directory path
    """
    # Process each file in the temp directory
    for filename in os.listdir(temp_directory):
        if not filename.endswith('.tif'):
            continue
            
        # Get the date from filename
        date_str = filename.split('_')[2].split('.')[0]  # Extract '2024XXX' from filename
        
        # Input and output file paths
        input_file = os.path.join(temp_directory, filename)
        fixed_file = os.path.join(temp_directory, f"{filename.split('.')[0]}_fixed.tif")

        # Get bounds from SST data for this date
        min_lon = float(sst_data[date_str]['lon'].values.min())
        max_lon = float(sst_data[date_str]['lon'].values.max())
        min_lat = float(sst_data[date_str]['lat'].values.min())
        max_lat = float(sst_data[date_str]['lat'].values.max())
        
        # print(f"Processing {filename}")
        print(f"Bounds: lon [{min_lon:.2f}, {max_lon:.2f}], lat [{min_lat:.2f}, {max_lat:.2f}]")

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
fix_geotiff_bounds(sst_data, temp_files_dir, base_dir)


# In[7]:


for filename in os.listdir(temp_files_dir):
    if not filename.endswith('fixed.tif'):
        continue
        
    # Get the date from filename
    date_str = filename.split('_')[2].split('.')[0]  # Extract '2024XXX' from filename
    
    # Input and output file paths
    fixed_file = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"sst_data_{date_str}_fixed.tif")
    vrt_file = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"temp_{date_str}.vrt")
    tiles_directory = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day/')

    # Open the fixed file and get its bounds
    with rasterio.open(fixed_file) as src:
        bounds = src.bounds
        print(bounds)

    # Set the corner coordinates using the bounds
    upper_left_x1, lower_right_y1, lower_right_x1, upper_left_y1 = bounds

    # Create a transformer to convert from EPSG:4326 to EPSG:3857
    transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    upper_left_x, upper_left_y = transformer.transform(upper_left_x1, upper_left_y1)
    lower_right_x, lower_right_y = transformer.transform(lower_right_x1, lower_right_y1)

    # Create and run gdal_translate command
    translate_command = [
        'gdal_translate', '-of', 'VRT', '-ot', 'Byte', '-scale',
        '-a_srs', 'EPSG:3857',
        '-a_ullr',
        str(upper_left_x), str(upper_left_y),
        str(lower_right_x), str(lower_right_y),
        fixed_file, vrt_file
    ]
    
    subprocess.run(translate_command)


# In[8]:


# Create a color file for gdal_translate
colors = cmocean.cm.thermal(np.linspace(0, 1, 255))  # Use 255 colors instead of 256
color_filename = os.path.join(base_dir, 'processed_data', 'SST', 'thermal_colormap.txt')
with open(color_filename, 'w') as f:
    f.write("0 0 0 0 0\n")  # Add transparent color for masked values (index 0)
    for i, color in enumerate(colors, start=1):
        f.write(f"{i} {int(color[0]*255)} {int(color[1]*255)} {int(color[2]*255)} 255\n")


        
for filename in os.listdir(temp_files_dir):
    if not filename.endswith('.vrt'):
        continue
        
    # Get the date from filename
    date_str = filename.split('_')[1].split('.')[0]  # Extract '2024XXX' from filename

    # Create a colored VRT file
    colored_vrt_file = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"colored_{date_str}.vrt")
    gdaldem_command = [
        'gdaldem', 'color-relief', vrt_file, color_filename, colored_vrt_file, '-of', 'VRT', '-alpha'
    ]
    subprocess.run(gdaldem_command)


# In[9]:


for filename in os.listdir(temp_files_dir):
    if not filename.startswith('color'):
        continue
    print(filename)    
    # Get the date from filename
    # date_str = filename.split('_')[1].split('.')[0]  # Extract '2024XXX' from filename
    raw_date_str = filename.split('_')[1].split('.')[0]  # Extract '2024XXX'
    year = raw_date_str[:4]
    day_of_year = raw_date_str[4:]
    date_str = f"{year}_{day_of_year}"  # Format as '2024_XXX'
    
    colored_vrt_file = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"colored_{raw_date_str}.vrt")

    tiles_directory = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day', date_str)


    #Generate tiles
    gdal2tiles_command = [
        'gdal2tiles.py', 
        '--config', 'GDAL_PAM_ENABLED', 'NO',
        '-p', 'mercator', 
        '-z', '0-7', 
        '-r', 'bilinear', 
        '-w', 'none',
        '--xyz',
        colored_vrt_file, 
        tiles_directory
    ]

    # Run gdal2tiles to generate tiles
    subprocess.run(gdal2tiles_command)


# In[12]:


# Define the directory containing the tiles
range_dir = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day')

# Loop through each file in the tiles directory
for filename in os.listdir(range_dir):
    # Extract the date from the filename (e.g., '2024_211.tif' -> '2024211')
    raw_date_str = f"2024{filename.split('_')[1].split('.')[0]}"  # Get '2024XXX'

    # Skip if the date doesn't exist in the SST dictionary
    if raw_date_str not in sst:
        # print(f"No data found for {raw_date_str}, skipping...")
        continue

    # Define max/min values from the SST data
    min_temp = float(sst[raw_date_str].min())
    max_temp = float(sst[raw_date_str].max())

    # Create a dictionary with the temperature range
    temp_range = {
        "min_temp": round(min_temp, 2),
        "max_temp": round(max_temp, 2)
    }

    # Define the path for the JSON file
    json_file_path = os.path.join(range_dir, filename.split('.')[0], 'sst_range_global.json')

    # Ensure the directory exists
    os.makedirs(os.path.dirname(json_file_path), exist_ok=True)

    # Save the temperature range to a JSON file
    with open(json_file_path, 'w') as f:
        json.dump(temp_range, f)
    print(f"Saved temperature range to {json_file_path}")


# Now lets make our refined cape view:

# In[14]:


# Load all SST data files in the directory and store in a dictionary
sst_data = {}
sst = {}

# Define the bounds in lat/lon
cape_cod_bounds_latlon = {
    'min_lon': -74,
    'max_lon': -66,
    'min_lat': 40.5,
    'max_lat': 43.5
}

# Transform bounds to Web Mercator
transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
min_x, min_y = transformer.transform(cape_cod_bounds_latlon['min_lon'], cape_cod_bounds_latlon['min_lat'])
max_x, max_y = transformer.transform(cape_cod_bounds_latlon['max_lon'], cape_cod_bounds_latlon['max_lat'])
#print(min_x, min_y, max_x, max_y)

# Load the data for filtered files
files = []
for filename in raw_files_to_process:  # Use the filtered file list
    day = int(filename.split('_')[1][4:])  # Extract day of year from raw filename (e.g., 2024211 -> 211)
    files.append((day, filename))

files.sort()  # Sort by day of year

# Load the data
for day, filename in files:

    file_path = os.path.join(raw_data_dir, filename)
    sst_data[f"2024{day:03d}"] = xr.open_dataset(file_path)
    
    # Store the SST data
    sst[f"2024{day:03d}"] = sst_data[f"2024{day:03d}"]['sst'].squeeze()

    # Subset the data using Web Mercator bounds
    sst_subset = sst[f"2024{day:03d}"].sel(x=slice(min_x, max_x), y=slice(max_y, min_y))

    sst_subset_masked = np.ma.masked_invalid(sst_subset.values)

    # Define transform (origin: top-left corner) and resolution
    transform = from_origin(sst_subset['lon'].values.min(), sst_subset['lat'].values.max(), 250, 250)  # 250m resolution
    #transform = from_origin(min_x, max_y, 250, 250)  # 250m resolution
    print(transform)

  # Save the SST data as a GeoTIFF
    with rasterio.open(
        os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"sst_data_2024{day:03d}_local.tif"), 
        'w', 
        driver='GTiff', 
        height=sst_subset_masked.shape[0], 
        width=sst_subset_masked.shape[1], 
        count=1, 
        dtype=str(sst_subset_masked.dtype),
        crs='EPSG:3857', 
        transform=transform
    ) as dst:
        dst.write(sst_subset_masked.filled(np.nan), 1)


# In[15]:


for day, filename in files:
    # Open your original GeoTIFF file
    input_file_local = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"sst_data_2024{day:03d}_local.tif")
    fixed_file_local = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"sst_data_2024{day:03d}_fixed_local.tif")

    # Define the correct bounds (min_lon, min_lat, max_lon, max_lat)
    sst_subset = sst[f"2024{day:03d}"].sel(x=slice(min_x, max_x), y=slice(max_y, min_y))

    # Replace these with the actual bounding box values from your SST dataset
    min_lon, max_lon = sst_subset['lon'].values.min(), sst_subset['lon'].values.max()
    min_lat, max_lat = sst_subset['lat'].values.min(), sst_subset['lat'].values.max()
    print(min_lon, max_lon, min_lat, max_lat)

    # Open the original file and fix the extent
    with rasterio.open(input_file_local, 'r+') as src:
        # Calculate the new transform with the correct bounds
        transform = from_bounds(min_lon, min_lat, max_lon, max_lat, src.width, src.height)
        print(transform)
        
        # Define the metadata for the new file with the correct bounds
        kwargs = src.meta.copy()
        kwargs.update({
            'transform': transform,
            'crs': 'EPSG:3857'
        })

        # Write the fixed GeoTIFF with correct bounds
        with rasterio.open(fixed_file_local, 'w', **kwargs) as dst:
            dst.write(src.read())


# In[16]:


for day, filename in files:
    fixed_file_local = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"sst_data_2024{day:03d}_fixed_local.tif")
    vrt_file_local = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"temp_2024{day:03d}_local.vrt")
    tiles_directory_local = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day_')

    # Open the fixed file and get its bounds
    with rasterio.open(fixed_file_local) as src:
        bounds = src.bounds
        # print(bounds)

    # Set the corner coordinates using the bounds
    upper_left_x1_local, lower_right_y1_local, lower_right_x1_local, upper_left_y1_local = bounds

    # Create a transformer to convert from EPSG:4326 to EPSG:3857
    transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

    # Convert the bounds to EPSG:3857
    upper_left_x_local, upper_left_y_local = transformer.transform(upper_left_x1_local, upper_left_y1_local)
    lower_right_x_local, lower_right_y_local = transformer.transform(lower_right_x1_local, lower_right_y1_local)
    # print(upper_left_x_local, upper_left_y_local, lower_right_x_local, lower_right_y_local)

    # Convert to VRT
    translate_command = [
        'gdal_translate', '-of', 'VRT', '-ot', 'Byte', '-scale', 
        '-a_srs', 'EPSG:3857', 
        '-a_ullr', 
        str(upper_left_x_local), str(upper_left_y_local), 
        str(lower_right_x_local), str(lower_right_y_local),
        fixed_file_local, vrt_file_local
    ]

    # Run gdal_translate to fix metadata
    subprocess.run(translate_command)


# In[17]:


# Create a colored files
for day, filename in files:
    vrt_file_local = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"temp_2024{day:03d}_local.vrt")
    colored_vrt_file_local = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"colored_2024{day:03d}_local.vrt")
    color_filename = os.path.join(base_dir, 'processed_data', 'SST', 'thermal_colormap.txt')

    gdaldem_command = [
        'gdaldem', 'color-relief', vrt_file_local, color_filename, colored_vrt_file_local, '-of', 'VRT', '-alpha'
    ]
    subprocess.run(gdaldem_command)


# In[18]:


for day, filename in files:

    # Define the correct path for the tiles directory
    tiles_directory_local = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day_local', f"2024_{day:03d}")
    colored_vrt_file_local = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day', f"colored_2024{day:03d}_local.vrt")


    # Generate tiles for local view (zoom levels 9-10)
    gdal2tiles_command = [
        'gdal2tiles.py', 
        '--config', 'GDAL_PAM_ENABLED', 'NO',
        '-p', 'mercator', 
        '-z', '8-10', 
        '-w', 'none',
        '--xyz',
        colored_vrt_file_local, 
        tiles_directory_local
    ]

    # Run gdal2tiles to generate tiles
    subprocess.run(gdal2tiles_command, check=True)


# In[20]:


# Load the data
for day, filename in files:

    # Subset the data using Web Mercator bounds
    sst_subset = sst[f"2024{day:03d}"].sel(x=slice(min_x, max_x), y=slice(max_y, min_y))

    min_temp = float(sst_subset.min())
    max_temp = float(sst_subset.max())

    # Create a dictionary with the temperature range
    temp_range = {
        "min_temp": round(min_temp, 2),
        "max_temp": round(max_temp, 2)
    }

    # Define the output directory for the JSON file
    json_dir = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day', f"2024_{day:03d}")

    # Create the directory if it doesn't exist
    os.makedirs(json_dir, exist_ok=True)

    # Save to JSON file
    json_path = os.path.join(json_dir, 'sst_range_local.json')
    with open(json_path, 'w') as f:
        json.dump(temp_range, f)

    print(f"Saved local JSON file: {json_path}")


# In[21]:


for day, filename in files:

    # Define the source and destination directories
    source_directory = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day_local', f"2024_{day:03d}")
    destination_directory = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day', f"2024_{day:03d}")

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


# Removing all intermittent steps to save space:

# In[22]:


#Tidying up folders and removing unnecessary files
local_tiles_dir = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day_local')
shutil.rmtree(local_tiles_dir)

temp_directory = os.path.join(base_dir, 'processed_data', 'SST', 'temp_files_3day')
shutil.rmtree(temp_directory)


# In[23]:


#Outputting txt file with all the dates:
with open(os.path.join(base_dir, 'processed_data', 'SST', 'sst_dates.txt'), 'w') as f:
    for date in sst.keys():
        f.write(f"{date}\n")


# In[29]:


# Define the tiles_3day directory
tiles_dir = os.path.join(base_dir, 'processed_data', 'SST', 'tiles_3day')

# Get all folder names in the tiles_3day directory and sort them
dates = sorted([folder for folder in os.listdir(tiles_dir) if os.path.isdir(os.path.join(tiles_dir, folder))])

print("Found dates:", dates)

# Output the list of dates to a txt file
output_path = os.path.join(base_dir, 'processed_data', 'SST', 'sst_dates.txt')

# Open the file in append mode to debug any partial writes
with open(output_path, 'w') as f:
    for date in dates:
        formatted_date = date.replace('_', '')  # Replace underscores with no separator
        f.write(f"{formatted_date}\n")  # Write the formatted date to the file
        # print(f"Written to file: {formatted_date}")  # Debugging: Print each date written to the file

print(f"Saved list of dates to {output_path}")


# In[ ]:




