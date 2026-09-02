"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.configFolderDir = void 0;
exports.setNewConfigValue = setNewConfigValue;
exports.migrateConfigVersion = migrateConfigVersion;
exports.getSharedConfig = getSharedConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const lodash_1 = require("lodash");
const isUsePkg = Boolean(process.pkg);
const isFreezeConfigFile = Boolean(process.env.FREEZE_CONFIG_FILE);
const nodeEnv = process.env.NODE_ENV || (isUsePkg ? 'production' : 'development');
if (!['production', 'development', 'test'].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnv}`);
}
exports.configFolderDir = path_1.default.join(genDefaultDataPath(), 'config');
const configPath = path_1.default.join(exports.configFolderDir, 'config.json');
const package_json_1 = __importDefault(require("../package.json"));
function genDefaultDataPath() {
    if (process.env.KIKOERU_DATA_DIR) {
        return path_1.default.resolve(process.env.KIKOERU_DATA_DIR);
    }
    return isUsePkg ? path_1.default.join(process.execPath, '..') : path_1.default.join(__dirname, '..');
}
function voiceWorkDefaultPath() {
    if (process.env.KIKOERU_VOICEWORK_PATH) {
        return path_1.default.resolve(process.env.KIKOERU_VOICEWORK_PATH);
    }
    return path_1.default.join(genDefaultDataPath(), 'VoiceWork');
}
const defaultConfig = {
    version: package_json_1.default.version,
    sqliteType: "sqlite3",
    production: nodeEnv === 'production' ? true : false,
    dbBusyTimeout: 1000,
    checkUpdate: true,
    checkBetaUpdate: false,
    autoDownloadUpdate: false,
    setupVersion: 0,
    maxParallelism: 16,
    rootFolders: [],
    excludeFolderGlobs: [
        "**/@eaDir/**",
    ],
    coverFolderDir: './covers',
    databaseFolderDir: './sqlite',
    lyricFolderDir: './sqlite/lyrics',
    transcodeFolderDir: "./sqlite/transcode",
    transcodeTempFolderDir: "./sqlite/transcode/temp",
    persistentLUFSCachePath: "./sqlite/LUFSCache.json",
    coverUseDefaultPath: false,
    dbUseDefaultPath: true,
    voiceWorkDefaultPath: voiceWorkDefaultPath(),
    auth: nodeEnv === 'production' ? true : false,
    allowUnauthenticatedWriteOperations: false,
    md5secret: crypto_1.default.randomBytes(32).toString('hex'),
    jwtsecret: crypto_1.default.randomBytes(32).toString('hex'),
    expiresIn: 2592000,
    scannerMaxRecursionDepth: 2,
    enableFileWatcher: false,
    pageSize: 12,
    tagLanguage: 'zh-cn',
    retry: 5,
    dlsiteTimeout: 10000,
    hvdbTimeout: 10000,
    retryDelay: 2000,
    httpProxyMode: 'direct',
    httpProxyHost: '',
    httpProxyPort: 0,
    listenPort: 8888,
    blockRemoteConnection: false,
    behindProxy: false,
    httpsEnabled: false,
    httpsPrivateKey: 'kikoeru.key',
    httpsCert: 'kikoeru.crt',
    httpsPort: 8443,
    skipCleanup: false,
    allowEmptyRootCleanup: false,
    allowLargeCleanup: false,
    cleanupMaxMissingRatio: 0.25,
    enableGzip: true,
    rewindSeekTime: 5,
    forwardSeekTime: 30,
    defaultSubtitleLanguage: 'auto',
    colorScheme: 'system',
    accentColor: '#1976D2',
    workListMode: 'waterfall',
    enableShowRecent: true,
    oldWorkCardUIStyle: false,
    oldSleepTimerUIStyle: false,
    swapSeekButton: false,
    transcodeOption: 'off',
    transcodeFromTypes: 'flac,wav',
    enableVisualizer: false,
    enableVideoSource: false,
    offloadMedia: false,
    offloadStreamPath: '/media/stream/',
    offloadDownloadPath: '/media/download/',
    enableIPV6: false,
    smartPathEnabled: true,
    smartPathPreferEffect: true,
    smartPathAudioTypes: 'mp3,flac,wav,opus,m4a,aac',
    transcodeKeepCount: 200,
    kikoeruMetaServerUrl: "https://meta.number17.online",
    metaCryptoKey: "",
};
exports.config = readOrMakeConfig();
function readOrMakeConfig() {
    console.log(`readOrMakeConfig called, configPath: ${configPath}, configFolderDir: ${exports.configFolderDir}`);
    if (!fs_1.default.existsSync(configPath)) {
        if (!fs_1.default.existsSync(exports.configFolderDir)) {
            try {
                fs_1.default.mkdirSync(exports.configFolderDir, { recursive: true });
            }
            catch (err) {
                console.error(` ! 在创建存放配置文件的文件夹时出错: ${err.message}`);
            }
        }
        return makeInitialConfig();
    }
    else {
        return readConfig();
    }
}
function makeInitialConfig() {
    const makeConfig = fixSomeConfigParameter(defaultConfig);
    writeConfig(makeConfig);
    return makeConfig;
}
function readConfig() {
    const localConfig = JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
    return fixSomeConfigParameter(localConfig);
}
;
function writeConfig(config) {
    if (isFreezeConfigFile) {
        console.log("config is freezed, cannot write into it now");
        return;
    }
    fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, "\t"));
}
function setNewConfigValue(newConfigValues) {
    delete newConfigValues.production;
    delete newConfigValues.md5secret;
    delete newConfigValues.jwtsecret;
    if (nodeEnv === 'production' || exports.config.production) {
        delete newConfigValues.auth;
    }
    Object.assign(exports.config, newConfigValues);
    writeConfig(exports.config);
}
function fixSomeConfigParameter(inputConfig) {
    const inputClone = (0, lodash_1.cloneDeep)(inputConfig);
    if (!['direct', 'environment', 'manual'].includes(inputClone.httpProxyMode)) {
        inputClone.httpProxyMode = Number(inputClone.httpProxyPort) > 0 ? 'manual' : 'direct';
    }
    const outputConfig = Object.assign({}, (0, lodash_1.cloneDeep)(defaultConfig), inputClone);
    delete outputConfig.importantWorkTreeOption;
    if (!path_1.default.isAbsolute(outputConfig.coverFolderDir)) {
        outputConfig.coverFolderDir = path_1.default.join(genDefaultDataPath(), outputConfig.coverFolderDir);
        console.log(' coverFolderDir is changed to absolute: ', outputConfig.coverFolderDir);
    }
    console.log("input databaseFolderDir: ", outputConfig.databaseFolderDir);
    if (!path_1.default.isAbsolute(outputConfig.databaseFolderDir)) {
        console.log(' databaseFolderDir is not absolute');
        outputConfig.databaseFolderDir = path_1.default.join(genDefaultDataPath(), outputConfig.databaseFolderDir);
        console.log(' databaseFolderDir is changed to absolute: ', outputConfig.databaseFolderDir);
    }
    if (outputConfig.coverUseDefaultPath) {
        outputConfig.coverFolderDir = path_1.default.join(genDefaultDataPath(), 'covers');
        console.log(' coverFolderDir is changed to default: ', outputConfig.coverFolderDir);
    }
    console.log(' dbUseDefaultPath: ', outputConfig.dbUseDefaultPath);
    if (outputConfig.dbUseDefaultPath) {
        outputConfig.databaseFolderDir = path_1.default.join(genDefaultDataPath(), 'sqlite');
        console.log(' databaseFolderDir is changed to default: ', outputConfig.databaseFolderDir);
    }
    outputConfig.lyricFolderDir = path_1.default.join(outputConfig.databaseFolderDir, "lyrics");
    outputConfig.transcodeFolderDir = path_1.default.join(outputConfig.databaseFolderDir, "transcode");
    outputConfig.transcodeTempFolderDir = path_1.default.join(outputConfig.databaseFolderDir, "transcode", "temp");
    outputConfig.persistentLUFSCachePath = path_1.default.join(outputConfig.databaseFolderDir, "LUFSCache.json");
    console.log('Config: databaseFolderDir =', outputConfig.databaseFolderDir);
    console.log('Config: coverFolderDir =', outputConfig.coverFolderDir);
    if (nodeEnv === 'production' || outputConfig.production) {
        outputConfig.auth = true;
        outputConfig.production = true;
    }
    return outputConfig;
}
function migrateConfigVersion() {
    if (exports.config.version === package_json_1.default.version)
        return;
    setNewConfigValue({ version: package_json_1.default.version });
}
function getSharedConfig() {
    return {
        colorScheme: exports.config.colorScheme,
        accentColor: exports.config.accentColor,
        workListMode: exports.config.workListMode,
        enableShowRecent: exports.config.enableShowRecent,
        oldWorkCardUIStyle: exports.config.oldWorkCardUIStyle,
        rewindSeekTime: exports.config.rewindSeekTime,
        forwardSeekTime: exports.config.forwardSeekTime,
        defaultSubtitleLanguage: exports.config.defaultSubtitleLanguage,
        oldSleepTimerUIStyle: exports.config.oldSleepTimerUIStyle,
        swapSeekButton: exports.config.swapSeekButton,
        transcodeOption: exports.config.transcodeOption,
        transcodeFromTypes: exports.config.transcodeFromTypes,
        enableVisualizer: exports.config.enableVisualizer,
        enableVideoSource: exports.config.enableVideoSource,
        smartPathEnabled: exports.config.smartPathEnabled,
        smartPathPreferEffect: exports.config.smartPathPreferEffect,
        smartPathAudioTypes: exports.config.smartPathAudioTypes,
    };
}
