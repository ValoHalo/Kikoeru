<template>
  <q-layout view="hHh Lpr lFf">
    <AppHeader :title="compactSectionTitle" :parent="$t('common.administration')" parent-to="/admin" @toggle-drawer="drawerOpen = !drawerOpen" />

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
      <q-scroll-area class="fit" :content-style="{ top: '0', bottom: '0', width: '100%' }" :content-active-style="{ top: '0', bottom: '0', width: '100%' }">
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
              <q-item-section><q-item-label class="text-subtitle1">{{ $t('dashboardLayout.home') }}</q-item-label></q-item-section>
              <q-tooltip v-if="drawerMini" anchor="center right" self="center left" :offset="[10, 0]">{{ $t('dashboardLayout.home') }}</q-tooltip>
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
import { applyDefaultLocale, t } from '../i18n'
import NotifyMixin from '../mixins/Notification.js'
import AppHeader from 'components/AppHeader.vue'
import { applyColorScheme, COLOR_SCHEMES, hasSavedColorScheme, readColorScheme } from '../colorScheme'
import { applyAccentColor, hasSavedAccentColor, normalizeAccentColor } from '../themeColor'

export default {
  name: 'DashboardLayout',
  components: { AppHeader },

  mixins: [NotifyMixin],

  data () {
    return {
      drawerOpen: false,
      drawerMini: true,
    }
  },

  computed: {
    links () {
      return [
        {
          title: t('dashboardLayout.folders'),
          icon: 'folder',
          path: '/admin'
        },
        {
          title: t('dashboardLayout.users'),
          icon: 'person',
          path: '/admin/usermanage'
        },
        {
          title: t('dashboardLayout.defaults'),
          icon: 'tune',
          path: '/admin/defaults'
        },
        {
          title: t('dashboardLayout.advanced'),
          icon: 'settings',
          path: '/admin/advanced'
        },
        {
          title: t('common.update'),
          icon: 'system_update_alt',
          path: '/admin/update'
        }
      ]
    },
    compactSectionTitle () {
      if (this.$route.path === '/admin/setup') return t('dashboardLayout.setup')
      const current = this.links.find(link => link.path === this.$route.path)
      return current ? current.title : t('common.administration')
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
      } catch (_) {
        // Keep the current route if the setup status is unavailable.
      }
    },
    readSharedConfig () {
      this.$axios.get('/api/config/shared').then((response) => {
        const defaults = response.data.sharedConfig || {}
        applyDefaultLocale(defaults.interfaceLanguage)
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
@use '../css/admin-management';

.admin-drawer { background: #fff; }
.body--dark .admin-drawer { background: #1d1d1d; }
.admin-drawer-content { display: flex; flex-direction: column; height: 100%; }
.admin-drawer-primary { padding-top: 12px; }
.admin-drawer-secondary { margin-top: auto; padding-bottom: 18px; }
.admin-drawer .q-item { min-height: 48px; }
.admin-drawer .q-item__section--avatar { min-width: 40px; }
.admin-page-container { min-height: 100vh; background: #f4f6f8; }
.body--dark .admin-page-container { background: #121212; }
</style>
