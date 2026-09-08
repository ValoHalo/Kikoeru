<template>
  <q-page class="admin-page update-page">
    <header class="settings-heading">
      <div>
        <h1>{{ $t('common.update') }}</h1>
        <div class="text-caption text-grey-7">{{ $t('update.currentVersion', { value: status.currentVersion || '—' }) }}</div>
      </div>
      <q-btn outline no-caps class="settings-action-button" color="primary" icon="refresh" :label="$t('update.check')" :loading="checking" @click="checkUpdate" />
    </header>

    <section class="settings-section" aria-labelledby="update-status-title">
      <div class="settings-section__heading">
        <q-icon name="system_update_alt" size="22px" />
        <div>
          <h2 id="update-status-title">{{ $t('update.status') }}</h2>
          <div class="text-caption text-grey-7">{{ installKindLabel }}</div>
        </div>
      </div>

      <q-banner v-if="status.error" rounded class="update-notice update-notice--error q-mb-md">
        <template #avatar><q-icon name="error_outline" /></template>
        {{ status.error }}
      </q-banner>
      <q-banner v-else-if="status.lastResult" rounded class="update-notice update-notice--success q-mb-md">
        <template #avatar><q-icon name="check_circle" /></template>
        {{ lastResultText }}
      </q-banner>

      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('update.installedVersion') }}</q-item-label>
            <q-item-label caption>{{ status.currentVersion || $t('common.loading') }}</q-item-label>
          </q-item-section>
          <q-item-section side><q-badge color="grey-7" :label="status.currentVersion || '—'" /></q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('update.latestVersion') }}</q-item-label>
            <q-item-label caption>{{ releaseCaption }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row items-center q-gutter-sm">
              <q-badge :color="status.updateAvailable ? 'primary' : 'positive'" :label="latestVersionLabel" />
              <q-btn v-if="status.release && status.release.url" flat round dense icon="open_in_new" type="a" target="_blank" :href="status.release.url" :aria-label="$t('update.releaseNotes')"><q-tooltip>{{ $t('update.releaseNotes') }}</q-tooltip></q-btn>
            </div>
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('update.updateStatus') }}</q-item-label>
            <q-item-label caption>{{ phaseLabel }}</q-item-label>
          </q-item-section>
          <q-item-section side><q-icon :name="phaseIcon" :color="phaseColor" size="24px" /></q-item-section>
        </q-item>
      </q-list>

      <div v-if="status.phase === 'downloading' || status.phase === 'ready'" class="q-mt-md">
        <div class="row justify-between text-caption q-mb-xs">
          <span>{{ status.release && status.release.asset ? status.release.asset.name : status.targetVersion }}</span>
          <span>{{ downloadProgressText }}</span>
        </div>
        <q-linear-progress rounded size="8px" color="primary" :value="downloadProgress" :indeterminate="!status.totalBytes" />
      </div>

      <q-banner v-if="!status.installSupported && status.installUnsupportedReason" rounded class="update-notice q-mt-md">
        <template #avatar><q-icon name="info" /></template>
        {{ status.installUnsupportedReason }}
      </q-banner>

      <div class="settings-form-actions update-actions">
        <q-btn v-if="status.phase !== 'downloading'" unelevated no-caps color="primary" icon="download" :label="$t('update.download')" :disable="!canDownload" @click="downloadUpdate" />
        <q-btn v-else outline no-caps color="negative" icon="cancel" :label="$t('update.cancelDownload')" @click="cancelDownload" />
        <q-btn outline no-caps color="positive" icon="restart_alt" :label="$t('update.install')" :disable="!canInstall" @click="confirmInstall" />
      </div>
    </section>

    <section class="settings-section" aria-labelledby="update-settings-title">
      <div class="settings-section__heading">
        <q-icon name="tune" size="22px" />
        <h2 id="update-settings-title">{{ $t('update.settings') }}</h2>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item tag="label">
          <q-item-section><q-item-label>{{ $t('update.autoCheck') }}</q-item-label></q-item-section>
          <q-item-section side><q-toggle v-model="settings.checkUpdate" color="primary" /></q-item-section>
        </q-item>
        <q-item tag="label" :disable="!settings.checkUpdate">
          <q-item-section><q-item-label>{{ $t('update.includeBeta') }}</q-item-label></q-item-section>
          <q-item-section side><q-toggle v-model="settings.checkBetaUpdate" color="primary" :disable="!settings.checkUpdate" /></q-item-section>
        </q-item>
        <q-item tag="label" :disable="!settings.checkUpdate">
          <q-item-section>
            <q-item-label>{{ $t('update.autoDownload') }}</q-item-label>
            <q-item-label caption>{{ $t('update.autoDownloadHint') }}</q-item-label>
          </q-item-section>
          <q-item-section side><q-toggle v-model="settings.autoDownloadUpdate" color="primary" :disable="!settings.checkUpdate || !status.downloadSupported" /></q-item-section>
        </q-item>
      </q-list>
      <div class="settings-form-actions">
        <q-btn unelevated no-caps color="primary" icon="save" :label="$t('update.saveSettings')" :loading="saving" @click="saveSettings" />
      </div>
    </section>
  </q-page>
</template>

<script>
import { t } from '../../i18n'
import NotifyMixin from '../../mixins/Notification.js'

export default {
  name: 'Update',
  mixins: [NotifyMixin],
  data () {
    return {
      status: {
        currentVersion: '', installKind: 'source', installSupported: false, downloadSupported: false,
        updateAvailable: null, release: null, phase: 'idle', downloadedBytes: 0,
        totalBytes: 0, targetVersion: null, error: null, lastResult: null
      },
      settings: { checkUpdate: true, checkBetaUpdate: false, autoDownloadUpdate: false },
      settingsLoaded: false,
      checking: false,
      saving: false,
      pollTimer: null
    }
  },
  computed: {
    installKindLabel () {
      return ({
        'windows-portable': t('update.windowsPortable'),
        'linux-portable': t('update.linuxPortable'),
        container: t('update.container'),
        source: t('update.source')
      })[this.status.installKind] || this.status.installKind
    },
    latestVersionLabel () {
      if (!this.status.release) return t('update.notChecked')
      return this.status.release.version
    },
    releaseCaption () {
      if (!this.status.release) return t('update.checkHint')
      const parts = []
      if (this.status.release.publishedAt) parts.push(this.formatDate(this.status.release.publishedAt))
      if (this.status.release.asset) parts.push(this.formatBytes(this.status.release.asset.size))
      return parts.join(' · ') || this.status.release.name
    },
    phaseLabel () {
      return ({ idle: this.status.updateAvailable ? t('update.available') : t('update.upToDate'), checking: t('update.checking'), downloading: t('update.downloading'), ready: t('update.ready'), installing: t('update.installing'), error: t('update.failed') })[this.status.phase] || this.status.phase
    },
    phaseIcon () {
      return ({ idle: this.status.updateAvailable ? 'new_releases' : 'check_circle', checking: 'sync', downloading: 'downloading', ready: 'download_done', installing: 'restart_alt', error: 'error' })[this.status.phase] || 'info'
    },
    phaseColor () { return this.status.phase === 'error' ? 'negative' : this.status.updateAvailable ? 'primary' : 'positive' },
    downloadProgress () { return this.status.totalBytes ? Math.min(1, this.status.downloadedBytes / this.status.totalBytes) : 0 },
    downloadProgressText () { return `${this.formatBytes(this.status.downloadedBytes)} / ${this.formatBytes(this.status.totalBytes)}` },
    canDownload () { return Boolean(this.status.downloadSupported && this.status.updateAvailable && this.status.release && this.status.release.asset && !['checking', 'ready', 'installing'].includes(this.status.phase)) },
    canInstall () { return this.status.phase === 'ready' && this.status.installSupported },
    lastResultText () {
      const result = this.status.lastResult
      if (!result) return ''
      return result.status === 'rolled-back'
        ? t('update.rollbackResult', { fromVersion: result.fromVersion })
        : t('update.installedResult', { fromVersion: result.fromVersion, targetVersion: result.targetVersion })
    }
  },
  methods: {
    errorMessage (error, fallback) { return error.response && error.response.data && error.response.data.error ? error.response.data.error : error.message || fallback },
    formatBytes (bytes) {
      const value = Number(bytes) || 0
      if (value < 1024) return `${value} B`
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
      return `${(value / 1024 / 1024).toFixed(1)} MiB`
    },
    formatDate (value) { return new Date(value).toLocaleString(this.$i18n.locale) },
    async loadStatus (quiet = false) {
      try {
        const response = await this.$axios.get('/api/update/status')
        this.status = response.data
        if (!this.settingsLoaded && response.data.settings) {
          this.settings = { ...this.settings, ...response.data.settings }
          this.settingsLoaded = true
        }
      } catch (error) {
        if (!quiet) this.showErrNotif(this.errorMessage(error, t('update.loadFailed')))
      }
    },
    async checkUpdate () {
      this.checking = true
      try {
        const response = await this.$axios.post('/api/update/check')
        this.status = response.data
      } catch (error) { this.showErrNotif(this.errorMessage(error, t('update.checkFailed'))) }
      finally { this.checking = false }
    },
    async downloadUpdate () {
      try {
        const response = await this.$axios.post('/api/update/download')
        this.status = response.data
      } catch (error) { this.showErrNotif(this.errorMessage(error, t('update.downloadFailed'))) }
    },
    async cancelDownload () {
      try { await this.$axios.delete('/api/update/download'); await this.loadStatus(true) }
      catch (error) { this.showErrNotif(this.errorMessage(error, t('update.cancelFailed'))) }
    },
    confirmInstall () {
      this.$q.dialog({
        title: t('update.installTitle'),
        message: t('update.installPrompt'),
        cancel: t('common.cancel'),
        ok: { label: t('update.install'), color: 'positive' }
      }).onOk(() => this.installUpdate())
    },
    async installUpdate () {
      try {
        const response = await this.$axios.post('/api/update/install')
        this.status = response.data
        this.showSuccNotif(t('update.installingSoon'))
      } catch (error) { this.showErrNotif(this.errorMessage(error, t('update.installFailed'))) }
    },
    async saveSettings () {
      this.saving = true
      try {
        if (!this.settings.checkUpdate) {
          this.settings.checkBetaUpdate = false
          this.settings.autoDownloadUpdate = false
        }
        if (!this.status.downloadSupported) this.settings.autoDownloadUpdate = false
        await this.$axios.put('/api/config/admin', { config: this.settings })
        this.showSuccNotif(t('update.settingsSaved'))
        await this.loadStatus(true)
      } catch (error) { this.showErrNotif(this.errorMessage(error, t('update.saveFailed'))) }
      finally { this.saving = false }
    }
  },
  mounted () {
    this.loadStatus()
    this.pollTimer = setInterval(() => this.loadStatus(true), 1500)
  },
  beforeUnmount () { clearInterval(this.pollTimer) }
}
</script>

<style scoped>
.update-page .update-actions { justify-content: flex-start; }
.update-notice { border: 1px solid var(--admin-border); border-radius: 6px; background: var(--admin-control-bg); overflow-wrap: anywhere; }
.update-notice--error { color: #b71c1c; }
.update-notice--success { color: #216e39; }
.body--dark .update-notice--error { color: #ff7b86; }
.body--dark .update-notice--success { color: #81c995; }
</style>
