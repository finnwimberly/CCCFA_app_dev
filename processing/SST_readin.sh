#REVISED CODE (1/14)
#!/bin/bash

# Script to download SST files from CoastWatch East Coast Node after Aug 1, 2024 (day 211)

# Set the directory where files will be saved
YOUR_DIRECTORY="/vast/clidex/data/obs/SST/NOAAVIIRS/"
mkdir -p $YOUR_DIRECTORY

# Set the log file
LOG_FILE="/home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/logs/SST_download.log"
mkdir -p $(dirname "$LOG_FILE")

# Get the current year and day of year
current_year=$(date +%Y)
current_day=$(date +%j)

# Log start of the script run
echo "Script run on: $(date)" >> $LOG_FILE

# Initialize downloaded file counter
downloaded_files=()

# Loop through files starting from day 211 of 2024 to the current day in 2025
start_year=2024
start_day=211

for year in $(seq $start_year $current_year); do
    # Determine the starting day for each year
    first_day=$start_day
    if [[ $year -gt $start_year ]]; then
        first_day=1  # Start from day 1 for subsequent years
    fi
    
    # Determine the ending day for the current year
    last_day=365
    if [[ $year -eq $current_year ]]; then
        last_day=$current_day  # Use current day for the current year
    fi

    # Loop through the range of days for the current year, incrementing by 3
    for day in $(seq $first_day 3 $last_day); do
        # Format the day with leading zeros
        padded_day=$(printf "%03d" $day)
        
        # Construct filename
        file="ACSPOCW_${year}${padded_day}_3DAY_MULTISAT_SST-NGT_EC_750M.nc4"
        
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
