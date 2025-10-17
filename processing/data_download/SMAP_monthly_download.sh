#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
exec >> "$LOGDIR/SMAP_monthly_download.log" 2>&1

SMAP_MONTHLY_DIR="/vast/clidex/data/obs/SSS/SMAP/SMAP_RSS_v6.0/data/monthly"

# Log start and take snapshot
log_changes "start" "$SMAP_MONTHLY_DIR"

# Run podaac-data-subscriber
mkdir -p "$SMAP_MONTHLY_DIR"
echo "Starting podaac-data-subscriber at $(date -u)"
~/mambaforge/bin/podaac-data-subscriber -c SMAP_RSS_L3_SSS_SMI_MONTHLY_V6 -d "$SMAP_MONTHLY_DIR" -m 1440
echo "Finished podaac-data-subscriber at $(date -u)"

# Log end and show changes
log_changes "end" "$SMAP_MONTHLY_DIR"
