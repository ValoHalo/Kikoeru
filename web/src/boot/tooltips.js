import { defineBoot } from '#q-app/wrappers'
import AppTooltip from '../components/AppTooltip.vue'

export default defineBoot(({ app }) => {
  app.component('AppTooltip', AppTooltip)
})
