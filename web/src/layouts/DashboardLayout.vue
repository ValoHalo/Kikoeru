<template>
  <q-layout view="hHh Lpr lFf">
    <q-header class="shadow-4">
      <q-toolbar>
        <q-btn flat round dense icon="menu" aria-label="菜单" @click="drawerOpen = !drawerOpen" />
        <q-toolbar-title class="admin-toolbar-title">
          <router-link to="/" class="header-brand">Kikoeru</router-link>
          <span class="admin-toolbar-divider" aria-hidden="true" />
          <span class="admin-toolbar-section gt-xs">{{ currentSectionTitle }}</span>
          <span class="admin-toolbar-section xs">{{ compactSectionTitle }}</span>
        </q-toolbar-title>
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
      :class="$q.dark.isActive ? 'admin-drawer overflow-hidden bg-dark' : 'admin-drawer overflow-hidden bg-white'"
      @mouseenter="drawerMini = false"
      @mouseleave="drawerMini = true"
      @focusin="drawerMini = false"
      @focusout="drawerMini = true"
    >
      <q-scroll-area class="fit" :content-style="{ top: '0', bottom: '0' }" :content-active-style="{ top: '0', bottom: '0' }">
        <div class="admin-drawer-content">
          <q-list padding class="admin-drawer-primary">
            <q-item
              v-for="link in links"
              :key="link.path"
              clickable
              v-ripple
              exact
              :to="link.path"
              active-class="text-primary text-weight-medium"
            >
              <q-item-section avatar><q-icon :name="link.icon" /></q-item-section>
              <q-item-section><q-item-label class="text-subtitle1">{{ link.title }}</q-item-label></q-item-section>
              <q-tooltip v-if="drawerMini" anchor="center right" self="center left" :offset="[10, 0]">{{ link.title }}</q-tooltip>
            </q-item>
          </q-list>

          <q-list padding class="admin-drawer-secondary">
            <q-item clickable v-ripple exact to="/" active-class="text-primary text-weight-medium">
              <q-item-section avatar><q-icon name="home" /></q-item-section>
              <q-item-section><q-item-label class="text-subtitle1">回到主页</q-item-label></q-item-section>
              <q-tooltip v-if="drawerMini" anchor="center right" self="center left" :offset="[10, 0]">回到主页</q-tooltip>
            </q-item>
          </q-list>
        </div>
      </q-scroll-area>
    </q-drawer>

    <q-page-container class="admin-page-container">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import NotifyMixin from '../mixins/Notification.js'
import { applyColorScheme, COLOR_SCHEMES, hasSavedColorScheme, readColorScheme } from '../colorScheme'
import { applyAccentColor, hasSavedAccentColor, normalizeAccentColor } from '../themeColor'

export default {
  name: 'DashboardLayout',

  mixins: [NotifyMixin],

  data () {
    return {
      drawerOpen: false,
      drawerMini: true,
      links: [
        {
          title: '音声库',
          icon: 'folder',
          path: '/admin'
        },
        {
          title: '扫描',
          icon: 'youtube_searched_for',
          path: '/admin/scanner'
        },
        {
          title: '用户管理',
          icon: 'person',
          path: '/admin/usermanage'
        },
        {
          title: '默认设置',
          icon: 'tune',
          path: '/admin/defaults'
        },
        {
          title: '高级设置',
          icon: 'settings',
          path: '/admin/advanced'
        },
        {
          title: '更新',
          icon: 'system_update_alt',
          path: '/admin/update'
        }
      ]
    }
  },

  computed: {
    currentSectionTitle () {
      const current = this.links.find(link => link.path === this.$route.path)
      return current ? `管理设置 / ${current.title}` : '管理设置'
    },
    compactSectionTitle () {
      const current = this.links.find(link => link.path === this.$route.path)
      return current ? current.title : '管理设置'
    }
  },

  watch: {
    '$route.path' (path) {
      if (path !== '/admin/setup') this.ensureSetupRoute()
    }
  },

  methods: {
    async ensureSetupRoute () {
      try {
        const response = await this.$axios.get('/api/config/admin/setup-status')
        if (!response.data.completed && this.$route.path !== '/admin/setup') {
          await this.$router.replace('/admin/setup')
        }
      } catch (_) {}
    },
    readSharedConfig () {
      this.$axios.get('/api/config/shared').then((response) => {
        const defaults = response.data.sharedConfig || {}
        if (!hasSavedColorScheme() && Object.values(COLOR_SCHEMES).includes(defaults.colorScheme)) {
          applyColorScheme(defaults.colorScheme, { persist: false })
        }
        if (!hasSavedAccentColor() && normalizeAccentColor(defaults.accentColor)) {
          applyAccentColor(defaults.accentColor, { persist: false })
        }
      }).catch(() => {})
    },
    onSocketSuccess (payload) {
      this.showSuccNotif(payload.message)
      if (payload.auth) {
        this.$store.commit('User/INIT', payload.user)
        this.$store.commit('User/SET_AUTH', payload.auth)
        this.$store.commit('User/SET_CAN_MANAGE', payload.canManage)
      }
    },
    onSocketError (err) {
      this.showWarnNotif(err.message || err)
      this.$socket.close()
      this.$router.push('/login')
    }
  },

  created () {
    applyColorScheme(readColorScheme(), { persist: false })
    this.readSharedConfig()
    this.ensureSetupRoute()
    this.$socket.on('success', this.onSocketSuccess)
    this.$socket.on('error', this.onSocketError)
    if (!this.$socket.connected) {
      this.$socket.open()
    }
  },

  beforeUnmount () {
    this.$socket.removeListener('success', this.onSocketSuccess)
    this.$socket.removeListener('error', this.onSocketError)
  }
}
</script>

<style lang="scss">
.admin-toolbar-title { display: flex; align-items: baseline; min-width: 0; }
.admin-toolbar-divider { align-self: center; width: 1px; height: 20px; margin: 0 14px; background: rgba(255, 255, 255, .42); }
.admin-toolbar-section { flex: 1 1 auto; min-width: 0; overflow: hidden; font-size: 15px; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
.admin-drawer { background: #fff; }
.body--dark .admin-drawer { background: #1d1d1d; }
.admin-drawer-content { display: flex; flex-direction: column; height: 100%; }
.admin-drawer-primary { padding-top: 12px; }
.admin-drawer-secondary { margin-top: auto; padding-bottom: 18px; }
.admin-drawer .q-item { min-height: 48px; }
.admin-drawer .q-item__section--avatar { min-width: 40px; }
.admin-page-container { min-height: 100vh; background: #f4f6f8; }
.body--dark .admin-page-container { background: #121212; }
.admin-page { width: 100%; max-width: 1120px; margin: 0 auto; padding: 24px; }
.admin-page .q-card.q-ma-md { margin: 0 0 16px; overflow: hidden; border: 1px solid rgba(0, 0, 0, .08); border-radius: 6px; box-shadow: 0 2px 8px rgba(22, 32, 44, .07); }
.body--dark .admin-page .q-card.q-ma-md { border-color: rgba(255, 255, 255, .1); box-shadow: 0 2px 10px rgba(0, 0, 0, .2); }
.admin-page .q-toolbar { min-height: 52px; }
.admin-page .q-toolbar__title { font-size: 1.1rem; font-weight: 500; letter-spacing: 0; }
.admin-page .q-list > .q-item + .q-item { border-top: 1px solid rgba(0, 0, 0, .08); }
.body--dark .admin-page .q-list > .q-item + .q-item { border-color: rgba(255, 255, 255, .1); }
.admin-page .q-item__label--caption { overflow-wrap: anywhere; }
.admin-page .q-field__native, .admin-page .q-field__input { letter-spacing: 0; }
.admin-page--with-fixed-actions { padding-bottom: 112px; }
.admin-page-actions {
  position: fixed;
  right: max(24px, calc((100vw - 56px - 1120px) / 2 + 24px));
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 2000;
  margin: 0;
  padding: 8px;
  border: 1px solid rgba(0, 0, 0, .1);
  border-radius: 6px;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 6px 18px rgba(22, 32, 44, .18);
  backdrop-filter: blur(10px);
}
.admin-page-actions .q-btn { min-width: 116px; }
.body--dark .admin-page-actions { border-color: rgba(255, 255, 255, .14); background: rgba(29, 29, 29, .92); box-shadow: 0 6px 18px rgba(0, 0, 0, .36); }

@media (max-width: 599px) {
  .admin-toolbar-divider { margin: 0 10px; }
  .admin-toolbar-section { font-size: 14px; }
  .admin-page { padding: 12px; }
  .admin-page--with-fixed-actions { padding-bottom: 92px; }
  .admin-page .q-toolbar__title { padding: 10px 0; line-height: 1.35; white-space: normal; }
  .admin-page-actions { right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); left: 12px; }
  .admin-page-actions .q-btn { width: 100%; }
}
</style>
