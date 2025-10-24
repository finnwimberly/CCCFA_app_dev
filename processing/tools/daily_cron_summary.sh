#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
BASE="$(pwd)"
DL_LOGS="$BASE/../data_download/logs"
MT_LOGS="$BASE/../make_tiles/logs"
RS_LOGS="$BASE/../resample/logs"
TS_LOGS="$BASE/../time_series/logs"
UF_LOGS="$BASE/../update_figs/logs"
SINCE_HOURS=24

now_iso=$(date -Iseconds)
since_epoch=$(date -d "-${SINCE_HOURS} hours" +%s)

print_section () { echo -e "\n=== $1 ==="; }

# ----- helpers ---------------------------------------------------------------

# Return 0/1 based on whether file was modified within window
touched_recently () {
  local f="$1"
  local mtime
  mtime=$(stat -c %Y "$f")
  (( mtime >= since_epoch ))
}

# Extract last created items block -> echo items (one per line)
get_new_items () {
  awk '
    BEGIN{collect=0}
    /^NEW_ITEMS:/ {collect=1; next}
    collect==1 && $0 ~ /^[[:space:]]+- / {
      gsub(/^[[:space:]]+-[[:space:]]*/,"",$0); gsub(/[[:space:]]+$/,"",$0);
      print $0;
      next
    }
    collect==1 && $0 !~ /^[[:space:]]/ {collect=0}
  ' "$1"
}

# Pull WATCH_DIR
get_watch_dir () {
  grep -E '^WATCH_DIR:' -m1 "$1" | sed 's/^WATCH_DIR:[[:space:]]*//'
}

# Try to infer last downloaded filename from a download log
# Looks for common verbs and path-ish tokens with known data extensions
get_last_downloaded_from_log () {
  grep -E -i -A 5 \
    -e 'download(ed|ing)\b' \
    -e '\bsaved\b|\bwritten\b|\bwrote\b|\boutput\b' \
    -e '\bto\b.*\.(nc|nc4|h5|csv|tif|tiff|grib2?|zip|gz)\b' \
    -e 'NEW_ITEMS' \
    "$1" 2>/dev/null \
  | grep -E -o "[A-Za-z0-9._+~/-]+\.(nc|nc4|h5|csv|tif|tiff|grib2?|zip|gz)" \
  | tail -n1 || true
}

summarize_downloads () {
  local dir="$1"
  print_section "DOWNLOADS ($dir)"
  if [[ ! -d "$dir" ]]; then
    echo "(no log directory)"
    return
  fi
  shopt -s nullglob
  for f in "$dir"/*download*.log; do
    local name; name=$(basename "$f" .log)
    if ! touched_recently "$f"; then
      echo "$name: script not ran within the past ${SINCE_HOURS}h"
      continue
    fi
    # If updated recently, try to extract the last downloaded file mentioned
    local last_dl=""
    last_dl=$(get_last_downloaded_from_log "$f")
    if [[ -n "$last_dl" ]]; then
      # If it's not already a full path, prepend WATCH_DIR
      if [[ "$last_dl" != /* ]]; then
        local watch_dir
        watch_dir=$(get_watch_dir "$f" || true)
        if [[ -n "$watch_dir" ]]; then
          last_dl="${watch_dir}/${last_dl}"
        fi
      fi
      echo "$name: latest file: $last_dl"
    else
      echo "$name: no files downloaded within the last ${SINCE_HOURS}h"
    fi
  done

  # If there were zero matching logs:
  ls -1 "$dir"/*download*.log >/dev/null 2>&1 || echo "(no download logs found)"
}

summarize_generic_processes () {
  local dir="$1" label="$2"
  print_section "$label ($dir)"
  if [[ ! -d "$dir" ]]; then
    echo "(no log directory)"
    return
  fi
  shopt -s nullglob
  local any=0
  for f in "$dir"/*.log; do
    any=1
    local name; name=$(basename "$f" .log)
    if ! touched_recently "$f"; then
      echo "$name: script not ran within the past ${SINCE_HOURS}h"
      continue
    fi

    # Parse NEW_ITEMS (take the last one) and WATCH_DIR
    mapfile -t items < <(get_new_items "$f" || true)
    local watch_dir; watch_dir=$(get_watch_dir "$f" || true)

    if ((${#items[@]} > 0)); then
      # last item in NEW_ITEMS
      local latest="${items[-1]}"
      latest="${latest%/}"
      if [[ -n "$watch_dir" ]]; then
        echo "$name: latest created: ${watch_dir}/${latest}"
      else
        echo "$name: latest created: ${latest}"
      fi
    else
      echo "$name: no dir/file created"
    fi
  done
  (( any == 1 )) || echo "(no logs found)"
}

# ----- run -------------------------------------------------------------------

echo "ccocean nightly summary"
echo "Generated: $now_iso (window: last ${SINCE_HOURS}h)"

summarize_downloads "$DL_LOGS"
summarize_generic_processes "$MT_LOGS" "TILE GENERATION"
summarize_generic_processes "$RS_LOGS" "RESAMPLE"
summarize_generic_processes "$TS_LOGS" "TIME SERIES"
summarize_generic_processes "$UF_LOGS" "FIGURE UPDATES"