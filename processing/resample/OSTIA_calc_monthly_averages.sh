#!/bin/bash

# Source logging utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

# Setup logging
LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"
exec >> "$LOGDIR/OSTIA_monthly_resampling.log" 2>&1

OUTPUT_DIR="/vast/clidex/data/obs/SST/OSTIA/data/monthly"

# Log start and take snapshot
log_changes "start" "$OUTPUT_DIR"

# Activate environment
source ~/mambaforge/etc/profile.d/conda.sh
conda activate spyder_salinity

# Directory with all daily NetCDF files
DATA_DIR="/vast/clidex/data/obs/SST/OSTIA/data/daily"
mkdir -p "$OUTPUT_DIR"

# Start date
START_YEAR=2024
START_MONTH=1

# Current year/month
CURRENT_YEAR=$(date +%Y)
CURRENT_MONTH=$(date +%m)

# Loop from START_YEAR/MONTH to current
year=$START_YEAR
month=$START_MONTH

while [ $year -lt $((CURRENT_YEAR + 1)) ]; do
    while [ $month -le 12 ]; do
        # Skip the current month in the current year (incomplete)
        if [ $year -eq $CURRENT_YEAR ] && [ $month -ge $CURRENT_MONTH ]; then
            break
        fi

        # Format month (01, 02, ...)
        mm=$(printf "%02d" $month)
        echo "Processing ${year}-${mm}..."

        # Output filename
        OUTFILE="${OUTPUT_DIR}/sst_${year}_${mm}.nc"

        # Skip if file already exists
        if [ -f "$OUTFILE" ]; then
            echo "Already exists, skipping: $OUTFILE"
        else
            # Run CDO on matching daily files
            FILE_PATTERN="${DATA_DIR}/*_${year}-${mm}-*.nc"
            if ls $FILE_PATTERN 1> /dev/null 2>&1; then
                cdo -f nc4c -z zip monmean -selname,analysed_sst -cat $FILE_PATTERN "$OUTFILE"
                echo "Created: $OUTFILE"
            else
                echo "No files found for ${year}-${mm}, skipping."
            fi
        fi

        month=$((month + 1))
    done
    year=$((year + 1))
    month=1
done

echo "All monthly averages created!"

conda deactivate

# Log end and show changes
log_changes "end" "$OUTPUT_DIR"
