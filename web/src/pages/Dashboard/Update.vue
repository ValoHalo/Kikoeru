<template>
  <q-page class="admin-page update-page">
    <div class="update-heading row items-start q-col-gutter-md">
      <div class="col">
        <div class="text-h5">更新</div>
        <div class="text-caption text-grey-7">当前版本 {{ status.currentVersion || '—' }}</div>
      </div>
      <div class="col-auto">
        <q-btn outline color="primary" icon="refresh" label="检查更新" :loading="checking" @click="checkUpdate" />
      </div>
    </div>

    <section class="update-section" aria-labelledby="update-status-title">
      <div class="section-heading">
        <q-icon name="system_update_alt" size="22px" />
        <div>
          <div id="update-status-title" class="text-subtitle1 text-weight-medium">版本状态</div>
          <div class="text-caption text-grey-7">{{ installKindLabel }}</div>
        </div>
      </div>

      <q-banner v-if="status.error" rounded class="bg-red-1 text-negative q-mb-md">
        <template #avatar><q-icon name="error_outline" /></template>
        {{ status.error }}
      </q-banner>
      <q-banner v-else-if="status.lastResult" rounded class="bg-green-1 text-positive q-mb-md">
        <template #avatar><q-icon name="check_circle" /></template>
        {{ lastResultText }}
      </q-banner>

      <q-list bordered separator class="update-list">
        <q-item>
          <q-item-section>
            <q-item-label>已安装版本</q-item-label>
            <q-item-label caption>{{ status.currentVersion || '读取中' }}</q-item-label>
          </q-item-section>
          <q-item-section side><q-badge color="grey-7" :label="status.currentVersion || '—'" /></q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            <q-item-label>最新版本</q-item-label>
            <q-item-label caption>{{ releaseCaption }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row items-center q-gutter-sm">
              <q-badge :color="status.updateAvailable ? 'primary' : 'positive'" :label="latestVersionLabel" />
              <q-btn v-if="status.release && status.release.url" flat round dense icon="open_in_new" type="a" target="_blank" :href="status.release.url" aria-label="查看发布说明"><q-tooltip>查看发布说明</q-tooltip></q-btn>
            </div>
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            <q-item-label>更新状态</q-item-label>
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

      <q-banner v-if="!status.installSupported && status.installUnsupportedReason" rounded class="bg-grey-2 text-grey-8 q-mt-md">
        <template #avatar><q-icon name="info" /></template>
        {{ status.installUnsupportedReason }}
      </q-banner>

      <div class="row q-gutter-sm q-mt-md">
        <q-btn v-if="status.phase !== 'downloading'" color="primary" icon="download" label="下载更新" :disable="!canDownload" @click="downloadUpdate" />
        <q-btn v-else outline color="negative" icon="cancel" label="取消下载" @click="cancelDownload" />
        <q-btn color="positive" icon="restart_alt" label="安装并重启" :disable="!canInstall" @click="confirmInstall" />
      </div>
    </section>

    <section class="update-section" aria-labelledby="update-settings-title">
      <div class="section-heading">
        <q-icon name="tune" size="22px" />
        <div id="update-settings-title" class="text-subtitle1 text-weight-medium">更新设置</div>
      </div>
      <q-list bordered separator class="update-list">
        <q-item tag="label">
          <q-item-section><q-item-label>自动检查更新</q-item-label></q-item-section>
          <q-item-section side><q-toggle v-model="settings.checkUpdate" color="primary" /></q-item-section>
        </q-item>
        <q-item tag="label" :disable="!settings.checkUpdate">
          <q-item-section><q-item-label>包含测试版</q-item-label></q-item-section>
          <q-item-section side><q-toggle v-model="settings.checkBetaUpdate" color="primary" :disable="!settings.checkUpdate" /></q-item-section>
        </q-item>
        <q-item tag="label" :disable="!settings.checkUpdate">
          <q-item-section>
            <q-item-label>自动下载更新</q-item-label>
            <q-item-label caption>下载完成后仍需管理员确认安装</q-item-label>
          </q-item-section>
          <q-item-section side><q-toggle v-model="settings.autoDownloadUpdate" color="primary" :disable="!settings.checkUpdate || !status.downloadSupported" /></q-item-section>
        </q-item>
      </q-list>
      <div class="row justify-end q-mt-md">
        <q-btn color="primary" icon="save" label="保存更新设置" :loading="saving" @click="saveSettings" />
      </div>
    </section>
  </q-page>
</template>

<script>
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
        'windows-portable': 'Windows x64 便携版',
        'linux-portable': 'Linux x64 便携版',
        container: 'Docker / Podman 容器',
        source: '源码运行'
      })[this.status.installKind] || this.status.installKind
    },
    latestVersionLabel () {
      if (!this.status.release) return '尚未检查'
      return this.status.release.version
    },
    releaseCaption () {
      if (!this.status.release) return '点击检查更新读取 GitHub Release'
      const parts = []
      if (this.status.release.publishedAt) parts.push(this.formatDate(this.status.release.publishedAt))
      if (this.status.release.asset) parts.push(this.formatBytes(this.status.release.asset.size))
      return parts.join(' · ') || this.status.release.name
    },
    phaseLabel () {
      return ({ idle: this.status.updateAvailable ? '发现可用更新' : '无需更新', checking: '正在检查', downloading: '正在下载', ready: '已下载，等待安装', installing: '正在准备重启', error: '更新操作失败' })[this.status.phase] || this.status.phase
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
        ? `更新启动失败，已恢复 ${result.fromVersion}`
        : `已从 ${result.fromVersion} 更新到 ${result.targetVersion}`
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
    formatDate (value) { return new Date(value).toLocaleString() },
    async loadStatus (quiet = false) {
      try {
        const response = await this.$axios.get('/api/update/status')
        this.status = response.data
        if (!this.settingsLoaded && response.data.settings) {
          this.settings = { ...this.settings, ...response.data.settings }
          this.settingsLoaded = true
        }
      } catch (error) {
        if (!quiet) this.showErrNotif(this.errorMessage(error, '读取更新状态失败'))
      }
    },
    async checkUpdate () {
      this.checking = true
      try {
        const response = await this.$axios.post('/api/update/check')
        this.status = response.data
      } catch (error) { this.showErrNotif(this.errorMessage(error, '检查更新失败')) }
      finally { this.checking = false }
    },
    async downloadUpdate () {
      try {
        const response = await this.$axios.post('/api/update/download')
        this.status = response.data
      } catch (error) { this.showErrNotif(this.errorMessage(error, '开始下载更新失败')) }
    },
    async cancelDownload () {
      try { await this.$axios.delete('/api/update/download'); await this.loadStatus(true) }
      catch (error) { this.showErrNotif(this.errorMessage(error, '取消下载失败')) }
    },
    confirmInstall () {
      this.$q.dialog({
        title: '安装更新并重启',
        message: '服务重启会中断当前播放。扫描任务运行时不会开始安装。',
        cancel: '取消',
        ok: { label: '安装并重启', color: 'positive' }
      }).onOk(() => this.installUpdate())
    },
    async installUpdate () {
      try {
        const response = await this.$axios.post('/api/update/install')
        this.status = response.data
        this.showSuccNotif('更新安装即将开始，服务会自动重启')
      } catch (error) { this.showErrNotif(this.errorMessage(error, '安装更新失败')) }
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
        this.showSuccNotif('更新设置已保存')
        await this.loadStatus(true)
      } catch (error) { this.showErrNotif(this.errorMessage(error, '保存更新设置失败')) }
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
.update-page { max-width: 920px; }
.update-heading { margin: 8px 0 24px; }
.update-section { margin-bottom: 28px; }
.section-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.update-list { border-radius: 6px; }
@media (max-width: 599px) {
  .update-heading { align-items: stretch; }
  .update-heading > .col-auto { width: 100%; }
  .update-heading .q-btn { width: 100%; }
}
</style>
