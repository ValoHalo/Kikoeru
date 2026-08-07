#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source_web_root="$repository_root/web"
source_server_root="$repository_root/server"
release_config="$source_server_root/scripts/release-config.json"
build_root="$repository_root/.build"
downloads_root="$build_root/downloads"
tooling_root="$build_root/tooling"
work_root="$build_root/work/linux"
release_root="$build_root/release/linux"
npm_cache="$build_root/cache/linux-npm"

fail() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

config_value() {
    node -e '
const config = require(process.argv[1]);
let value = config;
for (const key of process.argv[2].split(".")) value = value[key];
process.stdout.write(String(value));
' "$release_config" "$1"
}

reset_directory() {
    case "$1" in
        "$build_root"/*) ;;
        *) fail "Refusing to reset path outside .build: $1" ;;
    esac
    rm -rf -- "$1"
    mkdir -p -- "$1"
}

download_file() {
    local url="$1"
    local destination="$2"
    if [[ ! -f "$destination" ]]; then
        printf 'Downloading %s\n' "$url"
        curl -fL "$url" -o "$destination"
    fi
}

verify_sha256() {
    local file="$1"
    local expected="$2"
    local actual
    actual="$(sha256sum "$file")"
    actual="${actual%% *}"
    [[ "$actual" == "$expected" ]] || fail "SHA-256 mismatch for $file: expected $expected, got $actual"
}

run_in() {
    local directory="$1"
    shift
    (
        cd "$directory"
        "$@"
    )
}

for command_name in node git curl tar sha256sum; do
    require_command "$command_name"
done

product_version="$(node -p "require('$source_server_root/package.json').version")"
[[ "$product_version" =~ ^[0-9A-Za-z._-]+$ ]] || fail "Invalid product version: $product_version"
commit_id="$(git -C "$repository_root" rev-parse HEAD)"
commit_id="${commit_id:0:6}"

node_archive_url="$(config_value linuxNode.archiveUrl)"
node_archive_name="$(config_value linuxNode.archiveFileName)"
node_archive_root="$(config_value linuxNode.archiveRoot)"
node_archive_sha256="$(config_value linuxNode.archiveSha256)"
ffmpeg_archive_url="$(config_value linuxFfmpeg.archiveUrl)"
ffmpeg_archive_name="$(config_value linuxFfmpeg.archiveFileName)"
ffmpeg_archive_root="$(config_value linuxFfmpeg.archiveRoot)"
ffmpeg_archive_sha256="$(config_value linuxFfmpeg.archiveSha256)"

mkdir -p "$downloads_root" "$tooling_root" "$npm_cache"
node_archive="$downloads_root/$node_archive_name"
ffmpeg_archive="$downloads_root/$ffmpeg_archive_name"
node_toolchain="$tooling_root/$node_archive_root"
ffmpeg_toolchain="$tooling_root/$ffmpeg_archive_root"

download_file "$node_archive_url" "$node_archive"
verify_sha256 "$node_archive" "$node_archive_sha256"
download_file "$ffmpeg_archive_url" "$ffmpeg_archive"
verify_sha256 "$ffmpeg_archive" "$ffmpeg_archive_sha256"

if [[ ! -x "$node_toolchain/bin/node" ]]; then
    reset_directory "$node_toolchain"
    tar -xJf "$node_archive" -C "$tooling_root"
fi
if [[ ! -x "$ffmpeg_toolchain/bin/ffmpeg" || ! -x "$ffmpeg_toolchain/bin/ffprobe" ]]; then
    reset_directory "$ffmpeg_toolchain"
    tar -xJf "$ffmpeg_archive" -C "$tooling_root"
fi

export PATH="$node_toolchain/bin:$PATH"
[[ "$(node --version)" == "v$(config_value linuxNode.version)" ]] || fail "Downloaded Node.js version does not match release-config.json"
[[ "$(npm --version)" == 11.* ]] || fail "The bundled Node.js runtime must provide npm 11"

web_work_root="$work_root/web"
server_work_root="$work_root/server"
reset_directory "$work_root"
mkdir -p "$web_work_root" "$server_work_root"
cp -a "$source_web_root/." "$web_work_root/"
cp -a "$source_server_root/." "$server_work_root/"
rm -rf "$web_work_root/node_modules" "$web_work_root/.quasar" "$web_work_root/dist"
rm -rf "$server_work_root/node_modules" "$server_work_root/.runtime" "$server_work_root/config" "$server_work_root/covers" "$server_work_root/sqlite" "$server_work_root/src/public"

run_in "$web_work_root" npm ci --no-audit --no-fund --cache "$npm_cache"
run_in "$web_work_root" npm run check
run_in "$web_work_root" npm run build

run_in "$server_work_root" npm ci --no-audit --no-fund --cache "$npm_cache"
run_in "$server_work_root" npm test
run_in "$server_work_root" npm run check
run_in "$server_work_root" npm prune --omit=dev --no-audit --no-fund

cp -a "$web_work_root/dist/pwa" "$server_work_root/src/public"

stage_name="kikoeru-linux-x64-$commit_id"
stage_root="$release_root/$stage_name"
reset_directory "$release_root"
mkdir -p "$stage_root/server" "$stage_root/node" "$stage_root/ffmpeg" "$stage_root/data"
cp "$server_work_root/package.json" "$server_work_root/package-lock.json" "$stage_root/server/"
cp -a "$server_work_root/src" "$server_work_root/node_modules" "$stage_root/server/"
cp -a "$node_toolchain/." "$stage_root/node/"
cp "$ffmpeg_toolchain/bin/ffmpeg" "$ffmpeg_toolchain/bin/ffprobe" "$stage_root/ffmpeg/"
cp "$ffmpeg_toolchain/LICENSE.txt" "$stage_root/ffmpeg/"
cp "$repository_root/LICENSE" "$stage_root/LICENSE"

cat >"$stage_root/start-kikoeru.sh" <<'EOF'
#!/usr/bin/env sh
set -eu

app_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
: "${PORT:=8888}"
: "${KIKOERU_DATA_DIR:=$app_dir/data}"

export PORT
export NODE_ENV=production
export KIKOERU_DATA_DIR
export PATH="$app_dir/ffmpeg:$PATH"

mkdir -p "$KIKOERU_DATA_DIR"
exec "$app_dir/node/bin/node" "$app_dir/server/src/app.js"
EOF
chmod +x "$stage_root/start-kikoeru.sh"

cat >"$stage_root/README.txt" <<EOF
Kikoeru $product_version - Linux x64 portable

Run ./start-kikoeru.sh, then open http://127.0.0.1:8888/.
The default username and password are both admin.
Configuration, databases, covers and transcodes are stored in data/.
Set PORT or KIKOERU_DATA_DIR before starting to override those defaults.

Bundled third-party licenses:
- Node.js: node/LICENSE
- FFmpeg: ffmpeg/LICENSE.txt

Source commit: $commit_id
EOF

archive_path="$repository_root/$stage_name.tar.gz"
rm -f "$archive_path"
tar -czf "$archive_path" -C "$release_root" "$stage_name"

archive_sha256="$(sha256sum "$archive_path")"
archive_sha256="${archive_sha256%% *}"
printf 'Portable archive: %s\n' "$archive_path"
printf 'Archive SHA-256: %s\n' "$archive_sha256"
printf 'Source commit: %s\n' "$commit_id"
