import { defineRouter } from '#q-app/wrappers'
import {
  createMemoryHistory,
  createRouter,
  createWebHistory
} from 'vue-router'
import axios from 'axios'

import routes from './routes'
import store from '../store'
import { cancelCoverTransition, checkCoverTransitionRoute, prepareReturnCoverTransition, coverTransitionScrollReady } from '../coverTransition'
import { getWorksScroll } from '../utils/worksScroll'

export default defineRouter(function () {
  const createHistory = process.env.SERVER ? createMemoryHistory : createWebHistory
  const router = createRouter({
    history: createHistory(process.env.VUE_ROUTER_BASE),
    routes,
    scrollBehavior (to, from, savedPosition) {
      if (!savedPosition && to.path === '/admin' && to.hash === '#scanner') {
        return { el: '#scanner', top: 64 }
      }
      const position = getWorksScroll(to.fullPath) || savedPosition || { left: 0, top: 0 }
      // Vue Router calls this after rendering. Apply the position once, before
      // the next paint and before measuring either end of the cover animation.
      window.scrollTo({ ...position, behavior: 'instant' })
      coverTransitionScrollReady(to)
      return false
    }
  })

  router.beforeEach(async (to) => {
    const requiresAdministrator = to.matched.some(route => route.meta.requiresAdministrator)
    if (!requiresAdministrator) return true

    try {
      const response = await axios.get('/api/auth/me')
      store.commit('User/INIT', response.data.user)
      store.commit('User/SET_AUTH', response.data.auth)
      store.commit('User/SET_CAN_MANAGE', response.data.canManage)
      return response.data.canManage === true ? true : '/'
    } catch (error) {
      store.commit('User/CLEAR')
      if (error.response && error.response.status === 401) {
        return { path: '/login', query: { redirect: to.fullPath } }
      }
      return '/'
    }
  })

  router.beforeResolve(prepareReturnCoverTransition)
  router.afterEach(checkCoverTransitionRoute)
  router.onError(cancelCoverTransition)

  return router
})
