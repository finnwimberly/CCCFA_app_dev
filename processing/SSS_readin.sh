#!/bin/bash

# Set HOME environment variable to ensure .netrc is found
export HOME=/home/finn.wimberly

# Log start time
LOG_FILE="/home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/logs/SSS_download.log"
echo "[$(date -u)] Starting podaac-data-subscriber..." >> "$LOG_FILE"

# Run the podaac-data-subscriber to download recent data
/home/finn.wimberly/mambaforge/bin/podaac-data-subscriber \
  -c SMAP_RSS_L3_SSS_SMI_8DAY-RUNNINGMEAN_V6 \
  -d /vast/clidex/data/obs/SSS/SMAP/SMAP_RSS_v6.0/data/8daily \
  -m 1440 \
  >> "$LOG_FILE" 2>&1

# Log end time
echo "[$(date -u)] Finished podaac-data-subscriber." >> "$LOG_FILE"