import { COLOR_SCHEMES } from './colorScheme'
import { PLAYBACK_RATES, TRANSCODE_OPTIONS, WORK_LIST_MODES } from './store/module-AudioPlayer/state'

export const colorSchemeOptions = [
  { label: '浅色', icon: 'light_mode', value: COLOR_SCHEMES.LIGHT },
  { label: '跟随系统', icon: 'brightness_6', value: COLOR_SCHEMES.SYSTEM },
  { label: '深色', icon: 'dark_mode', value: COLOR_SCHEMES.DARK },
]

export const workListModeOptions = [
  { label: '瀑布流', icon: 'view_stream', value: WORK_LIST_MODES.WATERFALL },
  { label: '分页', icon: 'auto_stories', value: WORK_LIST_MODES.PAGINATION },
]

export const seekOptions = [
  { label: '5 秒', value: 5 },
  { label: '10 秒', value: 10 },
  { label: '30 秒', value: 30 },
]

export const playbackRateOptions = PLAYBACK_RATES.map(value => ({
  label: `${value}×`,
  value,
}))

export const sleepTimerOptions = [
  { label: '分钟倒计时', icon: 'hourglass_bottom', value: false },
  { label: '指定时刻', icon: 'schedule', value: true },
]

export const transcodeOptions = [
  { label: '关闭', value: TRANSCODE_OPTIONS.OFF },
  { label: 'AAC 128k', value: TRANSCODE_OPTIONS.AAC_128 },
  { label: 'AAC 320k', value: TRANSCODE_OPTIONS.AAC_320 },
]
