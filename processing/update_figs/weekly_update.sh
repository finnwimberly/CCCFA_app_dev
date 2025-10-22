#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
exec >> "$LOGDIR/weekly_update.log" 2>&1

WEEKLY_UPDATES_DIR="/vast/clidex/data/obs/CCCFA/processed_data/weekly_updates"

# Log start and take snapshot
log_changes "start" "$WEEKLY_UPDATES_DIR"

# Activate environment and run
source ~/mambaforge/etc/profile.d/conda.sh
conda activate spyder_salinity
cd "$SCRIPT_DIR"
python weekly_update.py

# Sync to Google Drive
/home/finn.wimberly/bin/rclone sync "$WEEKLY_UPDATES_DIR/" GDrive:weekly_update_figs

conda deactivate

# Log end and show changes
log_changes "end" "$WEEKLY_UPDATES_DIR"
