#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging with filtering
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
TEMP_LOG="$LOGDIR/.VIIRS_tiles_temp.log"

# Redirect to temp log for filtering
exec > "$TEMP_LOG" 2>&1

TILES_DIR="/home/finn.wimberly/Documents/CCCFA_app_dev/data/processed_data/SST/tiles"

# Log start and take snapshot
log_changes "start" "$TILES_DIR"

# Activate environment and run
source ~/mambaforge/etc/profile.d/conda.sh
conda activate spyder_salinity
cd "$SCRIPT_DIR"
python VIIRS_processing.py
conda deactivate

# Log end and show changes
log_changes "end" "$TILES_DIR"

# Filter out verbose lines and write to actual log
grep -v -E "(Input file size|Generating Base Tiles:|Generating Overview Tiles:|^[0-9]+\.\.\.|^100|Saved GeoTIFF:|Flipping latitude|Creating VRT for|Creating colorized VRT for|Created colorized VRT:|Creating tiles in:)" "$TEMP_LOG" >> "$LOGDIR/VIIRS_tiles.log"
rm -f "$TEMP_LOG"
