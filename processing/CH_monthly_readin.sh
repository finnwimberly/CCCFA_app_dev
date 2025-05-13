#!/bin/bash
# This script downloads monthly CHL data from 2024-01-01 to today
# but skips months where a file already exists.
# It terminates if a "time dimension exceed" error occurs.

# Set start and end dates in YYYY-MM-DD format
start_date="2024-01-01"
end_date=$(date +"%Y-%m-%d")  # Today

# Convert dates to seconds since epoch
start_sec=$(date -d "$start_date" +%s)
end_sec=$(date -d "$end_date" +%s)

# Directory where data will be saved
output_dir="/vast/clidex/data/obs/GlobColour/monthly"

COPERNICUS_PATH="/home/finn.wimberly/mambaforge/bin/copernicusmarine"

# Loop through each month
current_date="$start_date"
while [ "$(date -d "$current_date" +%s)" -le "$end_sec" ]; do
    year=$(date -d "$current_date" +%Y)
    month=$(date -d "$current_date" +%m)

    # Define month start and month end
    month_start="${year}-${month}-01"
    month_end=$(date -d "$month_start +1 month -1 day" +"%Y-%m-%d")

    # Check if file already exists for this month
    existing_files=($(ls ${output_dir}/*${year}${month}*.nc 2>/dev/null))

    if [ ${#existing_files[@]} -gt 0 ]; then
        echo "File(s) already exist for ${year}-${month}: ${existing_files[*]}. Skipping..."
    else
        echo "Downloading CHL data for ${year}-${month}..."
        output=$($COPERNICUS_PATH subset \
           --dataset-id cmems_obs-oc_glo_bgc-plankton_my_l4-multi-4km_P1M \
           --variable CHL \
           --variable flags \
           --start-datetime "${month_start}T00:00:00" \
           --end-datetime "${month_end}T23:59:59" \
           --minimum-longitude -85.07 \
           --maximum-longitude -59.94 \
           --minimum-latitude 22.10 \
           --maximum-latitude 46.06 \
           --output-directory "${output_dir}" 2>&1)

        # Check if the command exited successfully
        if [[ $? -ne 0 ]]; then
            echo "Error downloading data for ${year}-${month}"
            echo "$output"
            
            if echo "$output" | grep -q "exceed the dataset coordinates"; then
                echo "Time dimension exceed error detected. Terminating script."
                exit 1
            fi
        else
            echo "Download successful for ${year}-${month}"
        fi
    fi

    # Move to next month
    current_date=$(date -I -d "$current_date +1 month")
done

echo "All downloads complete."