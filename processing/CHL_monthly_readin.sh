#!/bin/bash

source /home/finn.wimberly/mambaforge/etc/profile.d/conda.sh

# Activate base environment
conda activate cop_marine

# Navigate to the project directory
cd /home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/

# Run the Python script
python CHL_monthly_readin.py

# Deactivate the environment (optional)
conda deactivate

echo "Script completed at $(date)" >> /home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/logs/CHL_monthly_download.log