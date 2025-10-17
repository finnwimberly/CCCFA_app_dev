#!/usr/bin/env bash
# tools/log_utils.sh
# Simple logging utility to track changes in directories

log_changes() {
    local action="$1"  # "start" or "end"
    local watch_dir="$2"
    local snapshot_file="/tmp/log_snapshot_$$_$(date +%s).txt"
    
    if [[ "$action" == "start" ]]; then
        echo "START: $(date -Iseconds)"
        echo "WATCH_DIR: $watch_dir"
        
        # Snapshot top-level items (folders and files at depth 1)
        if [[ -d "$watch_dir" ]]; then
            find "$watch_dir" -maxdepth 1 -mindepth 1 2>/dev/null | sort > "$snapshot_file"
        else
            touch "$snapshot_file"
        fi
        
        # Export snapshot file path for use in "end"
        export LOG_SNAPSHOT_FILE="$snapshot_file"
        
    elif [[ "$action" == "end" ]]; then
        # Find what's new at top level
        if [[ -d "$watch_dir" ]]; then
            local snapshot_after="/tmp/log_snapshot_after_$$_$(date +%s).txt"
            find "$watch_dir" -maxdepth 1 -mindepth 1 2>/dev/null | sort > "$snapshot_after"
            
            # Compare snapshots
            local new_items=$(comm -13 "${LOG_SNAPSHOT_FILE:-/dev/null}" "$snapshot_after" 2>/dev/null)
            
            if [[ -n "$new_items" ]]; then
                local count=$(echo "$new_items" | wc -l | tr -d ' ')
                echo "NEW_ITEMS: $count item(s)"
                echo "$new_items" | while read -r item; do
                    if [[ -d "$item" ]]; then
                        echo "  - $(basename "$item")/"
                    else
                        echo "  - $(basename "$item")"
                    fi
                done
            else
                echo "NO_NEW_ITEMS"
            fi
            
            # Cleanup
            rm -f "${LOG_SNAPSHOT_FILE:-/dev/null}" "$snapshot_after" 2>/dev/null
        fi
        
        echo "END: $(date -Iseconds)" 
        echo
    fi
}

