#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
exec >> "$LOGDIR/VIIRS_download.log" 2>&1

VIIRS_DIR="/vast/clidex/data/obs/SST/NOAAVIIRS"

# Log start and take snapshot
log_changes "start" "$VIIRS_DIR"

# Run podaac-data-subscriber
mkdir -p "$VIIRS_DIR"
echo "Starting podaac-data-subscriber at $(date -u)"
~/mambaforge/bin/podaac-data-subscriber -c VIIRS_N20-OSPO-L3U-v2.61 -d "$VIIRS_DIR" -sd 2024-01-01T00:00:00Z -m 1440
echo "Finished podaac-data-subscriber at $(date -u)"

# Log end and show changes
log_changes "end" "$VIIRS_DIR"
