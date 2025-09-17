#!/bin/bash

source /home/finn.wimberly/mambaforge/etc/profile.d/conda.sh

# Activate base environment
conda activate cop_marine

# Navigate to the project directory
cd /home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/

# Run the Python script
python OSTIA_readin.py

# Deactivate the environment (optional)
conda deactivate

echo "Script completed at $(date)" >> /home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/logs/OSTIA_download.log

# # Define start date
# start_date="2024-01-01"

# # Automatically set end date to today
# end_date=$(date -I)

# # Define output directory
# output_dir="/vast/clidex/data/obs/SST/OSTIA/data/daily"

# # Loop through each date in the range
# current_date="$start_date"
# while [[ "$current_date" < "$end_date" ]] || [[ "$current_date" == "$end_date" ]]; do
#     echo "Checking data for $current_date..."

#     # Define expected file path based on naming convention
#     expected_file="${output_dir}/METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2_multi-vars_179.98W-179.98E_89.97S-89.97N_${current_date}.nc"

#     # Check if the file already exists
#     if [[ -f "$expected_file" ]]; then
#         echo "File for $current_date already exists. Skipping download."
#     else
#         echo "Downloading data for $current_date..."

#         # Run the download command
#         copernicusmarine subset \
#             --dataset-id METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2 \
#             --variable analysed_sst \
#             --variable analysis_error \
#             --variable mask \
#             --variable sea_ice_fraction \
#             --start-datetime "${current_date}T00:00:00" \
#             --end-datetime "${current_date}T23:59:59" \
#             --minimum-longitude -179.97500610351562 \
#             --maximum-longitude 179.97500610351562 \
#             --minimum-latitude -89.9749984741211 \
#             --maximum-latitude 89.9749984741211 \
#             --coordinates-selection-method strict-inside \
#             --netcdf-compression-level 1 \
#             --output-directory "$output_dir"

#         # # Capture exit status
#         # exit_status=$?
#         # if [[ $exit_status -ne 0 ]]; then
#         #     echo "Error encountered while downloading $current_date. Exit code: $exit_status"

#         #     # Check if error is due to exceeding the time dimension limit
#         #     error_message="exceeds the time dimension of the available dataset"
#         #     if [[ $(grep -i "$error_message" <<< "$(copernicusmarine subset --help 2>&1)") ]]; then
#         #         echo "Stopping script: Requested date exceeds available data range."
#         #         break
#         #     fi
#         # fi
#     fi

#     # Move to the next date
#     current_date=$(date -I -d "$current_date + 1 day")
# done

# echo "Download process completed!"
