#!/bin/bash

# Set the starting year and ending year
year_start=2016  
year_end=$(date +"%Y")  # Use current year

# Output directory
outdir="/vast/clidex/data/obs/SSS/SMAP/SMAP_RSS_v6.0/data/monthly"
mkdir -p "$outdir"

# Loop through years and months
for year in $(seq $year_start $year_end); do
    for month in $(seq -f "%02g" 1 12); do
        # Generate the file name
        fname="RSS_smap_SSS_L3_monthly_${year}_${month}_FNL_v06.0.nc"
        url="https://data.remss.com/smap/SSS/V06.0/FINAL/L3/monthly/${year}/$fname"
        outfile="$outdir/$fname"
        
        # Check if file already exists locally
        if [ -f "$outfile" ]; then
            echo "$outfile exists, skipping."
        else
            # Check if URL exists before downloading
            if wget --spider -q "$url"; then
                echo "Downloading $fname..."
                wget -O "$outfile" "$url"
            else
                echo "Data not available for $fname, skipping."
            fi
        fi
    done
done