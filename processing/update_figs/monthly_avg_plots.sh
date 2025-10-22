#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
exec >> "$LOGDIR/monthly_pngs.log" 2>&1

MONTHLY_PNGS_DIR="/vast/clidex/data/obs/CCCFA/processed_data/monthly_avg_pngs"

# Log start and take snapshot
log_changes "start" "$MONTHLY_PNGS_DIR"

# Activate environment and run
source ~/mambaforge/etc/profile.d/conda.sh
conda activate spyder_salinity
cd "$SCRIPT_DIR"
python monthly_avg_plots.py
conda deactivate

# Log end and show changes
log_changes "end" "$MONTHLY_PNGS_DIR"
