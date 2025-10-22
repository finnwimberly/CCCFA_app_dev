#!/usr/bin/env python
# coding: utf-8

# In[1]:


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


# In[2]:


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


# ### First let's make the SST monthly plots

# In[3]:


def get_recent_ostia_monthly_data():
    """Load and combine all monthly OSTIA SST files available from the last 18 months"""
    data_dir = '/vast/clidex/data/obs/SST/OSTIA/data/monthly'
    files = sorted([os.path.join(data_dir, f) for f in os.listdir(data_dir) if f.endswith('.nc')])
    file_trimmed = files[-18::]
    
    if not file_trimmed:
        print("No monthly files found.")
        return None
    
    datasets = [xr.open_dataset(f) for f in file_trimmed]
    sst_datasets = [ds['analysed_sst'] for ds in datasets]
    combined = xr.concat(sst_datasets, dim='time')
    return combined


# In[7]:

# Read in bathymetry data set
local_file_path = "/vast/clidex/data/bathymetry/ETOPO1/ETOPO1_Bed_g_gmt4.grd"
bath_ds = xr.open_dataset(local_file_path)

# Convert depths from meters to fathoms (1 fathom = 1.8288 meters)
fathoms = bath_ds['z'] / 1.8288

# Mask land (above sea level): keep xarray structure
masked_fathoms = fathoms.where(bath_ds['z'] < 0)

contour_levels = [-2000, -1000]


# In[9]:


def create_ostia_sst_monthly_plots_combined(data, region=[-75, -62, 36, 45]):
    """Create one figure with as many monthly subplots as available"""
    if data is None:
        print("No data available")
        return
    
    n_months = len(data.time)
    ncols = 6
    nrows = int(np.ceil(n_months / ncols))

    plt.close('all')
    fs = 8
    plt.rcParams.update({'font.size': fs, 'xtick.labelsize': fs, 'ytick.labelsize': fs})
    
    fig, axes = plt.subplots(nrows, ncols, figsize=(15, 2.5 * nrows), subplot_kw={'projection': ccrs.PlateCarree()})
    axes = axes.flatten()  # Flatten in case of single row
    
    plt.subplots_adjust(wspace=0.01, hspace=-0.2, left=0.07, right=0.85)

    # Calculate global min/max across all months
    #sst_all = data['analysed_sst'] - 273.15
    vmin = 0
    vmax = 30
    levels_c = np.linspace(vmin, vmax, 150)
    levels_f = levels_c * 9/5 + 32

    for i in range(n_months):
        ax = axes[i]
        gl = plot_map(ax, region, inc=2)
        sst = data.isel(time=i) - 273.15

        im = ax.contourf(sst.longitude, sst.latitude, sst.values,
                         levels=levels_c, transform=ccrs.PlateCarree(),
                         cmap=cmocean.cm.thermal, extend='both')

        # Label with formatted date
        date_str = pd.to_datetime(data.time[i].values).strftime('%b %Y')
        ax.text(-74.5, 44, date_str,
                transform=ccrs.PlateCarree(),
                fontweight='bold',
                fontsize=8,
                bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', pad=1))

        # Subset bathymetry to region
        lon_mask = (bath_ds['x'] >= region[0]) & (bath_ds['x'] <= region[1])
        lat_mask = (bath_ds['y'] >= region[2]) & (bath_ds['y'] <= region[3])
        bathy_subset = masked_fathoms.where(lon_mask & lat_mask, drop=True)

        #Add contours
        contours = ax.contour(bathy_subset['x'], bathy_subset['y'], bathy_subset,
                      levels=contour_levels,
                      colors='black',
                      linewidths=0.4,
                      linestyles='dotted',
                      transform=ccrs.PlateCarree())

        ax.clabel(contours, contours.levels, inline=True, fmt=lambda val: f"{int(abs(val))} fm", fontsize=6)


        # Turn off extra axis labels
        if i not in [j * ncols for j in range(nrows)]:
            gl.left_labels = False
        if i < (nrows - 1) * ncols:
            gl.bottom_labels = False

    # Hide any unused subplots
    for j in range(n_months, len(axes)):
        fig.delaxes(axes[j])

    # Add colorbars
    ticks_c = np.linspace(vmin, vmax, 12)
    ticks_f = ticks_c * 9/5 + 32
    
    cbaxes_c = fig.add_axes([0.86, 0.22, 0.015, 0.5])
    cb_c = fig.colorbar(im, cax=cbaxes_c, shrink=0.7, label='sea surface temperature [°C]')
    cb_c.ax.yaxis.label.set_size(10)
    cb_c.set_ticks(ticks_c)
    cb_c.set_ticklabels([f'{int(c)}' for c in ticks_c])
    cb_c.ax.tick_params(labelsize=10)

    cbaxes_f = fig.add_axes([0.01, 0.22, 0.015, 0.5])
    cb_f = fig.colorbar(im, cax=cbaxes_f, shrink=0.7, label='sea surface temperature [°F]')
    cb_f.ax.yaxis.label.set_size(10)
    cb_f.set_ticks(ticks_c)
    cb_f.set_ticklabels([f'{int(f)}' for f in ticks_f])
    cb_f.ax.yaxis.set_tick_params(labelleft=True, labelright=False)
    cb_f.ax.yaxis.set_label_coords(-2, 0.5)
    cb_f.ax.tick_params(labelsize=10)

    # General title
    time_start = pd.to_datetime(data.time[0].values).strftime('%b %Y')
    time_end = pd.to_datetime(data.time[-1].values).strftime('%b %Y')
    #plt.suptitle(f'OSTIA Monthly SST: {time_start} – {time_end}', y=0.895, fontsize = 18)

    # Save
    plt.savefig('/vast/clidex/data/obs/CCCFA/processed_data/monthly_avg_pngs/OSTIA_SST_monthly_averages.png', dpi=300, bbox_inches='tight')
    plt.show()
    #plt.close()


# In[22]:


#process data
combined_data = get_recent_ostia_monthly_data()


# In[23]:


combined_data


# In[24]:


#plot data
create_ostia_sst_monthly_plots_combined(combined_data)


# ## And now our SST anomaly plots:

# In[25]:


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


# In[26]:


def calculate_monthly_anomalies(data, baseline_data):
    """Calculate SST anomalies without grouping by month (preserve real dates)"""
    if data is None or baseline_data is None:
        return None

    # sst = data['analysed_sst'] - 273.15
    sst = data - 273.15
    baseline = baseline_data - 273.15

    if sst.latitude.size != baseline.latitude.size or sst.longitude.size != baseline.longitude.size:
        sst = sst.interp_like(baseline)

    doy = data.time.dt.dayofyear.values

    anomalies = xr.zeros_like(sst)
    for i in range(len(sst.time)):
        baseline_day = baseline.sel(dayofyear=doy[i], method='nearest')
        anomalies[i] = sst[i] - baseline_day

    # Preserve the actual timestamps
    anomalies = anomalies.assign_coords(time=data.time)
    
    return anomalies


# In[27]:


def plot_combined_anomalies(anomalies, baseline_type, region=[-75, -62, 36, 45]):
    """Plot all monthly SST anomalies in one figure with consistent styling"""
    if anomalies is None:
        print("No anomaly data to plot.")
        return

    n_months = len(anomalies.time)
    ncols = 6
    nrows = int(np.ceil(n_months / ncols))

    plt.close('all')
    fs = 8
    plt.rcParams.update({'font.size': fs, 'xtick.labelsize': fs, 'ytick.labelsize': fs})

    fig, axes = plt.subplots(nrows, ncols, figsize=(15, 2.5 * nrows), subplot_kw={'projection': ccrs.PlateCarree()})
    axes = axes.flatten()
    plt.subplots_adjust(wspace=0.01, hspace=-0.2, left=0.07, right=0.85)

    # Range for colorbar (centered on 0)
    vmin = 8
    vmax = -8
    max_abs = max(abs(vmin), abs(vmax))
    levels_c = np.linspace(-max_abs, max_abs, 150)
    levels_f = levels_c * 9/5

    for i in range(n_months):
        ax = axes[i]
        gl = plot_map(ax, region, inc=2)
        anomaly_month = anomalies.isel(time=i).squeeze()

        im = ax.contourf(anomaly_month.longitude, anomaly_month.latitude, anomaly_month.values, 
                         levels=levels_c, transform=ccrs.PlateCarree(),
                         cmap='RdBu_r', extend='both')

        # Subset bathymetry to region
        lon_mask = (bath_ds['x'] >= region[0]) & (bath_ds['x'] <= region[1])
        lat_mask = (bath_ds['y'] >= region[2]) & (bath_ds['y'] <= region[3])
        bathy_subset = masked_fathoms.where(lon_mask & lat_mask, drop=True)

        #Add contours
        contours = ax.contour(bathy_subset['x'], bathy_subset['y'], bathy_subset,
                      levels=contour_levels,
                      colors='black',
                      linewidths=0.4,
                      linestyles='dotted',
                      transform=ccrs.PlateCarree())

        ax.clabel(contours, contours.levels, inline=True, fmt=lambda val: f"{int(abs(val))} fm", fontsize=6)


        # Label with formatted date
        date_str = pd.to_datetime(anomalies.time[i].values).strftime('%b %Y')
        ax.text(-74.5, 44, date_str,
                transform=ccrs.PlateCarree(),
                fontweight='bold',
                fontsize=8,
                bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', pad=1))

        # Simplify tick labels
        if i not in [j * ncols for j in range(nrows)]:
            gl.left_labels = False
        if i < (nrows - 1) * ncols:
            gl.bottom_labels = False

    # Hide unused subplots
    for j in range(n_months, len(axes)):
        fig.delaxes(axes[j])

    # Add colorbars
    ticks_c = np.linspace(vmin, vmax, 17)
    ticks_f = ticks_c * 9/5
    
    cbaxes_c = fig.add_axes([0.86, 0.22, 0.015, 0.5])
    cb_c = fig.colorbar(im, cax=cbaxes_c, shrink=0.7, label='SST anomaly [°C]')
    cb_c.ax.yaxis.label.set_size(10)
    cb_c.set_ticks(ticks_c)
    cb_c.set_ticklabels([f'{int(c)}' for c in ticks_c])
    cb_c.ax.tick_params(labelsize=10)

    cbaxes_f = fig.add_axes([0.01, 0.22, 0.015, 0.5])
    cb_f = fig.colorbar(im, cax=cbaxes_f, shrink=0.7, label='SST anomaly [°F]')
    cb_f.ax.yaxis.label.set_size(10)
    cb_f.set_ticks(ticks_c)
    cb_f.set_ticklabels([f'{f}' for f in ticks_f])
    cb_f.ax.yaxis.set_tick_params(labelleft=True, labelright=False)
    cb_f.ax.yaxis.set_label_coords(-2.5, 0.5)
    cb_f.ax.tick_params(labelsize=10)

    # General title
    time_start = pd.to_datetime(anomalies.time[0].values).strftime('%b %Y')
    time_end = pd.to_datetime(anomalies.time[-1].values).strftime('%b %Y')
    baseline_text = baseline_type.replace('_', '-')
    #plt.suptitle(f'OSTIA Monthly SST Anomalies: {time_start} – {time_end} (Baseline: {baseline_text})', y=0.895, fontsize=18)

    # Save or show
    plt.savefig(f'/vast/clidex/data/obs/CCCFA/processed_data/monthly_avg_pngs/OSTIA_SST_combined_anomalies_{baseline_type}.png', dpi=300, bbox_inches='tight')
    plt.show()


# In[28]:


#load all monthly SST data
data = combined_data

#load baseline
baseline = get_ostia_baseline('2007_2024')

#calculate anomalies
anomalies = calculate_monthly_anomalies(data, baseline)

#anomalies


#plot
plot_combined_anomalies(anomalies, '2007_2024')


# ## SSS Monthly averages:


def get_recent_smap_monthly_data():
    """Load and combine all monthly SMAP SSS files available for the most recent 18 months"""
    data_dir = '/vast/clidex/data/obs/SSS/SMAP/SMAP_RSS_v6.0/data/monthly'
    files = sorted([os.path.join(data_dir, f) for f in os.listdir(data_dir) if f.endswith('.nc')])
    files_trimmed = files[-18::]
    
    if not files_trimmed:
        print("No monthly files found.")
        return None
    
    datasets = [xr.open_dataset(f) for f in files_trimmed]
    combined = xr.concat(datasets, dim='time')
    
    # Shift longitude if necessary (SMAP is 0–360)
    if (combined['lon'] > 180).any():
        combined = combined.assign_coords(lon=(((combined['lon'] + 180) % 360) - 180))
        combined = combined.sortby('lon')

    # Keep only data from Jan 2024 onward
    combined = combined.sel(time=slice('2024-01-01', None))
    
    return combined


# In[39]:


def create_smap_sss_monthly_plots_combined(data, region=[-75, -62, 36, 45]):
    """Create one figure with as many monthly SSS subplots as available"""
    if data is None:
        print("No data available")
        return
    
    n_months = len(data.time)
    ncols = 6
    nrows = int(np.ceil(n_months / ncols))

    plt.close('all')
    fs = 8
    plt.rcParams.update({'font.size': fs, 'xtick.labelsize': fs, 'ytick.labelsize': fs})
    
    fig, axes = plt.subplots(nrows, ncols, figsize=(15, 2.5 * nrows), subplot_kw={'projection': ccrs.PlateCarree()})
    axes = axes.flatten()
    
    plt.subplots_adjust(wspace=0.01, hspace=-0.2, left=0.07, right=0.85)

    # HARD-SET color limits and colormap
    cmap = 'Spectral_r'
    vmin = 31.5
    vmax = 36.5
    levels = np.arange(31.5, 36.5, 0.025)

    for i in range(n_months):
        ax = axes[i]
        gl = plot_map(ax, region, inc=2)
        sss = data.isel(time=i)['sss_smap']
    
        # Colored filled contours
        im = ax.contourf(sss.lon, sss.lat, sss.values,
                         levels=levels, transform=ccrs.PlateCarree(),
                         cmap=cmap, extend='both', vmin=vmin, vmax=vmax)

        # Subset bathymetry to region
        lon_mask = (bath_ds['x'] >= region[0]) & (bath_ds['x'] <= region[1])
        lat_mask = (bath_ds['y'] >= region[2]) & (bath_ds['y'] <= region[3])
        bathy_subset = masked_fathoms.where(lon_mask & lat_mask, drop=True)

        #Add contours
        contours = ax.contour(bathy_subset['x'], bathy_subset['y'], bathy_subset,
                      levels=contour_levels,
                      colors='black',
                      linewidths=0.4,
                      alpha = 0.6,
                      linestyles='--',
                      transform=ccrs.PlateCarree())

        #ax.clabel(contours, contours.levels, inline=True, fmt=lambda val: f"{int(abs(val))} fm", fontsize=6)
    
        # Overlay black contour lines at 34 and 35 PSU
        cs = ax.contour(sss.lon, sss.lat, sss.values,
                        levels=[34, 35], colors='k',
                        transform=ccrs.PlateCarree(), linewidths=0.9)
    
        # Label the month
        date_str = pd.to_datetime(data.time[i].values).strftime('%b %Y')
        ax.text(region[0]+1, region[3]-1, date_str,
                transform=ccrs.PlateCarree(),
                fontweight='bold',
                fontsize=8,
                bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', pad=1))
    
        # Turn off extra axis labels
        if i not in [j * ncols for j in range(nrows)]:
            gl.left_labels = False
        if i < (nrows - 1) * ncols:
            gl.bottom_labels = False

    # Hide unused subplots
    for j in range(n_months, len(axes)):
        fig.delaxes(axes[j])

    # Colorbar
    cbaxes = fig.add_axes([0.86, 0.22, 0.015, 0.5])
    cb = fig.colorbar(im, cax=cbaxes, shrink=0.7, label='sea surface salinity [psu]', extend='both')
    cb.ax.yaxis.label.set_size(12)
    cb.ax.tick_params(labelsize=10)
    cb.set_ticks(np.arange(32, 37))
    cb.minorticks_off()

    # Title
    time_start = pd.to_datetime(data.time[0].values).strftime('%b %Y')
    time_end = pd.to_datetime(data.time[-1].values).strftime('%b %Y')
    #plt.suptitle(f'SMAP Monthly SSS: {time_start} – {time_end}', y=0.895, fontsize=18)

    # Save
    #os.makedirs('monthly_avg_pngs', exist_ok=True)
    plt.savefig('/vast/clidex/data/obs/CCCFA/processed_data/monthly_avg_pngs/SMAP_SSS_monthly_averages.png', dpi=300, bbox_inches='tight')
    plt.show()



# Process data
combined_sss_data = get_recent_smap_monthly_data()

#combined_sss_data

# Plot data
create_smap_sss_monthly_plots_combined(combined_sss_data)

# ## Chlorophyll

# Path where your monthly files are stored
data_path = "/vast/clidex/data/obs/GlobColour/monthly/"

# Find all monthly files
file_list = sorted(glob.glob(os.path.join(data_path, "*.nc")))
files_trimmed = file_list[-18::]

# # Check found files
# print(f"Found {len(file_list)} monthly files:")
# for f in file_list:
#     print(f)


# Open all datasets into one, concatenate along time dimension
ds = xr.open_mfdataset(files_trimmed, combine='by_coords')

## Print basic information
#ds


def create_chl_monthly_plots_combined(data, region=[-75, -62, 36, 45]):
    """Create one figure with as many monthly CHL subplots as available"""
    if data is None:
        print("No data available")
        return
    
    n_months = len(data.time)
    ncols = 6
    nrows = int(np.ceil(n_months / ncols))

    plt.close('all')
    fs = 8
    plt.rcParams.update({'font.size': fs, 'xtick.labelsize': fs, 'ytick.labelsize': fs})
    
    fig, axes = plt.subplots(nrows, ncols, figsize=(15, 2.5 * nrows), subplot_kw={'projection': ccrs.PlateCarree()})
    axes = axes.flatten()
    
    plt.subplots_adjust(wspace=0.01, hspace=-0.2, left=0.07, right=0.85)

    # Set up log scaling for colors (no log-transform of data!)
    vmin = 0.01
    vmax = 10
    norm = LogNorm(vmin=vmin, vmax=vmax)

    for i in range(n_months):
        ax = axes[i]
        chl = data.isel(time=i)['CHL'].where(data.isel(time=i)['CHL'] > 0)  # Mask bad values

        gl = plot_map(ax, region, inc=2)  # Your custom map gridlines function

        im = ax.pcolormesh(chl.longitude, chl.latitude, chl.values,
                           norm=norm,
                           cmap=cmocean.cm.speed,
                           transform=ccrs.PlateCarree(),
                           shading='auto')

        # Label with formatted date
        date_str = pd.to_datetime(data.time[i].values).strftime('%b %Y')
        ax.text(region[0]+0.5, region[3]-1, date_str,
                transform=ccrs.PlateCarree(),
                fontweight='bold',
                fontsize=8,
                bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', pad=1))

        # Subset bathymetry to region (if bath_ds and masked_fathoms are preloaded)
        lon_mask = (bath_ds['x'] >= region[0]) & (bath_ds['x'] <= region[1])
        lat_mask = (bath_ds['y'] >= region[2]) & (bath_ds['y'] <= region[3])
        bathy_subset = masked_fathoms.where(lon_mask & lat_mask, drop=True)

        contours = ax.contour(bathy_subset['x'], bathy_subset['y'], bathy_subset,
                              levels=contour_levels,
                              colors='black',
                              linewidths=0.4,
                              linestyles='dotted',
                              transform=ccrs.PlateCarree())
        ax.clabel(contours, contours.levels, inline=True, fmt=lambda val: f"{int(abs(val))} fm", fontsize=6)

        # Turn off extra axis labels
        if i not in [j * ncols for j in range(nrows)]:
            gl.left_labels = False
        if i < (nrows - 1) * ncols:
            gl.bottom_labels = False

    # Hide any unused subplots
    for j in range(n_months, len(axes)):
        fig.delaxes(axes[j])

    # Add colorbar (log scale but real units)
    cbaxes = fig.add_axes([0.86, 0.22, 0.015, 0.5])
    cb = fig.colorbar(im, cax=cbaxes, shrink=0.7, label='Chlorophyll-a [mg/m³]')
    cb.ax.yaxis.label.set_size(10)
    cb.set_ticks([0.01, 0.1, 1, 10])
    cb.set_ticklabels([0.01, 0.1, 1, 10])
    cb.ax.tick_params(labelsize=10)

    # General title
    time_start = pd.to_datetime(data.time[0].values).strftime('%b %Y')
    time_end = pd.to_datetime(data.time[-1].values).strftime('%b %Y')
    #plt.suptitle(f'GlobColour Monthly CHL: {time_start} – {time_end}', y=0.895, fontsize=18)

    # Save
    plt.savefig('/vast/clidex/data/obs/CCCFA/processed_data/monthly_avg_pngs/GlobColour_CHL_monthly_averages.png', dpi=300, bbox_inches='tight')
    plt.show()


# In[8]:

create_chl_monthly_plots_combined(ds)





