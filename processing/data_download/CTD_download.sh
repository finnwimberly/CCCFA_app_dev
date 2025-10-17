#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
exec >> "$LOGDIR/CTD_profiles.log" 2>&1

CTD_DIR="/vast/clidex/data/obs/CCCFA/processed_data/CTD_profiles"

# Log start and take snapshot
log_changes "start" "$CTD_DIR"

# Activate environment and run
source ~/mambaforge/etc/profile.d/conda.sh
conda activate fiwi
cd "$SCRIPT_DIR"
python CTD_download.py
conda deactivate

# Log end and show changes
log_changes "end" "$CTD_DIR"
