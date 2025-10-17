#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
exec >> "$LOGDIR/OSTIA_download.log" 2>&1

OSTIA_DIR="/vast/clidex/data/obs/SST/OSTIA/data/daily"

# Log start and take snapshot
log_changes "start" "$OSTIA_DIR"

# Activate environment and run
source ~/mambaforge/etc/profile.d/conda.sh
conda activate cop_marine
cd "$SCRIPT_DIR"
python OSTIA_download.py
conda deactivate

# Log end and show changes
log_changes "end" "$OSTIA_DIR"
