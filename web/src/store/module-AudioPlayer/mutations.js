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
  PLAYBACK_RATE_KEY,
  RESTORE_LAST_QUEUE_KEY,
  DEFAULT_SUBTITLE_LANGUAGE_KEY,
  PLAY_MODES,
  TRANSCODE_OPTIONS,
  TRANSCODE_FILE_TYPES,
  WORK_LIST_MODES,
  normalizePlaybackRate,
  normalizeSubtitleLanguage,
  normalizeSmartPathAudioTypes,
} from './state'

function trackWorkId (track, fallback = 0) {
  const explicitId = Number(track && track.workId)
  if (Number.isInteger(explicitId) && explicitId > 0) return explicitId
  const hashId = Number(String((track && track.hash) || '').split('/')[0])
  return Number.isInteger(hashId) && hashId > 0 ? hashId : Number(fallback) || 0
}

function syncCurrentTrackContext (state, fallbackWorkId = 0) {
  const track = getters.currentPlayingFile(state)
  const workId = trackWorkId(track, fallbackWorkId)
  if (workId === 0) {
    state.playWorkId = 0
    state.visualPlayerCoverUrl = ''
    return
  }
  if (workId !== state.playWorkId) {
    const localStorageName = `visual_cover_${workId}`
    state.visualPlayerCoverUrl = LocalStorage.getItem(localStorageName) || `/api/cover/${workId}`
  }
  state.playWorkId = workId
}

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
    assignWhenUnset(PLAYBACK_RATE_KEY, 'playbackRate', normalizePlaybackRate)
    assignWhenUnset(DEFAULT_SUBTITLE_LANGUAGE_KEY, 'defaultSubtitleLanguage', normalizeSubtitleLanguage)
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
    syncCurrentTrackContext(state)
  },
  NEXT_TRACK: (state) => {
    if (state.queueIndex < state.queue.length - 1) {
      // Go to next track only if it exists.
      state.playing = true
      state.queueIndex += 1
      syncCurrentTrackContext(state)
    }
  },
  PREVIOUS_TRACK: (state) => {
    if (state.queueIndex > 0) {
      // Go to previous track only if it exists.
      state.playing = true
      state.queueIndex -= 1
      syncCurrentTrackContext(state)
    }
  },

  SET_QUEUE (state, payload) {
    state.queue = Array.isArray(payload.queue) ? payload.queue : []
    if (state.queue.length === 0) {
      state.queueIndex = 0
      state.playing = false
      syncCurrentTrackContext(state)
      return
    }
    const requestedIndex = Number(payload.index)
    state.queueIndex = Number.isInteger(requestedIndex)
      ? Math.min(Math.max(requestedIndex, 0), state.queue.length - 1)
      : 0

    if (payload.resetPlaying) {
      state.playing = true
    }

    syncCurrentTrackContext(state, payload.workId)
    if (Object.prototype.hasOwnProperty.call(payload, "resumeHistroySeconds")) {
      state.resumeHistroySeconds = payload.resumeHistroySeconds
    }
  },
  EMPTY_QUEUE: (state) => {
    state.playing = false
    state.queue = []
    state.queueIndex = 0
    state.playWorkId = 0
    state.visualPlayerCoverUrl = ''
    state.currentTime = 0
    state.duration = 0
    state.resumeHistroySeconds = -1
  },
  ADD_TO_QUEUE: (state, file) => {
    state.queue.push(file)
    syncCurrentTrackContext(state)
  },
  REMOVE_FROM_QUEUE: (state, index) => {
    if (index < 0 || index >= state.queue.length) return
    state.queue.splice(index, 1)
    if (state.queue.length === 0) {
      state.playing = false
      state.queueIndex = 0
      syncCurrentTrackContext(state)
      return
    }
    if (index === state.queueIndex) {
      state.playing = false
      state.queueIndex = Math.min(state.queueIndex, state.queue.length - 1)
    } else if (index < state.queueIndex) {
      state.queueIndex -= 1
    }
    syncCurrentTrackContext(state)
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
    syncCurrentTrackContext(state)
  },

  CHANGE_PLAY_MODE: (state) => {
    const index = (state.playMode.id >= PLAY_MODES.length - 1) ? 0 : (state.playMode.id + 1)
    state.playMode = PLAY_MODES[index]
  },

  SET_PLAY_MODE: (state, value) => {
    const name = typeof value === 'string' ? value : value && value.name
    state.playMode = PLAY_MODES.find(mode => mode.name === name) || PLAY_MODES[0]
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
  SET_PLAYBACK_RATE: (state, value) => {
    state.playbackRate = normalizePlaybackRate(value)
    LocalStorage.set(PLAYBACK_RATE_KEY, state.playbackRate)
  },
  SET_RESTORE_LAST_QUEUE: (state, value) => {
    state.restoreLastQueue = Boolean(value)
    LocalStorage.set(RESTORE_LAST_QUEUE_KEY, state.restoreLastQueue)
  },
  SET_DEFAULT_SUBTITLE_LANGUAGE: (state, value) => {
    state.defaultSubtitleLanguage = normalizeSubtitleLanguage(value)
    LocalStorage.set(DEFAULT_SUBTITLE_LANGUAGE_KEY, state.defaultSubtitleLanguage)
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
