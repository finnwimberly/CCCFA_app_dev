#!/bin/bash
# This script downloads daily data from 2024-08-01 to today
# but skips any dates where a file already exists.
# It terminates if a "time dimension exceed" error occurs.

# Set start and end dates in YYYY-MM-DD format
start_date="2024-08-01"  # Start from the first available date
end_date=$(date +"%Y-%m-%d")  # Automatically set end date to today

# Convert dates to seconds since epoch
start_sec=$(date -d "$start_date" +%s)
end_sec=$(date -d "$end_date" +%s)

# Directory where data will be saved
output_dir="/vast/clidex/data/obs/GlobColour/daily"

COPERNICUS_PATH="/home/finn.wimberly/mambaforge/bin/copernicusmarine"

# Loop through each date until today
current_date="$start_date"
while [ "$(date -d "$current_date" +%s)" -le "$end_sec" ]; do
    # Check if any file exists for this date (handling variations like _(1).nc, _(2).nc)
    existing_files=($(ls ${output_dir}/*${current_date}*.nc 2>/dev/null))

    if [ ${#existing_files[@]} -gt 0 ]; then
        echo "File(s) already exist for ${current_date}: ${existing_files[*]}. Skipping..."
    else
        echo "Downloading data for ${current_date}..."
        output=$($COPERNICUS_PATH subset \
           --dataset-id cmems_obs-oc_glo_bgc-plankton_my_l3-multi-4km_P1D \
           --variable CHL \
           --variable flags \
           --start-datetime "${current_date}T00:00:00" \
           --end-datetime "${current_date}T23:59:59" \
           --minimum-longitude -85.07 \
           --maximum-longitude -35.00 \
           --minimum-latitude 22.10 \
           --maximum-latitude 48.00 \
           --output-directory "${output_dir}" 2>&1)  # Capture both stdout and stderr

        # Check if the command exited successfully
        if [[ $? -ne 0 ]]; then
            echo "Error downloading data for ${current_date}"
            echo "$output"
            
            # Check if the error contains "exceed the dataset coordinates"
            if echo "$output" | grep -q "exceed the dataset coordinates"; then
                echo "Time dimension exceed error detected. Terminating script."
                exit 1
            fi
        else
            echo "Download successful for ${current_date}"
        fi
    fi

    # Increment the current date by one day
    current_date=$(date -I -d "$current_date + 1 day")
done

echo "All downloads complete."