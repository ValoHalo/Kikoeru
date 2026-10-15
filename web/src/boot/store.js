import { defineBoot } from '#q-app/wrappers'
import store from '../store'
import { t } from '../i18n'

export default defineBoot(({ app }) => {
  app.use(store)
  app.config.globalProperties.$privateText = value => store.state.AudioPlayer.privacyMode ? t('privacy.hidden') : value
  app.config.globalProperties.$privateImage = value => store.state.AudioPlayer.privacyMode ? '/statics/app-logo-128x128.png' : value
})
