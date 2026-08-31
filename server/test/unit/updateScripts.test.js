"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const updaterRoot = path.resolve(__dirname, "..", "..", "scripts");

function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
}

function sha256(filePath) {
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function makeRuntime() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-update-script-"));
    const app = path.join(root, "app");
    const data = path.join(root, "data");
    const updates = path.join(data, "updates");
    fs.mkdirSync(updates, { recursive: true });
    writeFile(path.join(data, "config", "config.json"), '{"library":"kept"}');
    return { app, data, root, updates };
}

function writeInstallMarker(updates, packagePath) {
    writeFile(path.join(updates, "install.json"), JSON.stringify({
        fromVersion: "0.7.5",
        targetVersion: "v0.7.6",
        packagePath,
        digest: sha256(packagePath),
    }));
}

test("Windows launcher passes a normalized app directory non-interactively", () => {
    const buildScript = fs.readFileSync(path.resolve(updaterRoot, "build-release.js"), "utf8");
    assert.ok(buildScript.includes('"set \\"KIKOERU_APP_DIR=%~dp0.\\""'));
    assert.equal(buildScript.split("powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass").length - 1, 2);
    assert.equal(buildScript.split('-AppDir \\"%KIKOERU_APP_DIR%\\"').length - 1, 2);
    assert.equal(buildScript.includes('-AppDir \\"%~dp0\\"'), false);
});

test("Windows updater installs and rolls back a portable package", { skip: process.platform !== "win32" }, () => {
    const runtime = makeRuntime();
    const sourceUpdater = path.join(updaterRoot, "update-kikoeru.ps1");
    const stage = path.join(runtime.root, "stage");
    const archive = path.join(runtime.updates, "v0.7.6", "kikoeru-win-x64-test.zip");
    const oldFiles = {
        "kikoeru-express.exe": "old-app",
        "ffmpeg.exe": "old-ffmpeg",
        "ffprobe.exe": "old-ffprobe",
    };
    const newFiles = {
        "kikoeru-express.exe": "new-app",
        "ffmpeg.exe": "new-ffmpeg",
        "ffprobe.exe": "new-ffprobe",
    };

    try {
        for (const [name, content] of Object.entries(oldFiles)) writeFile(path.join(runtime.app, name), content);
        fs.copyFileSync(sourceUpdater, path.join(runtime.app, "update-kikoeru.ps1"));
        for (const [name, content] of Object.entries(newFiles)) writeFile(path.join(stage, name), content);
        fs.copyFileSync(sourceUpdater, path.join(stage, "update-kikoeru.ps1"));
        fs.mkdirSync(path.dirname(archive), { recursive: true });
        execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
            "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:UPDATE_STAGE, $env:UPDATE_ARCHIVE)",
        ], { env: { ...process.env, UPDATE_STAGE: stage, UPDATE_ARCHIVE: archive } });
        writeInstallMarker(runtime.updates, archive);

        execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", sourceUpdater,
            "-Install", "-AppDir", runtime.app, "-DataDir", runtime.data]);
        assert.equal(fs.readFileSync(path.join(runtime.app, "kikoeru-express.exe"), "utf8"), "new-app");
        assert.equal(JSON.parse(fs.readFileSync(path.join(runtime.updates, "startup-pending.json"), "utf8")).stage, "ready");
        assert.equal(fs.readFileSync(path.join(runtime.data, "config", "config.json"), "utf8"), '{"library":"kept"}');

        const installedUpdater = path.join(runtime.app, "update-kikoeru.ps1");
        execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installedUpdater,
            "-HandlePending", "-AppDir", runtime.app, "-DataDir", runtime.data]);
        execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installedUpdater,
            "-HandlePending", "-AppDir", runtime.app, "-DataDir", runtime.data]);
        assert.equal(fs.readFileSync(path.join(runtime.app, "kikoeru-express.exe"), "utf8"), "old-app");
        assert.equal(JSON.parse(fs.readFileSync(path.join(runtime.updates, "last-result.json"), "utf8")).status, "rolled-back");
    }
    finally {
        fs.rmSync(runtime.root, { recursive: true, force: true });
    }
});

test("Linux updater installs and rolls back a portable package", { skip: process.platform !== "linux" }, () => {
    const runtime = makeRuntime();
    const sourceUpdater = path.join(updaterRoot, "update-kikoeru.sh");
    const stage = path.join(runtime.root, "stage");
    const archive = path.join(runtime.updates, "v0.7.6", "kikoeru-linux-x64-test.tar.gz");

    try {
        writeFile(path.join(runtime.app, "server", "version.txt"), "old-app");
        writeFile(path.join(runtime.app, "ffmpeg", "ffmpeg"), "old-ffmpeg");
        fs.mkdirSync(path.join(runtime.app, "node", "bin"), { recursive: true });
        fs.symlinkSync(process.execPath, path.join(runtime.app, "node", "bin", "node"));
        fs.copyFileSync(sourceUpdater, path.join(runtime.app, "update-kikoeru.sh"));

        writeFile(path.join(stage, "server", "src", "app.js"), "// new-app");
        writeFile(path.join(stage, "server", "version.txt"), "new-app");
        writeFile(path.join(stage, "ffmpeg", "ffmpeg"), "new-ffmpeg");
        fs.mkdirSync(path.join(stage, "node", "bin"), { recursive: true });
        fs.symlinkSync(process.execPath, path.join(stage, "node", "bin", "node"));
        fs.copyFileSync(sourceUpdater, path.join(stage, "update-kikoeru.sh"));
        fs.mkdirSync(path.dirname(archive), { recursive: true });
        execFileSync("tar", ["-czf", archive, "-C", stage, "."]);
        writeInstallMarker(runtime.updates, archive);

        execFileSync("sh", [sourceUpdater, "install", runtime.app, runtime.data]);
        assert.equal(fs.readFileSync(path.join(runtime.app, "server", "version.txt"), "utf8"), "new-app");
        assert.equal(JSON.parse(fs.readFileSync(path.join(runtime.updates, "startup-pending.json"), "utf8")).stage, "ready");
        assert.equal(fs.readFileSync(path.join(runtime.data, "config", "config.json"), "utf8"), '{"library":"kept"}');

        const installedUpdater = path.join(runtime.app, "update-kikoeru.sh");
        execFileSync("sh", [installedUpdater, "handle-pending", runtime.app, runtime.data]);
        execFileSync("sh", [installedUpdater, "handle-pending", runtime.app, runtime.data]);
        assert.equal(fs.readFileSync(path.join(runtime.app, "server", "version.txt"), "utf8"), "old-app");
        assert.equal(JSON.parse(fs.readFileSync(path.join(runtime.updates, "last-result.json"), "utf8")).status, "rolled-back");
    }
    finally {
        fs.rmSync(runtime.root, { recursive: true, force: true });
    }
});
