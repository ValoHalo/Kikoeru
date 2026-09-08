import axios from 'axios'
import { defineBoot } from '#q-app/wrappers'
import store from '../store'
import { i18n } from '../i18n'

axios.defaults.headers.common['Content-Type'] = 'application/json'

axios.interceptors.request.use(config => {
  if (config.url.startsWith('/api/')) config.headers['Accept-Language'] = i18n.global.locale.value
  if (config.url.startsWith('/api/') && (config.method === 'get' || config.url.endsWith('/items/order')) && store.getters['AudioPlayer/sfwOnly']) {
    config.params = { ...config.params, nsfw: 1 }
  }
  return config
})

axios.interceptors.response.use(response => {
  if (!response.config.url.startsWith('/api/')) return response
  const data = response.data
  const works = Array.isArray(data) ? data : data && (data.works || data.items) || (data ? [data] : [])
  const ratings = works.flatMap(work => [work, ...(work.state && Array.isArray(work.state.queue) ? work.state.queue : [])])
  store.commit('AudioPlayer/SET_WORK_RATINGS', ratings)
  return response
})

export default defineBoot(({ app }) => {
  app.config.globalProperties.$axios = axios
})
