#!/bin/bash

# Source Conda environment setup directly
source /home/finn.wimberly/mambaforge/etc/profile.d/conda.sh

# Activate the fiwi environment using conda
conda activate fiwi

# Navigate to the project directory
cd /home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/

# Run the Python script
python EMOLT_readin.py

# Deactivate the environment (optional)
conda deactivate

echo "Script completed at $(date)" >> /home/finn.wimberly/Documents/CCCFA_app_dev/Project/processing/logs/EMOLT_profiles.log