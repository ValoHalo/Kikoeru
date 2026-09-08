import { defineBoot } from '#q-app/wrappers'
import { i18n, initializeLocale } from '../i18n'

export default defineBoot(({ app }) => {
  app.use(i18n)
  initializeLocale()
})
