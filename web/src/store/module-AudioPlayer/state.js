import { LocalStorage } from 'quasar'

export const SWAP_SEEK_BUTTON_KEY = 'swap_seek_button'
export const ENABLE_VISUALIZER_KEY = 'enable_visualizer'
export const ENABLE_PIP_LYRICS = 'enable_pip_lyrics'
export const ENABLE_VIDEO_SOURCE_KEY = 'enable_video_source'
export const OLD_WORK_CARD_UI_STYLE_KEY = 'old_work_card_ui_style_key'
export const OLD_SLEEP_TIMER_UI_STYLE_KEY = 'old_sleep_timer_ui_style_key'
export const ENABLE_SHOW_RECENT_KEY = 'enable_show_recent_key'
export const WORK_LIST_MODE_KEY = 'work_list_mode_key'
export const REWIND_SEEK_TIME_KEY = 'rewind_seek_time_key'
export const FORWARD_SEEK_TIME_KEY = 'forward_seek_time_key'
export const TRANSCODE_OPTION_KEY = 'transcode_option_key'
export const TRANSCODE_FROM_TYPES_KEY = 'transcode_from_types_key'
export const SMART_PATH_ENABLED_KEY = 'smart_path_enabled_key'
export const SMART_PATH_PREFER_EFFECT_KEY = 'smart_path_prefer_effect_key'
export const SMART_PATH_AUDIO_TYPES_KEY = 'smart_path_audio_types_key'
export const VOLUME_KEY = 'volume'

export const WORK_LIST_MODES = {
  WATERFALL: 'waterfall',
  PAGINATION: 'pagination',
}

export const TRANSCODE_OPTIONS = {
  OFF: 'off',
  AAC_128: 'aac 128',
  AAC_320: 'aac 320',
}

export const TRANSCODE_FILE_TYPES = ['wav', 'flac', 'avi', 'mp4']
export const SMART_PATH_AUDIO_TYPES = ['mp3', 'flac', 'wav', 'opus', 'm4a', 'aac']
export const DEFAULT_SMART_PATH_AUDIO_TYPES = SMART_PATH_AUDIO_TYPES.join(',')

export function normalizeSmartPathAudioTypes (value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const normalized = values
    .map(type => String(type).trim().toLowerCase())
    .filter(type => SMART_PATH_AUDIO_TYPES.includes(type))
    .filter((type, index, types) => types.indexOf(type) === index)
  return normalized.concat(SMART_PATH_AUDIO_TYPES.filter(type => !normalized.includes(type))).join(',')
}

function loadTranscodeOption () {
  const value = LocalStorage.has(TRANSCODE_OPTION_KEY)
    ? LocalStorage.getItem(TRANSCODE_OPTION_KEY)
    : TRANSCODE_OPTIONS.OFF
  return Object.values(TRANSCODE_OPTIONS).includes(value)
    ? value
    : TRANSCODE_OPTIONS.OFF
}

function loadTranscodeFromTypes () {
  const value = LocalStorage.has(TRANSCODE_FROM_TYPES_KEY)
    ? LocalStorage.getItem(TRANSCODE_FROM_TYPES_KEY)
    : 'flac,wav'
  if (typeof value !== 'string') return 'flac,wav'
  return value
    .split(',')
    .map(type => type.trim().toLowerCase())
    .filter(type => TRANSCODE_FILE_TYPES.includes(type))
    .filter((type, index, types) => types.indexOf(type) === index)
    .join(',')
}

function loadWorkListMode () {
  const value = LocalStorage.has(WORK_LIST_MODE_KEY)
    ? LocalStorage.getItem(WORK_LIST_MODE_KEY)
    : WORK_LIST_MODES.WATERFALL
  return Object.values(WORK_LIST_MODES).includes(value)
    ? value
    : WORK_LIST_MODES.WATERFALL
}

function loadSeekTime (key, fallback) {
  const value = LocalStorage.has(key) ? Number(LocalStorage.getItem(key)) : fallback
  return [5, 10, 30].includes(value) ? value : fallback
}

function loadVolume () {
  const value = LocalStorage.has(VOLUME_KEY) ? Number(LocalStorage.getItem(VOLUME_KEY)) : 1
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 1
}

export default function () {
  return {
    hide: false,
    playing: false, // 播放状态 (true/false)
    playingTranscode: false,
    currentTime: 0, // 单位: 秒
    newCurrentTime: -1, // 单位：秒，<0 的负数表示当前无需更改媒体的currentTime，>=0 表示需要更改媒体的currentTime
    duration: 0,
    source: "",
    queue: [
      // list of tracks. object format:
      /*
        hash: null, // unique identifier for the file
        title: null, // title to show in UI
        workTitle: null // workTitle to show in UI
       */
    ],
    queueIndex: 0, // which track in the queue is currently selected
    playMode: {
      id: 0,
      name: "order"
    }, // 顺序播放("order"), 循环播放("all repeat"), 单曲循环("repeat once") or 随机播放("shuffle")
    muted: false,
    volume: loadVolume(), // 音量 (0.0-1.0)
    hasLyric: false,
    currentLyric: '',
    currentLyricLineNumber: 0,
    lyricLines: [],
    lyricOffsetSeconds: 0,
    sleepTime: null,
    sleepMode: false,
    rewindSeekTime: loadSeekTime(REWIND_SEEK_TIME_KEY, 5),
    forwardSeekTime: loadSeekTime(FORWARD_SEEK_TIME_KEY, 30),
    rewindSeekMode: false,
    forwardSeekMode: false,
    swapSeekButton: LocalStorage.has(SWAP_SEEK_BUTTON_KEY) && LocalStorage.getItem(SWAP_SEEK_BUTTON_KEY), // 交换进度按钮与切换按钮
    enableVisualizer: LocalStorage.has(ENABLE_VISUALIZER_KEY) && LocalStorage.getItem(ENABLE_VISUALIZER_KEY), // 是否开启音频可视化
    enableVideoSource: LocalStorage.has(ENABLE_VIDEO_SOURCE_KEY) && LocalStorage.getItem(ENABLE_VIDEO_SOURCE_KEY), // 是否开启视频元素作为媒体源，用于在网页中播放视频格式的音频作品
    enableVideoSourcePIP: false, // 让videoSource进入画中画模式，每一次需要单独设置
    visualPlayerCoverUrl: '', // 可视化播放器的封面图
    playWorkId: 0, // 当前播放作品的id

    audioAnalyser: null, // 全局 audio 音频解析对象
    // audioAnalyzerData: null, // 解析音频信息，可视化展示

    // 是否启用画中画歌词（桌面歌词）
    // 注意android chrome不支持画中画，firefox估计也不支持，因此在android设备上禁用这一功能
    enablePIPLyrics: LocalStorage.has(ENABLE_PIP_LYRICS) && LocalStorage.getItem(ENABLE_PIP_LYRICS) && !(navigator.userAgent.toLowerCase().indexOf('android') > -1), 

    // 当从历史记录播放时，这里记录当前queue[queueIndex]应当恢复到的seconds时间，
    // -1表示无需恢复，其他大于等于0的数字需要在onCanplay时间触发并完成时间跳转之后，再次设置为-1
    resumeHistroySeconds: -1,

    // 是否切换回旧式的作品卡片，某些人需要直接展示所有tag，保留旧式UI的选项
    oldWorkCardUIStyle: LocalStorage.has(OLD_WORK_CARD_UI_STYLE_KEY) && LocalStorage.getItem(OLD_WORK_CARD_UI_STYLE_KEY),

    // false 使用分钟倒计时，true 使用指定停止时刻
    oldSleepTimerUIStyle: LocalStorage.has(OLD_SLEEP_TIMER_UI_STYLE_KEY) && LocalStorage.getItem(OLD_SLEEP_TIMER_UI_STYLE_KEY),
    enableShowRecent: !LocalStorage.has(ENABLE_SHOW_RECENT_KEY) || LocalStorage.getItem(ENABLE_SHOW_RECENT_KEY),
    workListMode: loadWorkListMode(),

    transcodeOption: loadTranscodeOption(),
    transcodeFromTypes: loadTranscodeFromTypes(),
    smartPathEnabled: !LocalStorage.has(SMART_PATH_ENABLED_KEY) || Boolean(LocalStorage.getItem(SMART_PATH_ENABLED_KEY)),
    smartPathPreferEffect: !LocalStorage.has(SMART_PATH_PREFER_EFFECT_KEY) || Boolean(LocalStorage.getItem(SMART_PATH_PREFER_EFFECT_KEY)),
    smartPathAudioTypes: normalizeSmartPathAudioTypes(LocalStorage.has(SMART_PATH_AUDIO_TYPES_KEY) ? LocalStorage.getItem(SMART_PATH_AUDIO_TYPES_KEY) : DEFAULT_SMART_PATH_AUDIO_TYPES),
  }
}
