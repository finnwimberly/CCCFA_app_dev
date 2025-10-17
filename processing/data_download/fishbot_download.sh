#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
exec >> "$LOGDIR/fishbot.log" 2>&1

FISHBOT_DIR="/vast/clidex/data/obs/CCCFA/processed_data/fishbot_profiles"

# Log start and take snapshot
log_changes "start" "$FISHBOT_DIR"

# Activate environment and run
source ~/mambaforge/etc/profile.d/conda.sh
conda activate fiwi
cd "$SCRIPT_DIR"
python fishbot_download.py
conda deactivate

# Log end and show changes
log_changes "end" "$FISHBOT_DIR"
