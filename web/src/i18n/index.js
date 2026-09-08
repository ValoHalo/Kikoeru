import { createI18n } from 'vue-i18n'
import { Quasar } from 'quasar'
import zhCN from 'quasar/lang/zh-CN'
import messages from './locales/zh-CN.json'

const LOCALE_KEY = 'interface_language'
const locales = { 'zh-CN': { label: '简体中文', messages, quasar: zhCN } }
export const availableLocales = Object.entries(locales).map(([value, locale]) => ({ value, label: locale.label }))

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: Object.fromEntries(Object.entries(locales).map(([key, locale]) => [key, locale.messages]))
})

export const t = (...args) => i18n.global.t(...args)

export function setLocale (locale, { persist = true } = {}) {
  const selected = availableLocales.some(item => item.value === locale) ? locale : 'zh-CN'
  i18n.global.locale.value = selected
  Quasar.lang.set(locales[selected].quasar)
  document.documentElement.lang = selected
  if (persist) localStorage.setItem(LOCALE_KEY, selected)
}

export function initializeLocale () {
  setLocale(localStorage.getItem(LOCALE_KEY) || navigator.language, { persist: false })
}
