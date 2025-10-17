#!/usr/bin/env python
# coding: utf-8

# In[35]:


import xarray as xr
import numpy as np
import rasterio
import subprocess
from rasterio.transform import from_origin
from rasterio.transform import from_bounds
import matplotlib.pyplot as plt
import cmocean
import os
from pyproj import Transformer
import shutil
import json
from datetime import datetime
import re
from pathlib import Path
from matplotlib import cm 
from scipy.interpolate import griddata
from rasterio.features import rasterize
import cartopy.io.shapereader as shpreader


# In[36]:


# Define base directory
base_dir = '/home/finn.wimberly/Documents/CCCFA_app_dev/data'
raw_data_dir = '/vast/clidex/data/obs/CCCFA/raw_data/doppio/'

# remove tiles dir to delete old forecasts and recreate
tiles_dir = os.path.join(base_dir, 'processed_data', 'doppio', 'tiles')
shutil.rmtree(tiles_dir, ignore_errors=True)
os.makedirs(tiles_dir, exist_ok=True)

# Path for the temp_files directory
temp_files_dir = os.path.join(base_dir, 'processed_data', 'doppio', 'temp_files')
os.makedirs(temp_files_dir, exist_ok=True)


# In[37]:


# which file are we processing
date_pattern = re.compile(r"doppio_bottom_temps_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.nc")

# Pick the file with the latest end-date in the filename
latest_path = max(
    (p for p in Path(raw_data_dir).glob("doppio_bottom_temps_*.nc") if date_pattern.match(p.name)),
    key=lambda p: date_pattern.match(p.name).group(2)
)

print(f"Most recent doppio forecast contained in: {latest_path.name}")


# In[38]:


# define rasterization parameters
# Region of interest (EPSG:4326 lon/lat)
bounds = {'min_lon': -75, 'max_lon': -65, 'min_lat': 35, 'max_lat': 50}

# Target grid resolution (deg)
dlat = 0.05
dlon = 0.05

# Build target regular grid (note: we’ll flip vertically at write time)
target_lons = np.arange(bounds['min_lon'], bounds['max_lon'] + dlon/2, dlon)
target_lats = np.arange(bounds['min_lat'], bounds['max_lat'] + dlat/2, dlat)
Lon2D, Lat2D = np.meshgrid(target_lons, target_lats)

height, width = Lat2D.shape
lon_min, lon_max = bounds['min_lon'], bounds['max_lon']
lat_min, lat_max = bounds['min_lat'], bounds['max_lat']

# Transform for the target grid (top-left origin = (lon_min, lat_max))
transform = from_origin(lon_min, lat_max, dlon, dlat)

# Load Natural Earth land polygons (10m = detailed; use 50m for speed)
land_shp = shpreader.natural_earth(resolution='10m', category='physical', name='land')
land_geoms = list(shpreader.Reader(land_shp).geometries())

# Rasterize land=1, ocean=0 on our target grid
land_mask_georef = rasterize(
    ((geom, 1) for geom in land_geoms),
    out_shape=(height, width),
    transform=transform,
    fill=0,
    dtype='uint8'
)

# our in-memory arrays are indexed south to north (lat increases with row index),
# but rasterize produced north→south. Flip to align with your arrays.
land_mask_tgt = np.flipud(land_mask_georef).astype(bool)   # True on land
ocean_mask_tgt = ~land_mask_tgt                            # True on ocean




# In[39]:


#helpers
def daily_bottom_mean(ds):
    # bottom layer (s_rho has size 1 -- keeping explicit)
    temp_bottom = ds["temp"].isel(s_rho=0)
    daily = temp_bottom.resample(time="1D").mean()
    return daily.dropna(dim="time", how="all")

def curvi_to_regular(lon2d_src, lat2d_src, values2d, lon2d_tgt, lat2d_tgt, method="linear"):
    pts = np.column_stack((lon2d_src.ravel(), lat2d_src.ravel()))
    vals = values2d.ravel()
    good = np.isfinite(vals) & np.isfinite(pts[:,0]) & np.isfinite(pts[:,1])
    pts, vals = pts[good], vals[good]
    interp = griddata(pts, vals, (lon2d_tgt, lat2d_tgt), method=method)
    if np.isnan(interp).any():
        nn = griddata(pts, vals, (lon2d_tgt, lat2d_tgt), method="nearest")
        interp = np.where(np.isnan(interp), nn, interp)
    return interp

def write_geotiff(path, arr, lons2d, lats2d, nodata=np.nan):
    # flip north to south for GeoTIFF row order
    arr_out = np.flipud(arr.astype("float32"))
    min_lon, max_lon = float(np.nanmin(lons2d)), float(np.nanmax(lons2d))
    min_lat, max_lat = float(np.nanmin(lats2d)), float(np.nanmax(lats2d))
    height, width = arr.shape
    transform = from_bounds(min_lon, min_lat, max_lon, max_lat, width, height)
    with rasterio.open(
        path, "w",
        driver="GTiff",
        dtype="float32",
        count=1,
        height=height,
        width=width,
        crs="EPSG:4326",
        transform=transform,
        nodata=nodata,
        tiled=True,
        blockxsize=512,
        blockysize=512,
        compress="DEFLATE"
    ) as dst:
        dst.write(arr_out, 1)

def build_vrt_from_tif(tif_path, vrt_path):
    subprocess.run(["gdal_translate", "-of", "VRT", tif_path, vrt_path], check=True)


# In[40]:


#main processing loop - create tif and vrt files

#set bounds
# global_min = np.inf
# global_max = -np.inf
daily_outputs = []

fname = latest_path.name
file_path = os.path.join(raw_data_dir, fname)
print(f"\n==================== Processing {fname} ====================")

ds = xr.open_dataset(file_path)
lat2d = ds["lat_rho"].values
lon2d = ds["lon_rho"].values

# optional spatial pre-mask to speed interpolation
pad = 0.25
src_mask = (
    (lon2d >= bounds["min_lon"] - pad) & (lon2d <= bounds["max_lon"] + pad) &
    (lat2d >= bounds["min_lat"] - pad) & (lat2d <= bounds["max_lat"] + pad)
)
lon_src = lon2d.copy(); lat_src = lat2d.copy()
lon_src[~src_mask] = np.nan; lat_src[~src_mask] = np.nan

daily = daily_bottom_mean(ds)  # (time, eta_rho, xi_rho)

for t in daily["time"].values:
    day = np.datetime_as_string(t, unit="D")   # 'YYYY-MM-DD'
    day_compact = day.replace("-", "")         # 'YYYYMMDD'

    # 2-D source slice
    da = daily.sel(time=t).values

    # interpolate to target grid (linear)
    interp_lin = curvi_to_regular(lon_src, lat_src, da, Lon2D, Lat2D, method="linear")

    # optional nearest fill ONLY over ocean pixels to patch small NaN holes
    nan_ocean = np.isnan(interp_lin) & ocean_mask_tgt
    if nan_ocean.any():
        interp_nn = curvi_to_regular(lon_src, lat_src, da, Lon2D, Lat2D, method="nearest")
        interp_lin[nan_ocean] = interp_nn[nan_ocean]

    # finally, mask land by lat/lon (Natural Earth)
    interp_lin[land_mask_tgt] = np.nan

    # track global range over ocean only
    # dmin = float(np.nanmin(interp_lin)); dmax = float(np.nanmax(interp_lin))
    # if np.isfinite(dmin): global_min = min(global_min, dmin)
    # if np.isfinite(dmax): global_max = max(global_max, dmax)

    # write GeoTIFF and VRT file
    tif_path = os.path.join(temp_files_dir, f"doppio_bottom_temp_daily_{day_compact}.tif")
    vrt_path = os.path.join(temp_files_dir, f"doppio_bottom_temp_daily_{day_compact}.vrt")
    write_geotiff(tif_path, interp_lin, Lon2D, Lat2D, nodata=np.nan)
    build_vrt_from_tif(tif_path, vrt_path)

    print(f"Saved GeoTIFF & VRT for {day}:\n  {tif_path}\n  {vrt_path}")
    daily_outputs.append((day_compact, tif_path, vrt_path))

ds.close()

# if not np.isfinite(global_min) or not np.isfinite(global_max):
#     raise RuntimeError("Could not determine global min/max for color table.")

# print(f"\nGlobal range across days: [{global_min:.3f}, {global_max:.3f}] °C")


# In[41]:


# #Check out tif 
# from rasterio.plot import show

# tif = os.path.join(temp_files_dir, f"doppio_bottom_temp_daily_{day_compact}.tif")
# with rasterio.open(tif) as src:
#     fig, ax = plt.subplots(figsize=(8,6))
#     show(src, ax=ax)  # uses src.bounds automatically
#     plt.show()


# In[42]:


# build value-based color file
VMIN, VMAX = 1.0, 25.0  # hard limits in °C

n = 255
values = np.linspace(VMIN, VMAX, n)
colors = cmocean.cm.thermal(np.linspace(0, 1, n))

color_filename = os.path.join(temp_files_dir, "doppio_colormap.txt")
with open(color_filename, "w") as f:
    f.write("nv 0 0 0 0\n") 
    for v, c in zip(values, colors):
        r, g, b = (int(c[0]*255), int(c[1]*255), int(c[2]*255))
        f.write(f"{v:.6f} {r} {g} {b} 255\n")


for filename in os.listdir(temp_files_dir):
    # if not filename.endswith('.vrt'):
    if not filename.startswith('doppio_bottom_temp_daily_') or not filename.endswith('.vrt'):
        continue
        
    # Get the date from filename
    date_str = filename.replace('doppio_bottom_temp_daily_', '').replace('.vrt', '')

    # Create a colored VRT file
    in_vrt = os.path.join(temp_files_dir, filename)
    colored_vrt_file = os.path.join(base_dir, 'processed_data', 'doppio', 'temp_files', f"colored_{date_str}.vrt")
    # gdaldem_command = [
    #     'gdaldem', 'color-relief', in_vrt, color_filename, colored_vrt_file, '-of', 'VRT', '-alpha'
    # ]
    # subprocess.run(gdaldem_command)

    subprocess.run([
    'gdaldem','color-relief',
    in_vrt, color_filename, colored_vrt_file,
    '-of','VRT','-alpha'
    ], check=True)

    print(f"Created colored VRT: {colored_vrt_file}")


# In[43]:


# gdal2tiles.py to bake XYZ tiles (YYYY_DDD folder names)
for day_compact, _, _ in daily_outputs:
    year = int(day_compact[:4])
    month = int(day_compact[4:6])
    day = int(day_compact[6:8])
    date_obj = datetime(year, month, day)
    day_of_year = date_obj.timetuple().tm_yday
    date_str = f"{year}_{day_of_year:03d}"

    colored_vrt_file = os.path.join(temp_files_dir, f"colored_{day_compact}.vrt")
    tiles_directory = os.path.join(tiles_dir, date_str)
    os.makedirs(tiles_directory, exist_ok=True)

    print(f"\n==================== Generating tiles for {date_str} ====================")
    subprocess.run([
        "gdal2tiles.py",
        "--config", "GDAL_PAM_ENABLED", "NO",
        "-p", "mercator",
        "-z", "0-10",           
        "-r", "bilinear",
        "-w", "none",
        "--xyz",
        "--processes=8",
        colored_vrt_file,
        tiles_directory
    ], check=True)
    print(f"Generated tiles: {tiles_directory}")


# In[44]:


# Define the tiles_3day directory
tiles_dir = os.path.join(base_dir, 'processed_data', 'doppio', 'tiles')

# Get all folder names in the tiles_3day directory and sort them
dates = sorted([folder for folder in os.listdir(tiles_dir) if os.path.isdir(os.path.join(tiles_dir, folder))])

print("Found dates:", dates)

# Output the list of dates to a txt file
output_path = os.path.join(base_dir, 'processed_data', 'doppio', 'doppio_dates.txt')

# Open the file in append mode to debug any partial writes
with open(output_path, 'w') as f:
    for date in dates:
        formatted_date = date.replace('_', '')  # Replace underscores with no separator
        f.write(f"{formatted_date}\n")  # Write the formatted date to the file
        # print(f"Written to file: {formatted_date}")  # Debugging: Print each date written to the file

print(f"Saved list of dates to {output_path}")


# In[45]:


# clean up temp directory
shutil.rmtree(temp_files_dir, ignore_errors=True)
os.makedirs(temp_files_dir, exist_ok=True)




