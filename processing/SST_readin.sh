#!/bin/bash

# Script to download SST files from CoastWatch East Coast Node after Aug 1, 2024 (day 213)

# Set the directory where files will be saved
YOUR_DIRECTORY="/vast/clidex/data/obs/SST/NOAAVIIRS/"
mkdir -p $YOUR_DIRECTORY

# Set the log file
LOG_FILE="/home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/logs/SST_download.log"
mkdir -p $(dirname "$LOG_FILE")

# Get current day of year
current_day=$(date +%j)

# Log start of the script run
echo "Script run on: $(date)" >> $LOG_FILE

# Initialize downloaded file counter
downloaded_files=()

# Loop through days 211 to current day
for day in $(seq 211 $current_day); do
    # Format the day with leading zeros
    padded_day=$(printf "%03d" $day)
    
    # Construct filename
    file="ACSPOCW_2024${padded_day}_3DAY_MULTISAT_SST-NGT_EC_750M.nc4"
    
    # Check if the file already exists
    if [[ -f $YOUR_DIRECTORY/$file ]]; then
        continue
    fi
    
    # Download the file
    wget -q https://www.star.nesdis.noaa.gov/pub/socd1/ecn/data/avhrr-viirs/sst-ngt/3day/ec/$file
    
    # Check if the download was successful
    if [ $? -eq 0 ]; then
        mv $file $YOUR_DIRECTORY/$file
        downloaded_files+=("$file")
    fi
done

# Log the results
if [ ${#downloaded_files[@]} -eq 0 ]; then
    echo "No new files downloaded." >> $LOG_FILE
else
    echo "Downloaded files:" >> $LOG_FILE
    for file in "${downloaded_files[@]}"; do
        echo "  - $file" >> $LOG_FILE
    done
fi

# Add a completion message
echo "Script completed at: $(date)" >> $LOG_FILE