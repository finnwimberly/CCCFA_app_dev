#!/bin/bash
# CoastWatch ECN 3-day VIIRS SST (EC sector), multi-year date-driven + summary-only logging

set -euo pipefail

# --- Config (override via env) ---
START_DATE="${START_DATE:-2024-08-01}"             # first date to attempt (UTC)
END_DATE="${END_DATE:-$(date -u +%F)}"             # last date to attempt  (UTC)
VIIRS_DIR="${VIIRS_DIR:-/vast/clidex/data/obs/SST/NOAAVIIRS/3day}"
BASE_URL="${BASE_URL:-https://www.star.nesdis.noaa.gov/pub/socd1/ecn/data/avhrr-viirs/sst-ngt/3day/ec}"

# --- Logging: write verbose run to a temp log; append only summary to final log ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../tools/log_utils.sh"

LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR" "$VIIRS_DIR"
TEMP_LOG="$LOGDIR/.VIIRS_temp.log"
FINAL_LOG="$LOGDIR/VIIRS_download.log"

# Redirect *all* output to the temp log
exec > "$TEMP_LOG" 2>&1

# Ensure we always close & filter logs on exit (success or error)
finish() {
  # End snapshot + END line go to temp log
  log_changes end "$VIIRS_DIR"
  echo "END: $(date +"%Y-%m-%dT%H:%M:%S%z")"

  # Filter: keep only the concise bottom summary from temp into the final log.
  # This preserves the summary from our loop and the log_changes diff block.
  # Included lines:
  #   - SUMMARY: ...
  #   - NEW_ITEMS: ... (and the bullet list)
  #   - NO_NEW_ITEMS
  #   - END:
  #   - The diff block from log_changes (lines that start with "NEW_ITEMS:" and "  - " are included)
  grep -E '^(SUMMARY:|NEW_ITEMS:|  - |NO_NEW_ITEMS|END:)' "$TEMP_LOG" >> "$FINAL_LOG" || true

  # If you also want the log_changes START line or WATCH_DIR once, add them:
  # grep -E '^(START:|WATCH_DIR:|SUMMARY:|NEW_ITEMS:|  - |NO_NEW_ITEMS|END:)' "$TEMP_LOG" >> "$FINAL_LOG"

  rm -f "$TEMP_LOG"
}
trap finish EXIT

# --- Begin run (goes to temp log only) ---
log_changes start "$VIIRS_DIR"
cd "$VIIRS_DIR"

success=0
fail=0

cur="$START_DATE"
while : ; do
  YEAR="$(date -u -d "$cur" +%Y)"
  DOY="$(date -u -d "$cur" +%j)"
  file="ACSPOCW_${YEAR}${DOY}_3DAY_MULTISAT_SST-NGT_EC_750M.nc4"

  if [[ -f "$file" ]]; then
    echo "Exists, skipping: $file"
  else
    echo "Fetching: $file"
    if command wget --no-config -nv -c --tries=3 --waitretry=5 --timeout=30 --read-timeout=30 \
         "${BASE_URL}/${file}"; then
      : $((success++))
    else
      echo "WARN: failed: $file"
      : $((fail++))
    fi
  fi

  [[ "$cur" == "$END_DATE" ]] && break
  cur="$(date -u -d "$cur +1 day" +%F)"
done

echo "SUMMARY: success=$success failed=$fail"
# log_changes end + END line handled by trap/finish()
