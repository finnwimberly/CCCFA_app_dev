#!/bin/bash

# Source Conda environment setup directly
source /home/finn.wimberly/mambaforge/etc/profile.d/conda.sh

# Activate the fiwi environment using conda
conda activate spyder_salinity

# Navigate to the project directory
cd /home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/

# Run the Python script and suppress verbose output, keeping only errors and key logs
python CHL_processing_log.py >> /home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/logs/CHL_tiles.log 2>/dev/null

# Deactivate the environment (optional)
conda deactivate

echo "Script completed at $(date)" >> /home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/logs/CHL_tiles.log