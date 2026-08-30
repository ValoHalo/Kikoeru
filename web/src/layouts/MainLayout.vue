<template>
  <q-layout view="hHh Lpr lFf">
    <q-header reveal :reveal-offset="100" @reveal="onHeaderRevealChange" class="shadow-4">
      <q-toolbar class="row justify-between">
        <q-btn flat dense round @click="drawerOpen = !drawerOpen" icon="menu" aria-label="菜单" />
        <q-btn flat size="md" icon="arrow_back_ios" @click="back()" v-if="isNotAtHomePage" aria-label="返回" />
        <q-toolbar-title class="gt-xs"><router-link :to="'/'" class="text-white">Kikoeru</router-link></q-toolbar-title>
        <q-input v-if="$route.name !== 'advance search'" dark dense rounded standout v-model="keyword" debounce="500" input-class="text-right" class="q-mr-sm">
          <template v-slot:before><q-btn round dense flat icon="manage_search" to="/search"><q-tooltip>点此进入聚合搜索，支持多关键字搜索</q-tooltip></q-btn></template>
          <template v-slot:append><q-icon v-if="keyword === ''" name="search" /><q-icon v-else name="clear" class="cursor-pointer" @click="keyword = ''" /></template>
        </q-input>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="drawerOpen"
      show-if-above
      :mini="drawerMini"
      mini-to-overlay
      :width="248"
      :breakpoint="500"
      bordered
      :class="$q.dark.isActive ? 'main-drawer overflow-hidden bg-dark' : 'main-drawer overflow-hidden bg-white'"
      @mouseenter="drawerMini = false"
      @mouseleave="drawerMini = true"
      @focusin="drawerMini = false"
      @focusout="drawerMini = true"
    >
      <q-scroll-area class="main-drawer-scroll fit" :content-style="{ top: '0', bottom: '0' }" :content-active-style="{ top: '0', bottom: '0' }">
        <div class="drawer-content">
          <q-list padding class="drawer-primary">
            <q-item v-for="link in getLinks()" :key="link.path" clickable v-ripple exact :to="link.path" active-class="text-primary text-weight-medium">
              <q-item-section avatar><q-icon :name="link.icon" /></q-item-section>
              <q-item-section><q-item-label class="text-subtitle1">{{ link.title }}</q-item-label></q-item-section>
            </q-item>
            <q-item clickable v-ripple @click="randomPlay"><q-item-section avatar><q-icon name="shuffle" /></q-item-section><q-item-section><q-item-label class="text-subtitle1">随心听</q-item-label></q-item-section></q-item>
            <q-item clickable v-ripple @click="showTimer = true">
              <q-item-section avatar><q-icon name="timer" /></q-item-section>
              <q-item-section><q-item-label class="text-subtitle1">睡眠定时</q-item-label><q-item-label v-if="sleepMode" caption>{{ sleepTimeCaption }}</q-item-label></q-item-section>
            </q-item>
          </q-list>

          <q-list padding class="drawer-secondary">
            <q-item clickable v-ripple @click="cycleColorScheme">
              <q-item-section avatar><q-icon name="brightness_6" /></q-item-section>
              <q-item-section><q-item-label class="text-subtitle1">夜间模式</q-item-label><q-item-label caption>{{ colorSchemeCaption }}</q-item-label></q-item-section>
              <q-item-section side class="color-scheme-toggle-section">
                <button
                  type="button"
                  class="color-scheme-toggle"
                  :class="`color-scheme-toggle--${colorScheme}`"
                  role="switch"
                  :aria-checked="colorSchemeAriaChecked"
                  :aria-label="`夜间模式：${colorSchemeCaption}。点击切换`"
                  :title="`夜间模式：${colorSchemeCaption}`"
                  @click.stop="cycleColorScheme"
                >
                  <span class="color-scheme-toggle__track" aria-hidden="true" />
                  <span class="color-scheme-toggle__thumb" aria-hidden="true" />
                </button>
              </q-item-section>
            </q-item>
            <q-item clickable v-ripple to="/about" active-class="text-primary text-weight-medium"><q-item-section avatar><q-icon name="info" /></q-item-section><q-item-section><q-item-label class="text-subtitle1">关于</q-item-label></q-item-section></q-item>
            <q-item clickable v-ripple to="/preferences" active-class="text-primary text-weight-medium"><q-item-section avatar><q-icon name="tune" /></q-item-section><q-item-section><q-item-label class="text-subtitle1">设置</q-item-label></q-item-section></q-item>
            <q-item v-if="canManage" clickable v-ripple to="/admin" active-class="text-primary text-weight-medium"><q-item-section avatar><q-icon name="admin_panel_settings" /></q-item-section><q-item-section><q-item-label class="text-subtitle1">管理设置</q-item-label></q-item-section></q-item>
            <q-item v-if="!isSignedIn" clickable v-ripple @click="openLoginDialog"><q-item-section avatar><q-icon name="login" /></q-item-section><q-item-section><q-item-label class="text-subtitle1">登录</q-item-label></q-item-section></q-item>
            <q-item v-else clickable v-ripple @click="confirm = true"><q-item-section avatar><q-icon name="exit_to_app" /></q-item-section><q-item-section><q-item-label class="text-subtitle1">登出</q-item-label><q-item-label caption lines="1">{{ userName }}</q-item-label></q-item-section></q-item>
          </q-list>
        </div>
      </q-scroll-area>
    </q-drawer>

    <q-dialog v-model="loginDialog" persistent>
      <q-card class="auth-dialog-card">
        <q-form @submit="login">
          <q-card-section class="row items-center">
            <q-avatar icon="login" color="primary" text-color="white" />
            <span class="q-ml-sm">登录</span>
          </q-card-section>
          <q-card-section class="q-pt-none q-gutter-md">
            <q-input
              v-model="loginName"
              filled
              autofocus
              autocomplete="username"
              label="用户名"
              :rules="[value => Boolean(value && value.length >= 5) || '用户名长度至少为 5']"
            />
            <q-input
              v-model="loginPassword"
              filled
              type="password"
              autocomplete="current-password"
              label="密码"
              :rules="[value => Boolean(value && value.length >= 5) || '密码长度至少为 5']"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="取消" color="primary" :disable="loginSubmitting" @click="cancelLogin" />
            <q-btn flat label="登录" color="primary" type="submit" :loading="loginSubmitting" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
    <q-dialog v-model="confirm" persistent><q-card class="auth-dialog-card"><q-card-section class="row items-center"><q-avatar icon="power_settings_new" color="primary" text-color="white" /><span class="q-ml-sm">是否退出登录？</span></q-card-section><q-card-actions align="right"><q-btn flat label="取消" color="primary" v-close-popup /><q-btn flat label="退出" color="primary" @click="logout()" v-close-popup /></q-card-actions></q-card></q-dialog>
    <SleepMode v-if="oldSleepTimerUIStyle" v-model="showTimer" />
    <CountDownSleepMode v-else v-model="showTimer" />

    <q-page-container :class="{'page-container-style': isFullScreenPage, 'padding-bottom-play-bar': !isFullScreenPage}">
      <router-view v-slot="{ Component }">
        <keep-alive include="Works">
          <component :is="Component" />
        </keep-alive>
      </router-view>
      <q-page-scroller v-if="!isFullScreenPage" position="bottom-right" :scroll-offset="150" :offset="[18, 90]" class="scroller" :class="{'scroller-hide': !showScroller, 'scroller-show': showScroller}"><q-btn dense fab icon="keyboard_arrow_up" color="primary" padding="sm" /></q-page-scroller>
    </q-page-container>
    <div style="position: fixed; bottom: 0; z-index: 3001;"><PlayerBar /><AudioPlayer /><LyricsBar v-if="!enablePIPLyrics" /><PIPLyrics /></div>
    <q-footer class="q-pa-none" />
  </q-layout>
</template>

<script>
import PlayerBar from 'components/PlayerBar.vue'
import AudioPlayer from 'components/AudioPlayer.vue'
import LyricsBar from 'components/LyricsBar.vue'
import PIPLyrics from 'src/components/PIPLyrics.vue'
import SleepMode from 'components/SleepMode.vue'
import CountDownSleepMode from 'components/CountDownSleepMode.vue'
import NotifyMixin from '../mixins/Notification.js'
import { mapState } from 'vuex'
import { applyColorScheme, COLOR_SCHEMES, COLOR_SCHEME_EVENT, hasSavedColorScheme, readColorScheme } from '../colorScheme'
import { applyAccentColor, hasSavedAccentColor, normalizeAccentColor } from '../themeColor'

const LOGIN_PROMPT_DISMISSED_KEY = 'anonymous-login-prompt-dismissed'

export default {
  name: 'MainLayout',
  mixins: [NotifyMixin],
  components: { PlayerBar, AudioPlayer, LyricsBar, SleepMode, CountDownSleepMode, PIPLyrics },
  data () {
    return {
      keyword: typeof this.$route.query.keyword === 'string' ? this.$route.query.keyword : '', drawerOpen: false, drawerMini: true, confirm: false, randId: null, showTimer: false, showScroller: false,
      loginDialog: false, loginName: '', loginPassword: '', loginSubmitting: false, loginPromptDismiss: null,
      restoredQueueUser: '',
      colorScheme: readColorScheme(),
      links: [
        { title: '媒体库', icon: 'widgets', path: '/' }, { title: '聚合搜索', icon: 'manage_search', path: '/search' }, { title: '大图模式', icon: 'play_circle', path: '/fullScreenPlayer' }, { title: '我的收藏', icon: 'favorite', path: '/favourites' }, { title: '播放列表', icon: 'queue_music', path: '/playlist' }, { title: '社团', icon: 'group', path: '/circles' }, { title: '标签', icon: 'label', path: '/tags' }, { title: '声优', icon: 'mic', path: '/vas' }
      ]
    }
  },
  watch: {
    keyword () {
      const routeKeyword = typeof this.$route.query.keyword === 'string' ? this.$route.query.keyword : ''
      if (this.$route.path === '/works' && this.keyword === routeKeyword) return
      this.$router.push(this.keyword ? { path: '/works', query: { keyword: this.keyword } } : { path: '/works' })
    },
    randId () { if (this.randId) this.$router.push(`/work/${this.randId}`) },
    '$route.query.keyword' (value) {
      const keyword = typeof value === 'string' ? value : ''
      if (this.keyword !== keyword) this.keyword = keyword
    },
    '$route.query.login' (value) { if (value === '1') this.openLoginDialog() }
  },
  mounted () {
    applyColorScheme(this.colorScheme, { persist: false })
    this.colorSchemeMediaQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
    if (this.colorSchemeMediaQuery) this.colorSchemeMediaQuery.addListener(this.onSystemColorSchemeChange)
    window.addEventListener(COLOR_SCHEME_EVENT, this.onColorSchemeEvent)
    if (this.$route.query.login === '1') this.openLoginDialog()
    this.initUser(); this.checkUpdate(); this.readSharedConfig()
  },
  computed: {
    isNotAtHomePage () { const path = this.$route.path; return path && path !== '/' && path !== '/works' && path !== '/favourites' },
    isFullScreenPage () { return this.$route.path && this.$route.path.startsWith('/fullScreenPlayer') },
    colorSchemeCaption () {
      return this.colorScheme === COLOR_SCHEMES.SYSTEM ? '跟随系统' : this.colorScheme === COLOR_SCHEMES.DARK ? '已启用' : '已禁用'
    },
    colorSchemeAriaChecked () {
      return this.colorScheme === COLOR_SCHEMES.SYSTEM ? 'mixed' : this.colorScheme === COLOR_SCHEMES.DARK ? 'true' : 'false'
    },
    isSignedIn () { return this.authEnabled === true && Boolean(this.userName) },
    ...mapState('User', { userName: 'name', authEnabled: 'auth', canManage: 'canManage' }),
    sleepTimeCaption () {
      if (typeof this.sleepTime === 'number') {
        const remaining = Math.max(0, this.sleepTime - Date.now())
        return `剩余 ${Math.ceil(remaining / 60000)} 分钟`
      }
      return this.sleepTime
    },
    ...mapState('AudioPlayer', ['playWorkId', 'enablePIPLyrics', 'sleepMode', 'sleepTime', 'oldSleepTimerUIStyle'])
  },
  methods: {
    async initUser ({ showPrompt = true, retry = true } = {}) {
      try {
        const previousUserName = this.$store.state.User.name
        const response = await this.$axios.get('/api/auth/me')
        this.$store.commit('User/INIT', response.data.user)
        this.$store.commit('User/SET_AUTH', response.data.auth)
        this.$store.commit('User/SET_CAN_MANAGE', response.data.canManage)
        if (response.data.auth === true && !response.data.user && showPrompt) {
          this.showAnonymousLoginPrompt()
        } else if (response.data.user) {
          this.dismissAnonymousLoginPrompt()
        }
        const currentUserName = response.data.user && response.data.user.name ? response.data.user.name : ''
        if (currentUserName !== previousUserName && this.$store.state.AudioPlayer.queue.length > 0) {
          this.$store.commit('AudioPlayer/EMPTY_QUEUE')
        }
        await this.restoreLatestQueue(currentUserName)
        return response.data
      } catch (error) {
        if (retry && error.response && error.response.status === 401) {
          await this.clearAuthentication()
          return this.initUser({ showPrompt, retry: false })
        }
        this.$store.commit('User/CLEAR')
        this.showErrNotif((error.response && error.response.data.error) || error.message || error)
        return null
      }
    },
    async restoreLatestQueue (userName) {
      if (!userName || !this.$store.state.AudioPlayer.restoreLastQueue) return
      if (this.restoredQueueUser === userName || this.$store.state.AudioPlayer.queue.length > 0) return
      this.restoredQueueUser = userName
      try {
        const response = await this.$axios.get('/api/histroy', { params: { page: 1, sort: 'desc' } })
        if (this.$store.state.User.name !== userName || this.$store.state.AudioPlayer.queue.length > 0) return
        const work = response.data && Array.isArray(response.data.works) ? response.data.works[0] : null
        const historyState = work && work.state
        if (!historyState || !Array.isArray(historyState.queue) || historyState.queue.length === 0) return
        const indexValue = Number(historyState.index)
        const index = Number.isInteger(indexValue)
          ? Math.min(Math.max(indexValue, 0), historyState.queue.length - 1)
          : 0
        const secondsValue = Number(historyState.seconds)
        const seconds = Number.isFinite(secondsValue) && secondsValue >= 0 ? secondsValue : 0
        this.$store.commit('AudioPlayer/PAUSE')
        this.$store.commit('AudioPlayer/SET_QUEUE', {
          workId: work.id,
          queue: historyState.queue,
          index,
          resetPlaying: false,
          resumeHistroySeconds: seconds,
        })
        if (historyState.playMode) this.$store.commit('AudioPlayer/SET_PLAY_MODE', historyState.playMode)
        if (Object.prototype.hasOwnProperty.call(historyState, 'playbackRate')) {
          this.$store.commit('AudioPlayer/SET_PLAYBACK_RATE', historyState.playbackRate)
        }
        const track = historyState.queue[index]
        this.$q.notify({
          message: `已恢复上次播放${track && track.title ? `：${track.title}` : ''}`,
          icon: 'restore',
          timeout: 3500,
          actions: [{ label: '清除', handler: () => this.$store.commit('AudioPlayer/EMPTY_QUEUE') }],
        })
      } catch (error) {
        console.warn('Failed to restore latest queue:', error)
      }
    },
    checkUpdate () {
      this.$axios.get('/api/version').then((res) => {
        if (res.data.update_available && res.data.notifyUser) this.$q.notify({ message: 'GitHub上有新版本', color: 'primary', textColor: 'white', icon: 'cloud_download', timeout: 5000, actions: [{ label: '好', color: 'white' }, { label: '查看', color: 'white', handler: () => { Object.assign(document.createElement('a'), { target: '_blank', href: 'https://github.com/ValoHalo/Kikoeru/releases' }).click() } }] })
        if (res.data.lockFileExists) this.$q.notify({ message: res.data.lockReason, type: 'warning', timeout: 60000, actions: [{ label: '以后提醒我', color: 'black' }, { label: '前往扫描页', color: 'black', handler: () => this.$router.push('/admin/scanner') }] })
      }).catch(() => {})
    },
    readSharedConfig () {
      this.$axios.get('/api/config/shared').then((response) => {
        const defaults = response.data.sharedConfig || {}
        this.$store.commit('AudioPlayer/APPLY_DEFAULT_PREFERENCES', defaults)
        if (!hasSavedColorScheme() && Object.values(COLOR_SCHEMES).includes(defaults.colorScheme)) {
          this.colorScheme = applyColorScheme(defaults.colorScheme, { persist: false })
        }
        if (!hasSavedAccentColor() && normalizeAccentColor(defaults.accentColor)) {
          applyAccentColor(defaults.accentColor, { persist: false })
        }
      }).catch(() => {})
    },
    randomPlay () {
      this.$axios.get('/api/works', { params: { order: 'betterRandom' } }).then((response) => { const works = response.data.works; this.randId = works.length ? works[0].id : null }).catch((error) => { if (!error.response || error.response.status !== 401) this.showErrNotif((error.response && error.response.data.error) || error.message || error) })
    },
    openLoginDialog () {
      this.dismissAnonymousLoginPrompt()
      this.loginDialog = true
    },
    cancelLogin () {
      this.loginDialog = false
      this.clearLoginRouteRequest()
    },
    clearLoginRouteRequest () {
      if (this.$route.query.login !== '1') return
      const query = { ...this.$route.query }
      delete query.login
      delete query.redirect
      this.$router.replace({ path: this.$route.path, query }).catch(() => {})
    },
    showAnonymousLoginPrompt () {
      if (this.loginDialog || this.loginPromptDismiss || this.$q.localStorage.getItem(LOGIN_PROMPT_DISMISSED_KEY) === true) return
      this.loginPromptDismiss = this.$q.notify({
        message: '登录后可保存收藏、进度和播放记录',
        color: 'primary',
        textColor: 'white',
        icon: 'login',
        position: 'bottom',
        timeout: 0,
        actions: [
          { label: '登录', color: 'white', handler: () => this.openLoginDialog() },
          { label: '不再提示', color: 'white', handler: () => this.dismissLoginPromptPermanently() }
        ]
      })
    },
    dismissAnonymousLoginPrompt () {
      if (typeof this.loginPromptDismiss === 'function') this.loginPromptDismiss()
      this.loginPromptDismiss = null
    },
    dismissLoginPromptPermanently () {
      this.$q.localStorage.set(LOGIN_PROMPT_DISMISSED_KEY, true)
      this.dismissAnonymousLoginPrompt()
    },
    async login () {
      this.loginSubmitting = true
      const redirect = typeof this.$route.query.redirect === 'string' ? this.$route.query.redirect : ''
      try {
        await this.$axios.post('/api/auth/me', { name: this.loginName, password: this.loginPassword })
        const authState = await this.initUser({ showPrompt: false, retry: false })
        if (!authState || !authState.user) throw new Error('登录状态确认失败')
        this.loginDialog = false
        this.loginPassword = ''
        this.showSuccNotif('登录成功')
        if (redirect.startsWith('/') && !redirect.startsWith('//')) {
          this.$router.replace(redirect).catch(() => {})
        } else {
          this.clearLoginRouteRequest()
        }
      } catch (error) {
        const message = error.response && error.response.data
          ? error.response.data.error || (error.response.data.errors && error.response.data.errors[0] && error.response.data.errors[0].msg)
          : error.message
        if (error.response && error.response.status === 401) this.showWarnNotif(message || '用户名或密码错误')
        else this.showErrNotif(message || error)
      } finally {
        this.loginSubmitting = false
      }
    },
    async clearAuthentication () {
      try { await this.$axios.post('/api/auth/logout') } catch (error) { console.warn('Failed to clear server authentication cookie:', error) }
      this.$store.commit('AudioPlayer/EMPTY_QUEUE')
      this.$store.commit('User/CLEAR')
      this.restoredQueueUser = ''
    },
    async logout () {
      await this.clearAuthentication()
      await this.initUser()
    },
    back () { this.$router.go(-1) },
    setColorScheme (scheme) {
      this.colorScheme = applyColorScheme(scheme)
    },
    onColorSchemeEvent (event) {
      if (event.detail && Object.values(COLOR_SCHEMES).includes(event.detail.scheme)) {
        this.colorScheme = event.detail.scheme
      }
    },
    cycleColorScheme () {
      const schemes = [COLOR_SCHEMES.LIGHT, COLOR_SCHEMES.SYSTEM, COLOR_SCHEMES.DARK]
      const currentIndex = schemes.indexOf(this.colorScheme)
      this.setColorScheme(schemes[(currentIndex + 1) % schemes.length])
    },
    onSystemColorSchemeChange () {
      if (this.colorScheme === COLOR_SCHEMES.SYSTEM) applyColorScheme(COLOR_SCHEMES.SYSTEM)
    },
    getLinks () { return this.links.filter(link => link.path !== '/fullScreenPlayer' || this.playWorkId !== 0).map(link => link.path === '/fullScreenPlayer' ? { ...link, path: `${link.path}/${this.playWorkId}` } : link) },
    onHeaderRevealChange (isReveal) { this.showScroller = isReveal }
  },
  beforeUnmount () {
    this.dismissAnonymousLoginPrompt()
    if (this.colorSchemeMediaQuery) this.colorSchemeMediaQuery.removeListener(this.onSystemColorSchemeChange)
    window.removeEventListener(COLOR_SCHEME_EVENT, this.onColorSchemeEvent)
  }
}
</script>

<style lang="scss">
.main-drawer { background: #fff; }
.body--dark .main-drawer { background: #1d1d1d; }
.drawer-content { display: flex; flex-direction: column; height: 100%; }
.drawer-primary { padding-top: 12px; }
.drawer-secondary { margin-top: auto; padding-bottom: 12px; }
.main-drawer .q-item { min-height: 48px; }
.drawer-secondary .q-item { height: 54px; min-height: 54px; }
.q-drawer--mini .main-drawer .q-item { width: 56px; }
.main-drawer .q-item__section--avatar { min-width: 40px; }
.auth-dialog-card { width: 360px; max-width: 90vw; }
.q-drawer--mini .color-scheme-toggle-section { visibility: hidden; opacity: 0; pointer-events: none; }
.color-scheme-toggle { position: relative; width: 42px; min-width: 42px; height: 24px; padding: 0; border: 0; outline: 0; background: transparent; cursor: pointer; }
.color-scheme-toggle__track { position: absolute; top: 4px; right: 1px; bottom: 4px; left: 1px; border-radius: 8px; background: rgba(0, 0, 0, .26); transition: background-color .16s ease; }
.color-scheme-toggle__thumb { position: absolute; top: 2px; left: 1px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .35); transition: transform .16s cubic-bezier(.4, 0, .2, 1); }
.color-scheme-toggle--system .color-scheme-toggle__thumb { transform: translateX(10px); }
.color-scheme-toggle--dark .color-scheme-toggle__track { background: var(--q-primary); }
.color-scheme-toggle--dark .color-scheme-toggle__thumb { transform: translateX(20px); }
.color-scheme-toggle:focus-visible .color-scheme-toggle__track { box-shadow: 0 0 0 2px rgba(var(--kikoeru-accent-rgb), .32); }
.body--dark .color-scheme-toggle:not(.color-scheme-toggle--dark) .color-scheme-toggle__track { background: rgba(255, 255, 255, .38); }
@media (prefers-reduced-motion: reduce) {
  .color-scheme-toggle__track, .color-scheme-toggle__thumb { transition: none; }
}
.page-container-style { position: absolute; left: 0; right: 0; bottom: 0; top: 0; }
.padding-bottom-play-bar { padding-bottom: 80px !important; }
.scroller { transition: .3s; }
.scroller-show { opacity: 1; visibility: visible; }
.scroller-hide { opacity: 0; visibility: collapse; }
</style>
