#!/usr/bin/env sh
set -eu

mode=${1:-}
app_dir=${2:-}
data_dir=${3:-}
[ -n "$mode" ] && [ -n "$app_dir" ] && [ -n "$data_dir" ] || { echo "Missing updater arguments" >&2; exit 1; }

updates_dir="$data_dir/updates"
install_marker="$updates_dir/install.json"
startup_pending="$updates_dir/startup-pending.json"
state_file="$updates_dir/state.json"
last_result="$updates_dir/last-result.json"
backup_app="$updates_dir/previous-app"
backup_data="$updates_dir/previous-data"
staging_dir="$updates_dir/install-stage"
install_in_progress=0
node_bin="$app_dir/node/bin/node"
if ! "$node_bin" -e '' >/dev/null 2>&1 && [ -x "$backup_app/node/bin/node" ]; then
    node_bin="$backup_app/node/bin/node"
fi

json_value() {
    "$node_bin" -e 'const fs=require("fs");const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(value[process.argv[2]]??""));' "$1" "$2"
}

write_json() {
    output_path=$1
    status=$2
    from_version=$3
    target_version=$4
    "$node_bin" -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({status:process.argv[2],fromVersion:process.argv[3],targetVersion:process.argv[4],completedAt:new Date().toISOString()},null,2));' "$output_path" "$status" "$from_version" "$target_version"
}

copy_data_file() {
    relative_path=$1
    source_root=$2
    destination_root=$3
    [ -f "$source_root/$relative_path" ] || return 0
    mkdir -p "$(dirname "$destination_root/$relative_path")"
    cp -p "$source_root/$relative_path" "$destination_root/$relative_path"
}

restore_previous() {
    [ -d "$backup_app" ] || { echo "Previous application backup is missing" >&2; exit 1; }
    from_version=$(json_value "$startup_pending" fromVersion)
    target_version=$(json_value "$startup_pending" targetVersion)
    for name in server node ffmpeg; do
        rm -rf "$app_dir/$name"
        [ ! -e "$backup_app/$name" ] || cp -a "$backup_app/$name" "$app_dir/$name"
    done
    for name in update-kikoeru.sh README.txt LICENSE; do
        rm -f "$app_dir/$name"
        [ ! -f "$backup_app/$name" ] || cp -p "$backup_app/$name" "$app_dir/$name"
    done
    for relative_path in config/config.json sqlite/db.sqlite3 sqlite/db.sqlite3-wal sqlite/db.sqlite3-shm; do
        copy_data_file "$relative_path" "$backup_data" "$data_dir"
    done
    rm -f "$startup_pending" "$install_marker" "$state_file"
    node_bin="$app_dir/node/bin/node"
    write_json "$last_result" rolled-back "$from_version" "$target_version"
}

rollback_failed_install() {
    status=$?
    trap - EXIT
    if [ "$install_in_progress" -eq 1 ]; then
        install_in_progress=0
        set +e
        restore_previous
        restore_status=$?
        if [ "$restore_status" -ne 0 ]; then
            echo "Update failed and the previous version could not be restored" >&2
        fi
    fi
    exit "$status"
}

case "$mode" in
    rollback)
        [ -f "$startup_pending" ] || { echo "No pending update can be rolled back" >&2; exit 1; }
        restore_previous
        exit 0
        ;;
    handle-pending)
        [ -f "$startup_pending" ] || exit 0
        pending_stage=$(json_value "$startup_pending" stage)
        if [ "$pending_stage" = ready ]; then
            "$node_bin" -e 'const fs=require("fs");const p=process.argv[1];const value=JSON.parse(fs.readFileSync(p,"utf8"));value.stage="started";value.startedAt=new Date().toISOString();fs.writeFileSync(p,JSON.stringify(value,null,2));' "$startup_pending"
        else
            restore_previous
        fi
        exit 0
        ;;
    install) ;;
    *) echo "Unknown updater mode: $mode" >&2; exit 1 ;;
esac

[ -f "$install_marker" ] || { echo "Update install marker is missing" >&2; exit 1; }
package_path=$(json_value "$install_marker" packagePath)
expected_digest=$(json_value "$install_marker" digest)
from_version=$(json_value "$install_marker" fromVersion)
target_version=$(json_value "$install_marker" targetVersion)
case "$package_path" in "$updates_dir"/*) ;; *) echo "Update package is outside the data update directory" >&2; exit 1 ;; esac
[ -f "$package_path" ] || { echo "Update package is missing" >&2; exit 1; }
actual_digest=$(sha256sum "$package_path")
actual_digest=${actual_digest%% *}
[ "$actual_digest" = "$expected_digest" ] || { echo "Update package SHA-256 mismatch" >&2; exit 1; }

rm -rf "$staging_dir" "$backup_app" "$backup_data"
mkdir -p "$staging_dir" "$backup_app" "$backup_data"
tar -xzf "$package_path" -C "$staging_dir"
content_root=$staging_dir
top_directory=$(find "$staging_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)
top_count=$(find "$staging_dir" -mindepth 1 -maxdepth 1 -type d | wc -l)
if [ "$top_count" -eq 1 ] && [ -f "$top_directory/server/src/app.js" ]; then content_root=$top_directory; fi
for required in server/src/app.js node/bin/node ffmpeg/ffmpeg update-kikoeru.sh; do
    [ -e "$content_root/$required" ] || { echo "Update package is missing $required" >&2; exit 1; }
done

for name in server node ffmpeg; do [ ! -e "$app_dir/$name" ] || cp -a "$app_dir/$name" "$backup_app/$name"; done
for name in update-kikoeru.sh README.txt LICENSE; do [ ! -f "$app_dir/$name" ] || cp -p "$app_dir/$name" "$backup_app/$name"; done
for relative_path in config/config.json sqlite/db.sqlite3 sqlite/db.sqlite3-wal sqlite/db.sqlite3-shm; do copy_data_file "$relative_path" "$data_dir" "$backup_data"; done
"$node_bin" -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({stage:"installing",fromVersion:process.argv[2],targetVersion:process.argv[3],createdAt:new Date().toISOString()},null,2));' "$startup_pending" "$from_version" "$target_version"

install_in_progress=1
trap rollback_failed_install EXIT
for name in server node ffmpeg; do rm -rf "$app_dir/$name"; cp -a "$content_root/$name" "$app_dir/$name"; done
for name in update-kikoeru.sh README.txt LICENSE; do [ ! -f "$content_root/$name" ] || cp -p "$content_root/$name" "$app_dir/$name"; done
node_bin="$app_dir/node/bin/node"
"$node_bin" -e 'const fs=require("fs");const p=process.argv[1];const value=JSON.parse(fs.readFileSync(p,"utf8"));value.stage="ready";value.installedAt=new Date().toISOString();fs.writeFileSync(p,JSON.stringify(value,null,2));' "$startup_pending"
rm -f "$install_marker"
install_in_progress=0
trap - EXIT
