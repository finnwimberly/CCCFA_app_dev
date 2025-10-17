#!/usr/bin/env bash
set -euo pipefail

# Change to the directory where this script itself is located
cd "$(dirname "$0")"
BASE="$(pwd)"
DL_LOGS="$BASE/data_download/logs"
MT_LOGS="$BASE/make_tiles/logs"
RS_LOGS="$BASE/resample/logs"
TS_LOGS="$BASE/time_series/logs"
UF_LOGS="$BASE/update_figs/logs"
SINCE_HOURS=24

now_iso=$(date -Iseconds)
since_epoch=$(date -d "-${SINCE_HOURS} hours" +%s)

print_section () { echo -e "\n=== $1 ==="; }

summarize_dir () {
  local dir="$1" label="$2"
  print_section "$label ($dir)"

  # Skip silently if the directory doesn't exist
  if [[ ! -d "$dir" ]]; then
    echo "(directory missing)"
    return
  fi

  shopt -s nullglob
  local printed_any=0
  for f in "$dir"/*.log; do
    mtime=$(stat -c %Y "$f")
    if (( mtime < since_epoch )); then
      continue
    fi

    last_start=$(grep -E '^(START:|Starting)' "$f" | tail -n1 || true)
    last_ok=$(grep -E '^STATUS: OK' "$f" | tail -n1 || true)
    last_fail=$(grep -E '^STATUS: FAIL' "$f" | tail -n1 || true)
    last_err=$(grep -Ei 'error|traceback|exception|failed' "$f" | tail -n3 || true)

    status="UNKNOWN"
    if [[ -n "$last_ok" ]]; then status="OK"
    elif [[ -n "$last_fail" ]]; then status="FAIL"
    elif [[ -n "$last_err" ]]; then status="WARN"
    fi

    echo "-- $(basename "$f")"
    [[ -n "$last_start" ]] && echo "   last start: $last_start"
    echo "   status: $status"
    [[ -n "$last_fail" ]] && echo "   $last_fail"
    if [[ "$status" != "OK" && -n "$last_err" ]]; then
      echo "   last errors:"
      echo "   $last_err" | sed 's/^/   /'
    fi

    printed_any=1
  done

  if [[ $printed_any -eq 0 ]]; then
    echo "(no logs updated in the last ${SINCE_HOURS}h)"
  fi
}

echo "ccocean nightly download & processing summary"
echo "Generated: $now_iso (last ${SINCE_HOURS}h)"

summarize_dir "$DL_LOGS" "DATA DOWNLOADS"
summarize_dir "$MT_LOGS" "TILE GENERATION"
summarize_dir "$RS_LOGS" "RESAMPLE"
summarize_dir "$TS_LOGS" "TIME SERIES"
summarize_dir "$UF_LOGS" "FIGURE UPDATES"

echo
echo "Logs older than ${SINCE_HOURS}h are hidden from this summary."
