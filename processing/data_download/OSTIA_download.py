#!/usr/bin/env python3
import os
import sys
from datetime import datetime, timedelta

try:
    import copernicusmarine
except Exception as exc:
    print(f"ERROR: copernicusmarine is required but not importable: {exc}")
    sys.exit(1)


DATASET_ID = "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2"
VARIABLES = [
    "analysed_sst", "analysis_error", "mask", "sea_ice_fraction"
]

# Global bounds matching the shell script
MIN_LON = -179.97500610351562
MAX_LON = 179.97500610351562
MIN_LAT = -89.9749984741211
MAX_LAT = 89.9749984741211

# Default dates: replicate shell behavior (start fixed, end = today)
DEFAULT_START = "2024-01-01"
DEFAULT_END = datetime.now().date().isoformat()

# Default output directory: same as shell
DEFAULT_OUTPUT_DIR = "/vast/clidex/data/obs/SST/OSTIA/data/daily"


def iter_dates(start_date: datetime, end_date: datetime):
    current = start_date
    while current <= end_date:
        yield current
        current = current + timedelta(days=1)


def format_expected_filename(date_str: str) -> str:
    # Mirror the naming from the shell script exactly
    return (
        f"{DATASET_ID}_multi-vars_179.98W-179.98E_89.97S-89.97N_{date_str}.nc"
    )


def ensure_directory(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def parse_args(argv):
    import argparse

    parser = argparse.ArgumentParser(
        description="Download daily OSTIA SST files via Copernicus Marine Python API, matching the shell script."
    )
    parser.add_argument(
        "--start-date",
        default=os.environ.get("OSTIA_START_DATE", DEFAULT_START),
        help=f"Start date (YYYY-MM-DD). Default: {DEFAULT_START}",
    )
    parser.add_argument(
        "--end-date",
        default=os.environ.get("OSTIA_END_DATE", DEFAULT_END),
        help="End date (YYYY-MM-DD). Default: today",
    )
    parser.add_argument(
        "--output-dir",
        default=os.environ.get("OSTIA_OUTPUT_DIR", DEFAULT_OUTPUT_DIR),
        help=f"Output directory. Default: {DEFAULT_OUTPUT_DIR}",
    )
    parser.add_argument(
        "--service",
        default=os.environ.get("COPERNICUS_SERVICE", "files"),
        choices=["files", "original-files", "arco-geo-series", "geoseries", "arco-time-series", "timeseries", "omi-arco", "static-arco"],
        help="Service to use. Default: files (force original files HTTPS).",
    )
    parser.add_argument(
        "--compression-level",
        type=int,
        default=int(os.environ.get("OSTIA_NC_COMPRESSION", "1")),
        help="NetCDF compression level 0-9. Default: 1",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not download, just print what would be done.",
    )

    args = parser.parse_args(argv)
    try:
        start_dt = datetime.strptime(args.start_date, "%Y-%m-%d").date()
        end_dt = datetime.strptime(args.end_date, "%Y-%m-%d").date()
    except ValueError as ve:
        parser.error(f"Invalid date format: {ve}")

    if end_dt < start_dt:
        parser.error("end-date must be >= start-date")

    return args, start_dt, end_dt


def main(argv=None) -> int:
    if argv is None:
        argv = sys.argv[1:]

    args, start_dt, end_dt = parse_args(argv)

    output_dir = args.output_dir
    ensure_directory(output_dir)

    for cur_date in iter_dates(start_dt, end_dt):
        date_str = cur_date.isoformat()
        # print(f"Checking data for {date_str}...")

        expected_filename = format_expected_filename(date_str)
        expected_path = os.path.join(output_dir, expected_filename)

        if os.path.isfile(expected_path):
            # print(f"File for {date_str} already exists. Skipping download.")
            continue

        print(f"Downloading data for {date_str}...")

        if args.dry_run:
            print(
                f"DRY RUN: would download {DATASET_ID} variables {VARIABLES} to {expected_path}"
            )
            continue

        try:
            # Use the Python API equivalent of the CLI subset, forcing NetCDF and files service
            copernicusmarine.subset(
                dataset_id=DATASET_ID,
                variables=VARIABLES,
                start_datetime=f"{date_str}T00:00:00",
                end_datetime=f"{date_str}T23:59:59",
                minimum_longitude=MIN_LON,
                maximum_longitude=MAX_LON,
                minimum_latitude=MIN_LAT,
                maximum_latitude=MAX_LAT,
                coordinates_selection_method="strict-inside",
                file_format="netcdf",
                output_directory=output_dir,
                output_filename=expected_filename,
                netcdf_compression_level=args.compression_level,
                skip_existing=True,
            )
        except Exception as exc:
            print(
                f"ERROR downloading {date_str}: {exc}\n"
                # "Hint: ensure 'copernicusmarine login' has been run and consider setting --service files"
            )
            return 2

    print("Download process completed!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


