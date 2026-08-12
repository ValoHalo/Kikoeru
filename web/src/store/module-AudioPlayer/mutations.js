import { LocalStorage } from 'quasar'
import getters from './getters'
import state, {
  SWAP_SEEK_BUTTON_KEY,
  ENABLE_VISUALIZER_KEY,
  ENABLE_PIP_LYRICS,
  ENABLE_VIDEO_SOURCE_KEY,
  OLD_WORK_CARD_UI_STYLE_KEY,
  OLD_SLEEP_TIMER_UI_STYLE_KEY,
  ENABLE_SHOW_RECENT_KEY,
  WORK_LIST_MODE_KEY,
  REWIND_SEEK_TIME_KEY,
  FORWARD_SEEK_TIME_KEY,
  TRANSCODE_OPTION_KEY,
  TRANSCODE_FROM_TYPES_KEY,
  SMART_PATH_ENABLED_KEY,
  SMART_PATH_PREFER_EFFECT_KEY,
  SMART_PATH_AUDIO_TYPES_KEY,
  VOLUME_KEY,
  TRANSCODE_OPTIONS,
  TRANSCODE_FILE_TYPES,
  WORK_LIST_MODES,
  normalizeSmartPathAudioTypes,
} from './state'

const mutations = {
  APPLY_DEFAULT_PREFERENCES: (state, defaults) => {
    const assignWhenUnset = (key, stateKey, normalize) => {
      if (!LocalStorage.has(key) && Object.prototype.hasOwnProperty.call(defaults, stateKey)) {
        state[stateKey] = normalize(defaults[stateKey])
      }
    }
    const booleanValue = value => Boolean(value)

    assignWhenUnset(REWIND_SEEK_TIME_KEY, 'rewindSeekTime', value => [5, 10, 30].includes(Number(value)) ? Number(value) : 5)
    assignWhenUnset(FORWARD_SEEK_TIME_KEY, 'forwardSeekTime', value => [5, 10, 30].includes(Number(value)) ? Number(value) : 30)
    assignWhenUnset(SWAP_SEEK_BUTTON_KEY, 'swapSeekButton', booleanValue)
    assignWhenUnset(ENABLE_VISUALIZER_KEY, 'enableVisualizer', booleanValue)
    assignWhenUnset(ENABLE_VIDEO_SOURCE_KEY, 'enableVideoSource', booleanValue)
    assignWhenUnset(OLD_WORK_CARD_UI_STYLE_KEY, 'oldWorkCardUIStyle', booleanValue)
    assignWhenUnset(OLD_SLEEP_TIMER_UI_STYLE_KEY, 'oldSleepTimerUIStyle', booleanValue)
    assignWhenUnset(ENABLE_SHOW_RECENT_KEY, 'enableShowRecent', booleanValue)
    assignWhenUnset(WORK_LIST_MODE_KEY, 'workListMode', value => Object.values(WORK_LIST_MODES).includes(value) ? value : WORK_LIST_MODES.WATERFALL)
    assignWhenUnset(TRANSCODE_OPTION_KEY, 'transcodeOption', value => Object.values(TRANSCODE_OPTIONS).includes(value) ? value : TRANSCODE_OPTIONS.OFF)
    assignWhenUnset(TRANSCODE_FROM_TYPES_KEY, 'transcodeFromTypes', value => typeof value === 'string'
      ? value.split(',').map(type => type.trim().toLowerCase()).filter(type => TRANSCODE_FILE_TYPES.includes(type)).filter((type, index, types) => types.indexOf(type) === index).join(',')
      : '')
    assignWhenUnset(SMART_PATH_ENABLED_KEY, 'smartPathEnabled', booleanValue)
    assignWhenUnset(SMART_PATH_PREFER_EFFECT_KEY, 'smartPathPreferEffect', booleanValue)
    assignWhenUnset(SMART_PATH_AUDIO_TYPES_KEY, 'smartPathAudioTypes', normalizeSmartPathAudioTypes)
  },

  TOGGLE_HIDE (state) {
    state.hide = !state.hide
  },

  PLAY (state) {
    state.playing = true
  },
  PAUSE (state) {
    state.playing = false
  },
  TOGGLE_PLAYING (state) {
    state.playing = !state.playing
  },

  SET_NEW_CURRENT_TIME (state, value) {
    state.newCurrentTime = value;
  },

  // Play a specific file from the queue.
  SET_TRACK: (state, index) => {
    if (index >= state.queue.length || index < 0) {
      return; // Invalid index, bail.
    }

    state.playing = true
    state.queueIndex = index
  },
  NEXT_TRACK: (state) => {
    if (state.queueIndex < state.queue.length - 1) {
      // Go to next track only if it exists.
      state.playing = true
      state.queueIndex += 1
    }
  },
  PREVIOUS_TRACK: (state) => {
    if (state.queueIndex > 0) {
      // Go to previous track only if it exists.
      state.playing = true
      state.queueIndex -= 1
    }
  },

  SET_QUEUE (state, payload) {
    state.queue = payload.queue
    state.queueIndex = payload.index

    if (payload.resetPlaying) {
      state.playing = true
    }

    const workId = payload.workId
    // 设置workId，然后配置封面，从浏览器本地Storage查找是否曾经手动配置过封面，
    // 如果没有则使用默认的封面路径
    if (workId !== state.playWorkId) {
      const localStorageName = `visual_cover_${workId}`
      let coverUrl = LocalStorage.getItem(localStorageName)
      if (!coverUrl) {
        const hash = getters.currentPlayingFile(state).hash
        coverUrl = `/api/cover/${hash.split('/')[0]}`
      }
      state.visualPlayerCoverUrl = coverUrl
    }
    state.playWorkId = workId
    if (Object.prototype.hasOwnProperty.call(payload, "resumeHistroySeconds")) {
      state.resumeHistroySeconds = payload.resumeHistroySeconds
    }
  },
  EMPTY_QUEUE: (state) => {
    state.playing = false
    state.queue = []
    state.queueIndex = 0
  },
  ADD_TO_QUEUE: (state, file) => {
    state.queue.push(file)
  },
  REMOVE_FROM_QUEUE: (state, index) => {
    state.queue.splice(index, 1)

    if (index === state.queueIndex) {
      state.playing = false
      state.queueIndex = 0
    } else if (index < state.queueIndex) {
      state.queueIndex -= 1
    } 
  },


  SET_DURATION (state, second) {
    state.duration = second
  },

  SET_CURRENT_TIME (state, second) {
    state.currentTime = second
  },

  // Add a file after the current playing item in the queue.
  PLAY_NEXT: (state, file) => {
    state.queue.splice(state.queueIndex + 1, 0, file);
  },

  CHANGE_PLAY_MODE: (state) => {
    const playModes = [
      {
        id: 0,
        name: "order"
      },
      {
        id: 1,
        name: "all repeat"
      },
      {
        id: 2,
        name: "repeat once"
      },
      {
        id: 3,
        name: "shuffle"
      }
    ]
    const index = (state.playMode.id >= playModes.length - 1) ? 0 : (state.playMode.id + 1)

    state.playMode = playModes[index]
  },

  TOGGLE_MUTED: (state) => {
    state.muted = !state.muted
  },

  SET_VOLUME: (state, val) => {
    const volume = Number(val)
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      return
    }
    state.volume = volume
    LocalStorage.set(VOLUME_KEY, volume)
  },
  SET_REWIND_SEEK_TIME: (state, value) => {
    const normalized = [5, 10, 30].includes(Number(value)) ? Number(value) : 5
    state.rewindSeekTime = normalized
    LocalStorage.set(REWIND_SEEK_TIME_KEY, normalized)
  },
  SET_FORWARD_SEEK_TIME: (state, value) => {
    const normalized = [5, 10, 30].includes(Number(value)) ? Number(value) : 30
    state.forwardSeekTime = normalized
    LocalStorage.set(FORWARD_SEEK_TIME_KEY, normalized)
  },
  SET_REWIND_SEEK_MODE: (state, value) => {
    state.rewindSeekMode = value
  },
  SET_FORWARD_SEEK_MODE: (state, value) => {
    state.forwardSeekMode = value
  },
  SET_HAS_LYRIC: (state, value) => {
    state.hasLyric = value;
  },
  SET_CURRENT_LYRIC: (state, line) => {
    state.currentLyric = line
  },
  SET_CURRENT_LYRIC_LINE_NUMBER: (state, lineNumber) => {
    state.currentLyricLineNumber = lineNumber
  },
  SET_LYRIC_LINES: (state, lines) => {
    state.lyricLines = Array.isArray(lines) ? lines : []
    if (state.lyricLines.length === 0 || state.currentLyricLineNumber >= state.lyricLines.length) {
      state.currentLyricLineNumber = 0
    }
  },
  SET_LYRIC_OFFSET_SECONDS: (state, value) => {
    state.lyricOffsetSeconds = value;
  },
  SET_SLEEP_TIMER: (state, time) => {
    state.sleepTime = time
    state.sleepMode = true
  },

  CLEAR_SLEEP_MODE: (state) => {
    state.sleepTime = null
    state.sleepMode = false
  },

  SET_VISUAL_PLAYER_COVER_URL: (state, value) => {
    const localStorageName = `visual_cover_${state.playWorkId}`
    state.visualPlayerCoverUrl = value
    LocalStorage.set(localStorageName, state.visualPlayerCoverUrl)
  },

  // SET_AUDIO_ELEMENT: (state, value) => {
  //   state.audioElement = value
  // }
  
  TOGGLE_SWAP_SEEK_BUTTON: (state) => {
    state.swapSeekButton = !state.swapSeekButton
    LocalStorage.set(SWAP_SEEK_BUTTON_KEY, state.swapSeekButton)
  },

  TOGGLE_ENABLE_VISUALIZER: (state) => {
    state.enableVisualizer = !state.enableVisualizer
    LocalStorage.set(ENABLE_VISUALIZER_KEY, state.enableVisualizer)
  },

  SET_ENABLE_VISUALIZER: (state, value) => {
    state.enableVisualizer = value
    LocalStorage.set(ENABLE_VISUALIZER_KEY, value)
  },

  SET_AUDIO_ANALYSER: (state, value) => {
    state.audioAnalyser = value;
  },

  SET_ENABLE_PIP_LYRICS: (state, value) => {
    state.enablePIPLyrics = value
    LocalStorage.set(ENABLE_PIP_LYRICS, state.enablePIPLyrics)
  },

  SET_RESUME_HISTROY_SECONDS: (state, value) => {
    state.resumeHistroySeconds = value
  },

  RESUME_HISTROY_SECONDS_DONE: (state) => {
    state.resumeHistroySeconds = -1
  },

  TOGGLE_ENABLE_VIDEO_SOURCE: (state) => {
    state.enableVideoSource = !state.enableVideoSource
    LocalStorage.set(ENABLE_VIDEO_SOURCE_KEY, state.enableVideoSource)
  },

  SET_ENABLE_VIDEO_SOURCE: (state, value) => {
    state.enableVideoSource = value
    LocalStorage.set(ENABLE_VIDEO_SOURCE_KEY, value)
  },

  SET_ENABLE_VIDEO_SOURCE_PIP: (state, value) => {
    state.enableVideoSourcePIP = value
  },

  SET_OLD_WORK_CARD_UI_STYLE: (state, value) => {
    state.oldWorkCardUIStyle = value
    LocalStorage.set(OLD_WORK_CARD_UI_STYLE_KEY, value)
  },

  SET_OLD_SLEEP_TIMER_UI_STYLE: (state, value) => {
    state.oldSleepTimerUIStyle = Boolean(value)
    LocalStorage.set(OLD_SLEEP_TIMER_UI_STYLE_KEY, state.oldSleepTimerUIStyle)
  },

  SET_ENABLE_SHOW_RECENT: (state, value) => {
    state.enableShowRecent = Boolean(value)
    LocalStorage.set(ENABLE_SHOW_RECENT_KEY, state.enableShowRecent)
  },

  SET_WORK_LIST_MODE: (state, value) => {
    state.workListMode = Object.values(WORK_LIST_MODES).includes(value)
      ? value
      : WORK_LIST_MODES.WATERFALL
    LocalStorage.set(WORK_LIST_MODE_KEY, state.workListMode)
  },

  SET_TRANSCODE_OPTION: (state, value) => {
    state.transcodeOption = Object.values(TRANSCODE_OPTIONS).includes(value)
      ? value
      : TRANSCODE_OPTIONS.OFF
    LocalStorage.set(TRANSCODE_OPTION_KEY, state.transcodeOption)
  },

  SET_TRANSCODE_FROM_TYPES: (state, value) => {
    const normalized = typeof value === 'string'
      ? value
        .split(',')
        .map(type => type.trim().toLowerCase())
        .filter(type => TRANSCODE_FILE_TYPES.includes(type))
        .filter((type, index, types) => types.indexOf(type) === index)
        .join(',')
      : ''
    state.transcodeFromTypes = normalized
    LocalStorage.set(TRANSCODE_FROM_TYPES_KEY, normalized)
  },

  SET_SMART_PATH_ENABLED: (state, value) => {
    state.smartPathEnabled = Boolean(value)
    LocalStorage.set(SMART_PATH_ENABLED_KEY, state.smartPathEnabled)
  },

  SET_SMART_PATH_PREFER_EFFECT: (state, value) => {
    state.smartPathPreferEffect = Boolean(value)
    LocalStorage.set(SMART_PATH_PREFER_EFFECT_KEY, state.smartPathPreferEffect)
  },

  SET_SMART_PATH_AUDIO_TYPES: (state, value) => {
    state.smartPathAudioTypes = normalizeSmartPathAudioTypes(value)
    LocalStorage.set(SMART_PATH_AUDIO_TYPES_KEY, state.smartPathAudioTypes)
  },

  SET_PLAYING_TRANSCODE: (state, value) => {
    state.playingTranscode = Boolean(value)
  },
}

export default mutations
