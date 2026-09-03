"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.genTranscodeTaskIdentifier = genTranscodeTaskIdentifier;
exports.genTranscodeOutputPath = genTranscodeOutputPath;
exports.genTranscodeTempOutputPath = genTranscodeTempOutputPath;
exports.convertAudioToM4a = convertAudioToM4a;
exports.deleteOldFiles = deleteOldFiles;
exports.calculateLUFS = calculateLUFS;
exports.calculateLUFSSplit = calculateLUFSSplit;
exports.getAudioPeaks = getAudioPeaks;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const utils_1 = require("./utils");
const lodash_1 = require("lodash");
const tempDir = os_1.default.tmpdir();
const processOutputTailLimit = 64 * 1024;
function createLineReader(onLine) {
    let buffered = '';
    return {
        write(chunk) {
            buffered += chunk;
            const lines = buffered.split(/\r?\n/);
            buffered = lines.pop() || '';
            lines.forEach(onLine);
        },
        end() {
            if (buffered) {
                onLine(buffered);
                buffered = '';
            }
        },
    };
}
function runMediaProcess(executable, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(executable, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const stdoutReader = createLineReader(options.onStdoutLine || lodash_1.noop);
        const stderrReader = createLineReader(options.onStderrLine || lodash_1.noop);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            if (options.collectStdout) {
                stdout += chunk;
            }
            stdoutReader.write(chunk);
        });
        child.stderr.on('data', (chunk) => {
            stderr = options.collectStderr
                ? stderr + chunk
                : (stderr + chunk).slice(-processOutputTailLimit);
            stderrReader.write(chunk);
        });
        child.stdout.on('end', () => stdoutReader.end());
        child.stderr.on('end', () => stderrReader.end());
        child.on('error', (error) => {
            settled = true;
            reject(new Error(`无法启动 ${executable}: ${error.message}`));
        });
        child.on('close', (code, signal) => {
            if (settled)
                return;
            settled = true;
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }
            const reason = signal ? `signal ${signal}` : `exit code ${code}`;
            const detail = stderr.trim();
            reject(new Error(`${executable} failed with ${reason}${detail ? `\n${detail}` : ''}`));
        });
    });
}
function runFfmpeg(args, options) {
    return runMediaProcess('ffmpeg', args, options);
}
function runFfprobe(args) {
    return runMediaProcess('ffprobe', args, { collectStdout: true });
}
function parseNumericProgressValue(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function createProgressReader(duration, onProgress) {
    const values = {};
    return (line) => {
        const separator = line.indexOf('=');
        if (separator < 0)
            return;
        const key = line.slice(0, separator);
        values[key] = line.slice(separator + 1);
        if (key !== 'progress')
            return;
        const outTimeUs = parseNumericProgressValue(values.out_time_us || values.out_time_ms);
        const percent = duration > 0
            ? Math.min(100, Math.max(0, outTimeUs / (duration * 1000000) * 100))
            : undefined;
        const progress = {
            frames: parseNumericProgressValue(values.frame),
            currentFps: parseNumericProgressValue(values.fps),
            currentKbps: parseNumericProgressValue(values.bitrate),
            targetSize: Math.round(parseNumericProgressValue(values.total_size) / 1024),
            timemark: values.out_time || '00:00:00.000000',
            percent,
        };
        console.log(` transcoding progress: ${JSON.stringify(progress)}`);
        if (onProgress) {
            onProgress(progress);
        }
    };
}
function genTranscodeTaskIdentifier(workId, hashIndex, targetBitRate) {
    return `${workId}_${hashIndex}_${targetBitRate}`;
}
function genTranscodeOutputPath(workId, hashIndex, targetBitRate, transcodeOutputDirectory) {
    const transcodeName = `${workId}_${hashIndex}_${targetBitRate}.m4a`;
    return path_1.default.join(transcodeOutputDirectory, transcodeName);
}
function genTranscodeTempOutputPath(transcodeTempOutputDirectory) {
    const transcodeTempName = (0, utils_1.genUniqueRandomName)() + '.m4a';
    return path_1.default.join(transcodeTempOutputDirectory, transcodeTempName);
}
async function convertAudioToM4a(inputFile, outputFile, bitRate = 128, onProgress = lodash_1.noop) {
    console.log(`transcode(bitRate:${bitRate}kb/s) start`);
    console.log(` input: `, inputFile);
    console.log(` temp output: `, outputFile);
    let duration = NaN;
    try {
        duration = await getAudioDuration(inputFile);
    }
    catch (_a) { }
    try {
        await runFfmpeg([
            '-i', inputFile,
            '-y',
            '-acodec', 'aac',
            '-b:a', `${bitRate}k`,
            '-vn',
            '-f', 'ipod',
            '-movflags', 'frag_keyframe+empty_moov',
            '-progress', 'pipe:1',
            '-nostats',
            outputFile,
        ], {
            onStdoutLine: createProgressReader(duration, onProgress),
        });
        console.log('transcode finished');
    }
    catch (err) {
        console.error(`转换失败: ${err.message}`);
        throw err;
    }
}
function getFilesWithAccessTime(folder) {
    const files = fs_1.default.readdirSync(folder);
    return files.map((file) => {
        const filePath = path_1.default.join(folder, file);
        const stats = fs_1.default.statSync(filePath);
        return {
            file: file,
            lastAccessTime: stats.atimeMs,
            isFile: stats.isFile(),
        };
    }).filter(item => item.isFile);
}
function deleteOldFiles(folder, maxFiles) {
    console.warn(`清理转码缓存, maxFiles = ${maxFiles}, folder = ${folder}`);
    const files = getFilesWithAccessTime(folder);
    files.sort((a, b) => a.lastAccessTime - b.lastAccessTime);
    const filesToDelete = Math.max(0, files.length - maxFiles);
    for (let i = 0; i < filesToDelete; i++) {
        const filePath = path_1.default.join(folder, files[i].file);
        try {
            fs_1.default.unlinkSync(filePath);
        }
        catch (err) {
            console.log(`Deleted file failed: ${files[i].file}`, err);
        }
        console.log(`Deleted file: ${files[i].file}`);
    }
}
async function getAudioDuration(inputPath) {
    const { stdout } = await runFfprobe([
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'json',
        inputPath,
    ]);
    const metadata = JSON.parse(stdout);
    const duration = Number.parseFloat(metadata.format && metadata.format.duration);
    if (!Number.isFinite(duration)) {
        throw new Error(`无法读取音频时长: ${inputPath}`);
    }
    return duration;
}
function generateTempDirPath() {
    let tempPath;
    do {
        tempPath = path_1.default.join(tempDir, `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    } while (fs_1.default.existsSync(tempPath));
    return tempPath;
}
function deleteDirRecursive(dirPath) {
    if (fs_1.default.existsSync(dirPath)) {
        const files = fs_1.default.readdirSync(dirPath);
        files.forEach(file => {
            const filePath = path_1.default.join(dirPath, file);
            if (fs_1.default.statSync(filePath).isDirectory()) {
                deleteDirRecursive(filePath);
            }
            else {
                fs_1.default.unlinkSync(filePath);
            }
        });
        fs_1.default.rmdirSync(dirPath);
    }
}
async function calculateLUFS(inputPath) {
    const { stderr } = await runFfmpeg([
        '-i', inputPath,
        '-y',
        '-filter:a', 'loudnorm=print_format=json',
        '-f', 'null',
        '-',
    ], {
        collectStderr: true,
        onStderrLine: (line) => console.log(line),
    });
    try {
        const jsonStart = stderr.indexOf('{');
        const jsonEnd = stderr.lastIndexOf('}') + 1;
        const jsonString = stderr.slice(jsonStart, jsonEnd);
        return JSON.parse(jsonString);
    }
    catch (e) {
        throw new Error(`解析失败: ${e.message}\n原始输出: ${stderr}`);
    }
}
async function calculateLUFSSplit(inputPath) {
    const tempDir = generateTempDirPath();
    fs_1.default.mkdirSync(tempDir);
    try {
        const duration = await getAudioDuration(inputPath);
        const one_hour_audio_duration = 60 * 60;
        const half_hour_audio_duration = 30 * 60;
        const splitInterval = duration < half_hour_audio_duration
            ? 30
            : (duration < one_hour_audio_duration
                ? 60
                : 120);
        const splitCountThreshold = 4;
        const middlePickInterval = 10;
        const intervalCount = Math.ceil(duration / splitInterval);
        if (intervalCount < splitCountThreshold) {
            return calculateLUFS(inputPath);
        }
        else {
            const tempFiles = [];
            for (let i = 0; i < intervalCount; i++) {
                const startSeconds = i * splitInterval;
                const startSecond = startSeconds + (splitInterval - middlePickInterval) / 2;
                const endSecond = startSeconds + (splitInterval + middlePickInterval) / 2;
                const actualStart = Math.min(startSecond, duration - 10);
                const actualEnd = Math.min(endSecond, duration);
                console.log(`split segments ${i}: ${actualStart.toFixed(2)} - ${actualEnd.toFixed(2)}`);
                if (actualEnd > actualStart) {
                    const tempFile = path_1.default.join(tempDir, `segment_${i}.wav`);
                    tempFiles.push(tempFile);
                    await runFfmpeg([
                        '-ss', actualStart.toString(),
                        '-t', (actualEnd - actualStart).toString(),
                        '-i', inputPath,
                        '-y', tempFile,
                    ]);
                }
            }
            if (tempFiles.length === 0) {
                return calculateLUFS(inputPath);
            }
            const fileListPath = path_1.default.join(tempDir, 'filelist.txt');
            const fileListContent = tempFiles.map(file => `file '${file}'`).join('\n');
            fs_1.default.writeFileSync(fileListPath, fileListContent);
            const concatenatedFile = path_1.default.join(tempDir, 'concatenated.wav');
            await runFfmpeg([
                '-f', 'concat',
                '-safe', '0',
                '-i', fileListPath,
                '-y', concatenatedFile,
            ]);
            const result = await calculateLUFS(concatenatedFile);
            return result;
        }
    }
    catch (error) {
        console.error('获取音频时长失败，使用原始计算方法:', error);
        return calculateLUFS(inputPath);
    }
    finally {
        try {
            deleteDirRecursive(tempDir);
        }
        catch (cleanupError) {
            console.error('清理临时文件失败:', cleanupError);
        }
    }
}
function uniformSample(arr, m) {
    if (m >= arr.length)
        return [...arr];
    const step = (arr.length - 1) / (m - 1);
    return Array.from({ length: m }, (_, i) => {
        const index = Math.round(i * step);
        return arr[index];
    });
}
async function getAudioPeaks(inputPath, frameInterval = 20) {
    const ptsTimeRegex = /frame:\d+\s*pts:\d+\s*pts_time:([\d.]+)/;
    const peakLeveRegex = /lavfi.astats.Overall.Peak_level=([-\d.inf]+)/;
    const datas = [];
    const filter = `astats=metadata=1:reset=1[astats];[astats]aselect=expr='not(mod(n,${frameInterval}))'[aselect];[aselect]ametadata=mode=print:key=lavfi.astats.Overall.Peak_level`;
    await runFfmpeg([
        '-i', inputPath,
        '-y',
        '-filter_complex', filter,
        '-f', 'null',
        '-',
    ], {
        onStderrLine: (line) => {
            if (!line.includes("Parsed_ametadata")) {
                return;
            }
            let match;
            if ((match = ptsTimeRegex.exec(line)) !== null) {
                datas.push({
                    ptsTime: parseFloat(match[1]),
                    peakLevel: null,
                });
            }
            if ((match = peakLeveRegex.exec(line)) !== null && datas.length > 0) {
                const last = datas[datas.length - 1];
                const level = parseFloat(match[1]);
                if (isFinite(level)) {
                    last.peakLevel = level;
                }
                else {
                    datas.pop();
                }
            }
        },
    });
    if (datas.length <= 0) {
        throw new Error('解析电平水平失败');
    }
    let retDatas = datas.filter(e => (isFinite(e.ptsTime) && isFinite(e.peakLevel)));
    const maxSamples = 200;
    if (retDatas.length > maxSamples) {
        retDatas = uniformSample(retDatas, maxSamples);
    }
    return retDatas;
}
