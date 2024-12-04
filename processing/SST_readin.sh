#!/bin/bash

# Script to download SST files from CoastWatch East Coast Node after Aug 1, 2024 (day 213)

# Set the directory where files will be saved
YOUR_DIRECTORY="/home/finn.wimberly/Documents/CCCFA_app_dev/Project/raw_data/SST/"
mkdir -p $YOUR_DIRECTORY

# Get current day of year
current_day=$(date +%j)
#echo "Current day of year: $current_day"

# Loop through days 211 to current day
for day in $(seq 211 $current_day); do
    # Format the day with leading zeros
    padded_day=$(printf "%03d" $day)
    
    # Construct filename
    file="ACSPOCW_2024${padded_day}_3DAY_MULTISAT_SST-NGT_EC_750M.nc4"
    
    # Check if the file already exists
    if [[ -f $YOUR_DIRECTORY/$file ]]; then
        #echo "File already exists: $file"
        continue
    fi
    
    echo "Getting file: $file"
    wget https://www.star.nesdis.noaa.gov/pub/socd1/ecn/data/avhrr-viirs/sst-ngt/3day/ec/$file
    
    # Move the downloaded file if successful
    if [ $? -eq 0 ]; then
        mv $file $YOUR_DIRECTORY/$file
        #echo "Successfully downloaded and moved: $file"
    # else
    #     echo "Failed to download: $file"
    fi
done

echo "Download complete! Files are in $YOUR_DIRECTORY"