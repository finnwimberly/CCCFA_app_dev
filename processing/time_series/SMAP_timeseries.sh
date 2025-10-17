#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
exec >> "$LOGDIR/sss_timeseries.log" 2>&1

TIMESERIES_DIR="/vast/clidex/data/obs/CCCFA/processed_data/SSS/time_series"

# Log start and take snapshot
log_changes "start" "$TIMESERIES_DIR"

# Activate environment and run
source ~/mambaforge/etc/profile.d/conda.sh
conda activate CCCFA
cd "$SCRIPT_DIR"
python SMAP_timeseries.py
conda deactivate

# Log end and show changes
log_changes "end" "$TIMESERIES_DIR"
