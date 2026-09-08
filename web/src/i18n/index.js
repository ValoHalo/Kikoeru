import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import { Quasar } from 'quasar'
import zhCN from 'quasar/lang/zh-CN'
import zhTW from 'quasar/lang/zh-TW'
import enUS from 'quasar/lang/en-US'
import ja from 'quasar/lang/ja'
import chinese from './locales/zh-CN.json'
import traditionalChinese from './locales/zh-TW.json'
import english from './locales/en.json'
import japanese from './locales/ja.json'

const LOCALE_KEY = 'interface_language'
const locales = {
  'zh-CN': { label: '简体中文', messages: chinese, quasar: zhCN },
  'zh-TW': { label: '繁體中文', messages: traditionalChinese, quasar: zhTW },
  en: { label: 'English', messages: english, quasar: enUS },
  ja: { label: '日本語', messages: japanese, quasar: ja }
}
export const availableLocales = Object.entries(locales).map(([value, locale]) => ({ value, label: locale.label }))
export const localePreference = ref('auto')

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: Object.fromEntries(Object.entries(locales).map(([key, locale]) => [key, locale.messages]))
})

export const t = (...args) => i18n.global.t(...args)

export function setLocale (locale, { persist = true } = {}) {
  localePreference.value = locale || 'auto'
  if (localePreference.value === 'auto') locale = navigator.language
  const language = typeof locale === 'string' ? locale.split('-')[0].toLowerCase() : ''
  const selected = language === 'en' || language === 'ja'
    ? language
    : /^zh-(?:hant(?:-|$)|(?:tw|hk|mo)(?:-|$))/i.test(locale) ? 'zh-TW' : 'zh-CN'
  i18n.global.locale.value = selected
  Quasar.lang.set(locales[selected].quasar)
  document.documentElement.lang = selected
  if (persist) localStorage.setItem(LOCALE_KEY, localePreference.value === 'auto' ? 'auto' : selected)
}

export function initializeLocale () {
  setLocale(localStorage.getItem(LOCALE_KEY) || 'auto', { persist: false })
}

export function applyDefaultLocale (locale) {
  if (!localStorage.getItem(LOCALE_KEY)) setLocale(locale || 'auto', { persist: false })
}
