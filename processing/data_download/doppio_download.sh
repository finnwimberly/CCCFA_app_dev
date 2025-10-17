#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
exec >> "$LOGDIR/doppio_download.log" 2>&1

DOPPIO_DIR="/vast/clidex/data/obs/CCCFA/raw_data/doppio"

# Log start and take snapshot
log_changes "start" "$DOPPIO_DIR"

# Activate environment and run
source ~/mambaforge/etc/profile.d/conda.sh
conda activate CCCFA

# Always compute in UTC
time_start="$(date -u +%F)"
time_end="$(date -u -d '+7 days' +%F)"

mkdir -p "$DOPPIO_DIR"
doppio_filename="$DOPPIO_DIR/doppio_bottom_temps_${time_start}_${time_end}.nc"

doppio_url="https://tds.marine.rutgers.edu/thredds/dodsC/roms/doppio/2017_da/his/History_Best"

# Download using ncks
ncks -O -d time,"$time_start","$time_end" -d s_rho,0 -v temp "$doppio_url" "$doppio_filename"

conda deactivate

# Log end and show changes
log_changes "end" "$DOPPIO_DIR"
