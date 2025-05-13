#!/bin/bash

# Source Conda environment setup directly
source /home/finn.wimberly/mambaforge/etc/profile.d/conda.sh

# Activate the fiwi environment using conda
conda activate fiwi

# Navigate to the project directory
cd /home/finn.wimberly/Documents/CCCFA_app_dev/Project/data/

# Run the Python script
python update_profiles_from_erddap.py

# Deactivate the environment (optional)
conda deactivate

echo "Script completed at $(date)" >> /home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/logs/update_ERRDAP_profiles.log