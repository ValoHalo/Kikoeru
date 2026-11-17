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
      class="admin-drawer overflow-hidden"
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
              <AppTooltip v-if="drawerMini" anchor="center right" self="center left" :offset="[10, 0]">{{ link.title }}</AppTooltip>
            </q-item>
          </q-list>

          <q-list padding class="admin-drawer-secondary">
            <q-item clickable v-ripple exact to="/" active-class="text-primary text-weight-medium">
              <q-item-section avatar><q-icon name="home" /></q-item-section>
              <q-item-section><q-item-label class="text-subtitle1">{{ $t('dashboardLayout.home') }}</q-item-label></q-item-section>
              <AppTooltip v-if="drawerMini" anchor="center right" self="center left" :offset="[10, 0]">{{ $t('dashboardLayout.home') }}</AppTooltip>
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
          title: t('dataTransfer.title'),
          icon: 'import_export',
          path: '/admin/data'
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

.admin-drawer { background: var(--kikoeru-surface); }
@media (min-width: 501px) {
  .q-drawer:has(> .admin-drawer) { transition: width .18s ease; }
}
.admin-drawer .q-item__label { white-space: nowrap; }
.admin-drawer-content { display: flex; flex-direction: column; height: 100%; }
.admin-drawer-primary { padding-top: 8px; }
.admin-drawer-secondary { margin-top: auto; padding-bottom: 12px; }
.admin-drawer .q-item {
  min-height: 44px;
  margin: 1px 0;
  position: relative;
  transition: color .16s ease;
}
.admin-drawer .q-item::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 8px;
  right: 8px;
  border-radius: var(--kikoeru-radius-sm);
  background: transparent;
  transition: background-color .16s ease;
}
.admin-drawer .q-item > .q-focus-helper,
.admin-drawer .q-item > .q-ripple {
  clip-path: inset(0 8px round var(--kikoeru-radius-sm));
}
.admin-drawer .q-item .q-item__section { position: relative; z-index: 1; }
.admin-drawer .q-item:hover::before { background: var(--kikoeru-inset); }
.admin-drawer .q-item.q-router-link--active,
.admin-drawer .q-item.q-router-link--exact-active { color: var(--kikoeru-accent-text); }
.admin-drawer .q-item.q-router-link--active::before,
.admin-drawer .q-item.q-router-link--exact-active::before { background: var(--kikoeru-active-bg); }
.admin-drawer .q-item.q-router-link--active .q-icon,
.admin-drawer .q-item.q-router-link--exact-active .q-icon { color: var(--kikoeru-accent-text); }
.q-drawer-container .q-drawer--mini .admin-drawer .admin-drawer-content .q-item {
  margin: 1px 0;
  padding-left: 16px;
  padding-right: 16px;
  justify-content: flex-start;
}
.q-drawer-container .q-drawer--mini .admin-drawer .admin-drawer-content .q-item__section--avatar {
  min-width: 40px;
  text-align: left;
}
.admin-drawer .q-item__section--avatar { min-width: 40px; }
.admin-page-container { min-height: 100vh; background: var(--kikoeru-page-bg); }
</style>
