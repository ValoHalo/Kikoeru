import { createI18n } from 'vue-i18n'
import { Quasar } from 'quasar'
import zhCN from 'quasar/lang/zh-CN'
import enUS from 'quasar/lang/en-US'
import chinese from './locales/zh-CN.json'
import english from './locales/en.json'

const LOCALE_KEY = 'interface_language'
const locales = {
  'zh-CN': { label: '简体中文', messages: chinese, quasar: zhCN },
  en: { label: 'English', messages: english, quasar: enUS }
}
export const availableLocales = Object.entries(locales).map(([value, locale]) => ({ value, label: locale.label }))

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: Object.fromEntries(Object.entries(locales).map(([key, locale]) => [key, locale.messages]))
})

export const t = (...args) => i18n.global.t(...args)

export function setLocale (locale, { persist = true } = {}) {
  const selected = typeof locale === 'string' && /^en(?:-|$)/i.test(locale) ? 'en' : 'zh-CN'
  i18n.global.locale.value = selected
  Quasar.lang.set(locales[selected].quasar)
  document.documentElement.lang = selected
  if (persist) localStorage.setItem(LOCALE_KEY, selected)
}

export function initializeLocale () {
  setLocale(localStorage.getItem(LOCALE_KEY) || navigator.language, { persist: false })
}
