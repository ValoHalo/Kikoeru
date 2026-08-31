"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const pkgFetch = require("@yao-pkg/pkg-fetch");

const serverRoot = path.resolve(__dirname, "..");
const runtimeRoot = process.env.KIKOERU_BUILD_ROOT
    ? path.resolve(process.env.KIKOERU_BUILD_ROOT)
    : path.join(serverRoot, ".runtime");
const releaseRoot = path.join(runtimeRoot, "release");
const packageJson = require(path.join(serverRoot, "package.json"));
const releaseConfig = require(path.join(__dirname, "release-config.json"));

const targetNodeRange = "node22";
const requiredPkgNativeAssets = Object.freeze([
    "node_modules/sqlite3/build/Release/node_sqlite3.node",
    "node_modules/better-sqlite3/build/Release/better_sqlite3.node",
    "node_modules/@parcel/watcher-win32-x64/watcher.node",
    "node_modules/@parcel/watcher-win32-x64/package.json",
]);

function parseArguments(argv) {
    let ffmpegArchive = "";
    let commitId = "";
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === "--ffmpeg-archive") {
            ffmpegArchive = argv[++index] || "";
        }
        else if (argv[index] === "--commit-id") {
            commitId = argv[++index] || "";
        }
        else {
            throw new Error(`Unknown argument: ${argv[index]}`);
        }
    }
    if (!ffmpegArchive) {
        throw new Error("Missing --ffmpeg-archive. Run build-windows-release.ps1 instead.");
    }
    if (!/^[0-9a-f]{6}$/.test(commitId)) {
        throw new Error("Missing or invalid --commit-id. Run build-windows-release.ps1 instead.");
    }
    return { commitId, ffmpegArchive: path.resolve(ffmpegArchive) };
}

function isPathInside(basePath, targetPath) {
    const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
    return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function resetDirectory(directoryPath) {
    assert.ok(isPathInside(runtimeRoot, directoryPath), `Refusing to reset path outside runtime: ${directoryPath}`);
    fs.rmSync(directoryPath, { recursive: true, force: true });
    fs.mkdirSync(directoryPath, { recursive: true });
}

function sha256(filePath) {
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function runNodeScript(scriptPath, args, options = {}) {
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: options.cwd || serverRoot,
        env: options.env || process.env,
        stdio: "inherit",
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${path.basename(scriptPath)} failed with exit code ${result.status}`);
    }
}

function validatePkgNativeAssets() {
    const nativeAssets = (packageJson.pkg?.assets || []).filter(asset => asset.startsWith("node_modules/"));
    assert.deepStrictEqual(nativeAssets, requiredPkgNativeAssets, "Unexpected pkg native asset list");
    for (const relativePath of requiredPkgNativeAssets) {
        assert.ok(
            fs.statSync(path.join(serverRoot, ...relativePath.split("/"))).isFile(),
            `Missing pkg native runtime file: ${relativePath}`,
        );
    }
}

function extractFfmpegArchive(archivePath) {
    assert.ok(fs.statSync(archivePath).isFile(), `Missing FFmpeg archive: ${archivePath}`);
    assert.strictEqual(
        sha256(archivePath),
        releaseConfig.ffmpeg.archiveSha256,
        "FFmpeg archive SHA-256 does not match server/scripts/release-config.json",
    );

    const extractionPath = path.join(runtimeRoot, "ffmpeg", releaseConfig.ffmpeg.archiveSha256);
    resetDirectory(extractionPath);
    const command = [
        "Add-Type -AssemblyName System.IO.Compression.FileSystem",
        "$archive = [System.IO.Compression.ZipFile]::OpenRead($env:KIKOERU_FFMPEG_ARCHIVE)",
        "try {",
        "  foreach ($relativePath in @('bin/ffmpeg.exe', 'bin/ffprobe.exe', 'LICENSE.txt')) {",
        "    $entryName = $env:KIKOERU_FFMPEG_ARCHIVE_ROOT + '/' + $relativePath",
        "    $entry = $archive.GetEntry($entryName)",
        "    if ($null -eq $entry) { throw \"Missing required FFmpeg archive entry: $entryName\" }",
        "    $destination = Join-Path $env:KIKOERU_FFMPEG_EXTRACT_ROOT ($relativePath -replace '/', [System.IO.Path]::DirectorySeparatorChar)",
        "    [System.IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null",
        "    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)",
        "  }",
        "}",
        "finally { $archive.Dispose() }",
    ].join("\n");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
        cwd: serverRoot,
        env: {
            ...process.env,
            KIKOERU_FFMPEG_ARCHIVE: archivePath,
            KIKOERU_FFMPEG_ARCHIVE_ROOT: releaseConfig.ffmpeg.archiveRoot,
            KIKOERU_FFMPEG_EXTRACT_ROOT: extractionPath,
        },
        stdio: "inherit",
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`FFmpeg extraction failed with exit code ${result.status}`);
    }
    return {
        ffmpegPath: path.join(extractionPath, "bin", "ffmpeg.exe"),
        ffprobePath: path.join(extractionPath, "bin", "ffprobe.exe"),
        licensePath: path.join(extractionPath, "LICENSE.txt"),
    };
}

function listFiles(rootPath) {
    const results = [];
    function visit(directoryPath) {
        for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
            const fullPath = path.join(directoryPath, entry.name);
            if (entry.isDirectory()) {
                visit(fullPath);
            }
            else if (entry.isFile()) {
                results.push(path.relative(rootPath, fullPath).split(path.sep).join("/"));
            }
        }
    }
    visit(rootPath);
    return results.sort();
}

function assertFrontendIsDeployed() {
    const deployedFrontend = path.join(serverRoot, "src", "public");
    assert.ok(fs.statSync(deployedFrontend).isDirectory(), `Missing deployed frontend: ${deployedFrontend}`);
    assert.ok(fs.statSync(path.join(deployedFrontend, "index.html")).isFile(), "Missing frontend index.html");
    assert.ok(listFiles(deployedFrontend).length > 1, "The deployed frontend is empty");
}

function prepareBetterSqlite3Prebuild() {
    const nodeVersion = pkgFetch.getNodeVersion(targetNodeRange);
    const releaseDirectory = path.join(serverRoot, "node_modules", "better-sqlite3", "build", "Release");
    const nativeFile = path.join(releaseDirectory, "better_sqlite3.node");
    const targetFile = `${nativeFile}.win.x64.${nodeVersion}`;
    const cachedTargetFile = path.join(runtimeRoot, "native-cache", `better_sqlite3-${nodeVersion}-win-x64.node`);
    if (fs.existsSync(targetFile)) {
        return;
    }
    if (fs.existsSync(cachedTargetFile)) {
        fs.copyFileSync(cachedTargetFile, targetFile);
        return;
    }

    const prebuildInstall = path.join(serverRoot, "node_modules", "prebuild-install", "bin.js");
    const hostBackup = path.join(runtimeRoot, `better_sqlite3.host-${process.pid}.node`);
    assert.ok(fs.statSync(nativeFile).isFile(), `Missing better-sqlite3 native module: ${nativeFile}`);
    fs.mkdirSync(runtimeRoot, { recursive: true });
    fs.copyFileSync(nativeFile, hostBackup);
    try {
        runNodeScript(prebuildInstall, ["--platform", "win32", "--arch", "x64", "--target", nodeVersion], {
            cwd: path.join(serverRoot, "node_modules", "better-sqlite3"),
            env: {
                ...process.env,
                npm_config_cache: path.join(runtimeRoot, "cache", "server-npm"),
                npm_config_update_notifier: "false",
            },
        });
        fs.copyFileSync(nativeFile, targetFile);
        fs.mkdirSync(path.dirname(cachedTargetFile), { recursive: true });
        fs.copyFileSync(nativeFile, cachedTargetFile);
    }
    finally {
        fs.copyFileSync(hostBackup, nativeFile);
        fs.rmSync(hostBackup, { force: true });
    }
}

function buildExecutable(executablePath) {
    const pkgEntrypoint = path.join(serverRoot, "node_modules", "@yao-pkg", "pkg", "lib-es5", "bin.js");
    const pkgCachePath = path.join(runtimeRoot, "pkg-cache");
    fs.mkdirSync(pkgCachePath, { recursive: true });
    const environment = { ...process.env, PKG_CACHE_PATH: pkgCachePath };
    delete environment.PKG_NODE_PATH;
    delete environment.PKG_IGNORE_TAG;
    runNodeScript(pkgEntrypoint, ["--targets", `${targetNodeRange}-win-x64`, "--output", executablePath, "."], {
        env: environment,
    });
    assert.ok(fs.statSync(executablePath).isFile(), `pkg did not create ${executablePath}`);
}

function copyRequiredFile(sourcePath, destinationPath) {
    assert.ok(fs.statSync(sourcePath).isFile(), `Missing release input: ${sourcePath}`);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
}

function writeReleaseFiles(stagePath, ffmpegInput) {
    const launcher = [
        "@echo off",
        "setlocal",
        "cd /d \"%~dp0\"",
        "set \"KIKOERU_APP_DIR=%~dp0.\"",
        "if not defined PORT set \"PORT=8888\"",
        "set \"NODE_ENV=production\"",
        "set \"KNEX_ENV=\"",
        "if not defined KIKOERU_DATA_DIR set \"KIKOERU_DATA_DIR=%~dp0data\"",
        "set \"PKG_NATIVE_CACHE_PATH=%KIKOERU_DATA_DIR%\\native-cache\"",
        "set \"KIKOERU_INSTALL_KIND=windows-portable\"",
        "set \"KIKOERU_UPDATE_SUPERVISOR=1\"",
        "set \"KIKOERU_UPDATE_RUNNER=%KIKOERU_DATA_DIR%\\updates\\update-runner.ps1\"",
        ":run",
        "if not exist \"%KIKOERU_DATA_DIR%\\updates\" mkdir \"%KIKOERU_DATA_DIR%\\updates\"",
        "if exist \"%KIKOERU_DATA_DIR%\\updates\\install.json\" (",
        "  copy /y \"%~dp0update-kikoeru.ps1\" \"%KIKOERU_UPDATE_RUNNER%\" >nul",
        "  powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"%KIKOERU_UPDATE_RUNNER%\" -Install -AppDir \"%KIKOERU_APP_DIR%\" -DataDir \"%KIKOERU_DATA_DIR%\"",
        "  if errorlevel 1 goto update_failed",
        ")",
        "if exist \"%KIKOERU_DATA_DIR%\\updates\\startup-pending.json\" (",
        "  copy /y \"%~dp0update-kikoeru.ps1\" \"%KIKOERU_UPDATE_RUNNER%\" >nul",
        "  powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"%KIKOERU_UPDATE_RUNNER%\" -HandlePending -AppDir \"%KIKOERU_APP_DIR%\" -DataDir \"%KIKOERU_DATA_DIR%\"",
        "  if errorlevel 1 goto update_failed",
        ")",
        "set \"PATH=%~dp0;%PATH%\"",
        "\"%~dp0kikoeru-express.exe\"",
        "set \"KIKOERU_EXIT_CODE=%ERRORLEVEL%\"",
        "if \"%KIKOERU_EXIT_CODE%\"==\"42\" goto run",
        "if exist \"%KIKOERU_DATA_DIR%\\updates\\startup-pending.json\" goto run",
        "if not \"%KIKOERU_EXIT_CODE%\"==\"0\" pause",
        "exit /b %KIKOERU_EXIT_CODE%",
        ":update_failed",
        "echo Kikoeru update failed. The previous version was kept when possible.",
        "pause",
        "exit /b 1",
        "",
    ].join("\r\n");
    fs.writeFileSync(path.join(stagePath, "start-kikoeru.cmd"), launcher, "utf8");

    const readme = [
        "Kikoeru - Windows x64 portable",
        "",
        "Run start-kikoeru.cmd, then open http://127.0.0.1:8888/ on this computer.",
        "For remote access, open http://<server-ip>:8888/ from another device.",
        "The default username and password are both admin. Change the password after your first login.",
        "Configuration, databases, covers and transcodes are stored in the data directory.",
        "Set PORT before starting the launcher to use another port.",
        "",
    ].join("\r\n");
    fs.writeFileSync(path.join(stagePath, "README.txt"), readme, "utf8");
    copyRequiredFile(path.join(serverRoot, "scripts", "update-kikoeru.ps1"), path.join(stagePath, "update-kikoeru.ps1"));

    const projectLicense = fs.readFileSync(path.join(serverRoot, "LICENSE"), "utf8").trimEnd();
    const ffmpegLicense = fs.readFileSync(ffmpegInput.licensePath, "utf8").trimEnd();
    const combinedLicense = [
        "Kikoeru",
        "=======",
        "",
        projectLicense,
        "",
        "FFmpeg",
        "======",
        "",
        ffmpegLicense,
        "",
    ].join("\n");
    fs.writeFileSync(path.join(stagePath, "LICENSE"), combinedLicense, "utf8");
}

function createZip(stagePath, zipPath) {
    assert.ok(isPathInside(runtimeRoot, zipPath), `Refusing to overwrite ZIP outside runtime: ${zipPath}`);
    fs.rmSync(zipPath, { force: true });
    const command = [
        "Add-Type -AssemblyName System.IO.Compression.FileSystem",
        "[System.IO.Compression.ZipFile]::CreateFromDirectory($env:KIKOERU_RELEASE_STAGE, $env:KIKOERU_RELEASE_ZIP, [System.IO.Compression.CompressionLevel]::Optimal, $false)",
    ].join("; ");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
        cwd: serverRoot,
        env: {
            ...process.env,
            KIKOERU_RELEASE_STAGE: stagePath,
            KIKOERU_RELEASE_ZIP: zipPath,
        },
        stdio: "inherit",
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`ZIP creation failed with exit code ${result.status}`);
    }
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    const ffmpegInput = extractFfmpegArchive(options.ffmpegArchive);
    assertFrontendIsDeployed();
    validatePkgNativeAssets();
    prepareBetterSqlite3Prebuild();

    resetDirectory(releaseRoot);
    const stageName = `kikoeru-win-x64-${options.commitId}`;
    const stagePath = path.join(releaseRoot, stageName);
    const zipPath = path.join(releaseRoot, `${stageName}.zip`);
    resetDirectory(stagePath);
    const executablePath = path.join(stagePath, "kikoeru-express.exe");
    buildExecutable(executablePath);
    copyRequiredFile(ffmpegInput.ffmpegPath, path.join(stagePath, "ffmpeg.exe"));
    copyRequiredFile(ffmpegInput.ffprobePath, path.join(stagePath, "ffprobe.exe"));
    writeReleaseFiles(stagePath, ffmpegInput);
    createZip(stagePath, zipPath);

    console.log(JSON.stringify({
        zipPath,
        zipBytes: fs.statSync(zipPath).size,
        zipSha256: sha256(zipPath),
    }, null, 2));
}

if (require.main === module) {
    main();
}

module.exports = { parseArguments, requiredPkgNativeAssets };
