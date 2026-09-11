"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { writeReleaseFiles } = require("../../scripts/build-release");

test("Windows launcher preserves and records ordinary and native failure exit codes", { skip: process.platform !== "win32" }, t => {
    const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-launcher-"));
    try {
        const licensePath = path.join(runtime, "ffmpeg-license.txt");
        fs.writeFileSync(licensePath, "Fixture license");
        const readFileSync = fs.readFileSync;
        const licenseMock = t.mock.method(fs, "readFileSync", (file, ...args) =>
            file === path.resolve(__dirname, "../../LICENSE")
                ? "Fixture project license" : readFileSync(file, ...args));
        writeReleaseFiles(runtime, { licensePath });
        licenseMock.mock.restore();
        const launcherPath = path.join(runtime, "start-kikoeru.cmd");
        const source = fs.readFileSync(launcherPath, "utf8");
        assert.ok(source.includes('"%~dp0kikoeru-express.exe"'));
        fs.writeFileSync(launcherPath, source.replace('"%~dp0kikoeru-express.exe"',
            '"%ComSpec%" /d /c exit /b %KIKOERU_TEST_EXIT_CODE%'));

        for (const code of [0, 1, -1073741819]) {
            const dataDir = path.join(runtime, `data ${code} (test)`);
            const result = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/c", "start-kikoeru.cmd"], {
                cwd: runtime,
                env: { ...process.env, KIKOERU_DATA_DIR: dataDir, KIKOERU_TEST_EXIT_CODE: String(code) },
                encoding: "utf8",
                input: "",
                timeout: 10000,
            });
            assert.ifError(result.error);
            assert.equal(result.status >>> 0, code >>> 0, result.stdout + result.stderr);
            const logPath = path.join(dataDir, "process-exits.log");
            if (code === 0) {
                assert.equal(fs.existsSync(logPath), false);
            }
            else {
                assert.ok(result.stdout.includes(`Kikoeru exited with code ${code}.`));
                assert.ok(fs.readFileSync(logPath, "utf8").includes(`Exit code: ${code}`));
            }
        }
    }
    finally {
        fs.rmSync(runtime, { recursive: true, force: true });
    }
});
