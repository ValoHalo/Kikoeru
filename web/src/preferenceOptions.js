import { t } from './i18n'
import { COLOR_SCHEMES } from './colorScheme'
import { PLAYBACK_RATES, SUBTITLE_LANGUAGES, TRANSCODE_OPTIONS, WORK_LIST_MODES } from './store/module-AudioPlayer/state'

const subtitleLanguageLabels = {
  auto: 'preferenceOptions.autoSubtitle',
  zh: 'preferenceOptions.chinese',
  ja: 'preferenceOptions.japanese',
  en: 'preferenceOptions.english',
  ko: 'preferenceOptions.korean',
  und: 'preferenceOptions.unknownLanguage',
}

export function subtitleLanguageLabel (value) {
  return t(subtitleLanguageLabels[value] || subtitleLanguageLabels.und)
}

export const subtitleLanguageOptions = () => SUBTITLE_LANGUAGES.map(value => ({
  label: subtitleLanguageLabel(value),
  value,
}))

export const colorSchemeOptions = () => [
  { label: t('preferenceOptions.light'), icon: 'light_mode', value: COLOR_SCHEMES.LIGHT },
  { label: t('preferenceOptions.system'), icon: 'brightness_6', value: COLOR_SCHEMES.SYSTEM },
  { label: t('preferenceOptions.dark'), icon: 'dark_mode', value: COLOR_SCHEMES.DARK },
]

export const workListModeOptions = () => [
  { label: t('preferenceOptions.waterfall'), icon: 'view_stream', value: WORK_LIST_MODES.WATERFALL },
  { label: t('preferenceOptions.pagination'), icon: 'auto_stories', value: WORK_LIST_MODES.PAGINATION },
]

export const seekOptions = () => [
  { label: t('preferenceOptions.seek5'), value: 5 },
  { label: t('preferenceOptions.seek10'), value: 10 },
  { label: t('preferenceOptions.seek30'), value: 30 },
]

export const playbackRateOptions = PLAYBACK_RATES.map(value => ({
  label: `${value}×`,
  value,
}))

export const sleepTimerOptions = () => [
  { label: t('preferenceOptions.countdown'), icon: 'hourglass_bottom', value: false },
  { label: t('preferenceOptions.scheduled'), icon: 'schedule', value: true },
]

export const transcodeOptions = () => [
  { label: t('common.close'), value: TRANSCODE_OPTIONS.OFF },
  { label: 'AAC 128k', value: TRANSCODE_OPTIONS.AAC_128 },
  { label: 'AAC 320k', value: TRANSCODE_OPTIONS.AAC_320 },
]
