#!/usr/bin/env python
# coding: utf-8

# In[46]:


import xarray as xr
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime
import calendar
import os
import cartopy.crs as ccrs
import cartopy.feature as cfeature
from cartopy.util import add_cyclic_point
import warnings
warnings.filterwarnings('ignore')
import cmocean
import glob
from matplotlib.colors import LogNorm
import matplotlib.ticker as ticker
import json
import subprocess
from matplotlib.patches import Rectangle
import matplotlib.dates as mdates


# In[9]:


def plot_map(ax, region, plotbathy=False, inc=2):
    """Set up map with coastlines and gridlines"""
    ax.set_extent(region, crs=ccrs.PlateCarree())
    ax.add_feature(cfeature.COASTLINE, linewidth=0.5)
    gl = ax.gridlines(draw_labels=True, linestyle ='--', alpha = 0.25)
    gl.xlabels_top = False
    gl.ylabels_right = False
    gl.xlocator = plt.MultipleLocator(inc)
    gl.ylocator = plt.MultipleLocator(inc)
    return gl


# In[10]:


def fetch_week_of_data():
    """Load and combine all monthly OSTIA SST files available"""
    data_dir = '/vast/clidex/data/obs/SST/OSTIA/data/daily'
    files = sorted([os.path.join(data_dir, f) for f in os.listdir(data_dir) if f.endswith('.nc')])
    this_weeks_files = files[-7::]
    if not this_weeks_files:
        print("No files found for this week.")
        return None
    
    datasets = [xr.open_dataset(f) for f in this_weeks_files]
    combined = xr.concat(datasets, dim='time')
    return combined


# In[11]:


# Read in bathymetry data set
local_file_path = "/vast/clidex/data/bathymetry/ETOPO1/ETOPO1_Bed_g_gmt4.grd"
bath_ds = xr.open_dataset(local_file_path)

# Convert depths from meters to fathoms (1 fathom = 1.8288 meters)
fathoms = bath_ds['z'] / 1.8288

# Mask land (above sea level): keep xarray structure
masked_fathoms = fathoms.where(bath_ds['z'] < 0)

contour_levels = [-1000, -100]


# In[12]:


current_week = fetch_week_of_data()


# In[13]:


weekly_mean = current_week['analysed_sst'].mean(dim='time', skipna=True)


# #### Anomalies

# In[14]:


def get_ostia_baseline(baseline_type='2007_2024'):
    """Get OSTIA baseline data"""
    base_path = '/vast/clidex/data/obs/SST/OSTIA/baselines'
    if baseline_type == '2007_2024':
        file = os.path.join(base_path, 'ostia_baseline_2007_2024_85W-40W_20N-50N.nc')
    elif baseline_type == '2010_2019':
        file = os.path.join(base_path, 'ostia_baseline_2010_2019_85W-40W_20N-50N.nc')
    else:
        raise ValueError(f"Unknown baseline type: {baseline_type}")
    
    if os.path.exists(file):
        with xr.open_dataset(file) as ds:
            return ds['analysed_sst']
    return None


# In[15]:


def calculate_weekly_anomalies(data, baseline_data):
    """Calculate SST anomalies for any set of dates (weekly, daily, monthly)"""
    if data is None or baseline_data is None:
        return None

    sst = data['analysed_sst'] - 273.15
    baseline = baseline_data - 273.15

    # Regrid if necessary
    if sst.latitude.size != baseline.latitude.size or sst.longitude.size != baseline.longitude.size:
        sst = sst.interp_like(baseline)

    # Compute day-of-year for all input times
    doy = data.time.dt.dayofyear

    # Vectorized lookup of baseline values
    baseline_for_dates = baseline.sel(dayofyear=doy)

    # Calculate anomalies directly (broadcasted subtraction)
    anomalies = sst - baseline_for_dates

    return anomalies


# In[16]:


#load all monthly SST data
data = current_week

#load baseline
baseline = get_ostia_baseline('2007_2024')

#calculate anomalies
anomalies = calculate_weekly_anomalies(data, baseline)


# In[17]:


anomaly_mean = anomalies.mean(dim='time', skipna=True)


# In[20]:


# Load time series
with open('/vast/clidex/data/obs/CCCFA/processed_data/OSTIA_SST/time_series/sst_timeseries.json') as f:
    ssta_data = json.load(f)['OC']['ssta']

dates = pd.to_datetime(list(ssta_data.keys()))
values = pd.Series(ssta_data).astype(float).values

# Keep only last 90 days
valid = ~np.isnan(values)
dates = dates[valid]
values = values[valid]
mask_recent = dates >= dates.max() - pd.Timedelta(days=90)
dates_recent = dates[mask_recent]
recent_ssta = values[mask_recent]


# In[57]:


def create_ostia_sst_weekly_overview(mean_sst, mean_anom, dates_recent, recent_ssta,
    region=[-72, -66, 38.5, 43.5]):
    """
    Plot weekly mean SST and anomalies side by side, with Outer Cape time series below (all in °F)
    """

    plt.close("all")
    fs = 12
    plt.rcParams.update(
        {
            "font.size": fs,
            "xtick.labelsize": fs,
            "ytick.labelsize": fs,
        }
    )

    # Layout
    fig = plt.figure(figsize=(14, 12))
    plt.subplots_adjust(hspace=0.1, wspace=0.1)

    ax1 = fig.add_subplot(2, 2, 1, projection=ccrs.PlateCarree())
    ax2 = fig.add_subplot(2, 2, 2, projection=ccrs.PlateCarree())
    ax3 = fig.add_subplot(2, 1, 2)

    # --------- Subset mean_sst ---------
    lon_mask_sst = (mean_sst.longitude >= region[0]) & (mean_sst.longitude <= region[1])
    lat_mask_sst = (mean_sst.latitude >= region[2]) & (mean_sst.latitude <= region[3])
    mean_sst_subset = mean_sst.sel(longitude=lon_mask_sst, latitude=lat_mask_sst)

    # Convert SST to °F
    sst_C = mean_sst_subset - 273.15
    sst_F = sst_C * 9 / 5 + 32

    vmin_sst = max(np.nanmin(sst_F.values), 32)
    vmax_sst = min(np.nanmax(sst_F.values), 95)
    levels_c = np.linspace(vmin_sst, vmax_sst, 150)

    # --------- Plot SST ---------
    ax1.set_extent(region, crs=ccrs.PlateCarree())
    plot_map(ax1, region, inc=2)

    im_sst = ax1.contourf(
        mean_sst_subset.longitude,
        mean_sst_subset.latitude,
        sst_F.values,
        levels=levels_c,
        transform=ccrs.PlateCarree(),
        cmap=cmocean.cm.thermal,
        extend="both",
    )

    # --------- Subset mean_anom ---------
    lon_mask_anom = (mean_anom.longitude >= region[0]) & (mean_anom.longitude <= region[1])
    lat_mask_anom = (mean_anom.latitude >= region[2]) & (mean_anom.latitude <= region[3])
    mean_anom_subset = mean_anom.sel(longitude=lon_mask_anom, latitude=lat_mask_anom)

    # Convert anomaly to °F
    mean_anom_F = mean_anom_subset * 9 / 5

    vmin_anom = np.nanmin(mean_anom_F.values)
    vmax_anom = np.nanmax(mean_anom_F.values)
    absmax = max(abs(vmin_anom), abs(vmax_anom))
    levels_anom = np.linspace(-absmax, absmax, 150)

    # --------- Plot Anomaly ---------
    ax2.set_extent(region, crs=ccrs.PlateCarree())
    plot_map(ax2, region, inc=2)

    im_anom = ax2.contourf(
        mean_anom_subset.longitude,
        mean_anom_subset.latitude,
        mean_anom_F.values,
        levels=levels_anom,
        transform=ccrs.PlateCarree(),
        cmap="RdBu_r",
        extend="both",
    )

    # --------- Bathymetry ---------
    lon_mask = (bath_ds["x"] >= region[0]) & (bath_ds["x"] <= region[1])
    lat_mask = (bath_ds["y"] >= region[2]) & (bath_ds["y"] <= region[3])
    bathy_subset = masked_fathoms.where(lon_mask & lat_mask, drop=True)

    for ax in [ax1, ax2]:
        contours = ax.contour(
            bathy_subset["x"],
            bathy_subset["y"],
            bathy_subset,
            levels=contour_levels,
            colors="black",
            linewidths=0.6,
            linestyles="dotted",
            transform=ccrs.PlateCarree(),
        )
        ax.clabel(
            contours,
            contours.levels,
            inline=True,
            fmt=lambda val: f"{int(abs(val))} fm",
            fontsize=10,
            manual=[(-68, 42), (-68, 38)],
        )

    # --------- OC Rectangle ---------
    oc_lon_min, oc_lon_max = -70, -69.5
    oc_lat_min, oc_lat_max = 41.5, 42.3

    oc_width = oc_lon_max - oc_lon_min
    oc_height = oc_lat_max - oc_lat_min

    for ax in [ax1, ax2]:
        oc_patch = Rectangle(
            (oc_lon_min, oc_lat_min),
            oc_width,
            oc_height,
            linewidth=1.5,
            edgecolor="red",
            facecolor="none",
            transform=ccrs.PlateCarree(),
            zorder=5,
        )
        ax.add_patch(oc_patch)

    # --------- Colorbars ---------
    ticks_sst = np.linspace(vmin_sst, vmax_sst, 12)
    cb_sst = fig.colorbar(im_sst, ax=ax1, orientation="horizontal", pad=0.08)
    cb_sst.set_label("SST [°F]")
    cb_sst.ax.yaxis.label.set_size(10)
    cb_sst.set_ticks(ticks_sst)
    cb_sst.set_ticklabels([f"{int(sst)}" for sst in ticks_sst])

    ticks_anom = np.linspace(-absmax, absmax, 13)
    cb_anom = fig.colorbar(im_anom, ax=ax2, orientation="horizontal", pad=0.08)
    cb_anom.set_label("SST Anomaly [°F]")
    cb_anom.ax.yaxis.label.set_size(10)
    cb_anom.set_ticks(ticks_anom)
    cb_anom.set_ticklabels([f"{int(anom)}" for anom in ticks_anom])

    # --------- Time Series ---------
    recent_ssta_F = recent_ssta * 9 / 5  # °C to °F

    ax3.plot(dates_recent, recent_ssta_F, color="darkred", lw=1.8)
    ax3.axhline(0, color="k", lw=0.8, linestyle="--")
    ax3.set_title(
        "Outer Cape Region Averaged SST Anomaly (Last 90 Days)",
        fontsize=12,
        weight="bold",
    )
    ax3.set_ylabel("Anomaly [°F]")
    ax3.set_xlim(dates_recent.min(), dates_recent.max())
    ax3.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    ax3.grid(True, alpha=0.3)

    # --------- Title ---------
    time_start = pd.to_datetime(current_week.time[0].values).strftime("%b %d %Y")
    time_end = pd.to_datetime(current_week.time[-1].values).strftime("%b %d %Y")
    date_str = f"{time_start} – {time_end}"
    fig.suptitle(
        f"Weekly SST Overview\n{date_str}",
        fontsize=14,
        y=0.96,
        fontweight="bold",
    )

    # --------- Save ---------
    filename = f"SST_{time_start}-{time_end}.png"
    local_path = os.path.join(os.getcwd(), filename)
    outpath = '/vast/clidex/data/obs/CCCFA/processed_data/weekly_updates'
    plt.savefig(os.path.join(outpath, filename), dpi=300, bbox_inches='tight')
    
    plt.show()


# In[58]:


create_ostia_sst_weekly_overview(weekly_mean, anomaly_mean, dates_recent, recent_ssta, region=[-72, -66, 38.5, 43.5])


# In[ ]:




