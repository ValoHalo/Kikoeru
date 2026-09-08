<template>
  <q-page class="admin-page setup-page">
    <InterfaceLanguage :label="$t('common.interfaceLanguage')" class="q-mb-md" />
    <header class="settings-heading">
      <div>
        <h1>{{ $t('setup.title') }}</h1>
        <div class="text-caption text-grey-7">{{ $t('setup.description') }}</div>
      </div>
    </header>

    <q-stepper v-model="step" vertical color="primary" animated flat bordered>
      <q-step :name="1" :title="$t('setup.addMediaFolder')" icon="folder" :done="step > 1">
        <q-list v-if="config.rootFolders.length" bordered separator class="settings-list q-mb-md">
          <q-item v-for="(folder, index) in config.rootFolders" :key="`${folder.name}-${folder.path}`">
            <q-item-section>
              <q-item-label>{{ folder.name }}</q-item-label>
              <q-item-label caption>{{ folder.path }}</q-item-label>
              <q-item-label v-if="folder.workCount !== undefined" caption>{{ $t('setup.detectedFolders', { count: folder.workCount }) }}<span v-if="folder.unreadableCount">{{ $t('setup.unreadableFolders', { count: folder.unreadableCount }) }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat round dense icon="delete" color="negative" :aria-label="$t('setup.removeFolder')" @click="removeFolder(index)" />
            </q-item-section>
          </q-item>
        </q-list>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4"><q-input v-model.trim="folder.name" outlined dense :label="$t('setup.folderName')" /></div>
          <div class="col-12 col-sm-8"><q-input v-model.trim="folder.path" outlined dense :label="$t('setup.absolutePath')" /></div>
        </div>
        <div class="setup-step-actions row justify-between q-mt-md">
          <q-btn no-caps class="settings-action-button" outline color="primary" icon="playlist_add" :label="$t('setup.checkAndAdd')" :loading="folderChecking" @click="checkAndAddFolder" />
          <q-btn no-caps class="settings-action-button" unelevated color="primary" icon-right="navigate_next" :label="$t('common.next')" :disable="config.rootFolders.length === 0" @click="step = 2" />
        </div>
      </q-step>

      <q-step :name="2" :title="$t('setup.networkMode')" icon="lan" :done="step > 2">
        <div class="settings-control">
          <q-btn-toggle
            v-model="config.httpProxyMode"
            spread
            unelevated
            no-caps
            toggle-color="primary"
            :options="proxyModeOptions"
          />
        </div>
        <div v-if="config.httpProxyMode === 'environment'" class="text-caption text-grey-7 q-mt-md">{{ $t('setup.environmentHint') }}</div>
        <div v-if="config.httpProxyMode === 'manual'" class="row q-col-gutter-md q-mt-sm">
          <div class="col-12 col-sm-7"><q-input v-model.trim="config.httpProxyHost" outlined dense :label="$t('setup.proxyHost')" :hint="$t('setup.proxyHostHint')" /></div>
          <div class="col-12 col-sm-5"><q-input v-model.number="config.httpProxyPort" outlined dense type="number" min="1" max="65535" :label="$t('setup.proxyPort')" /></div>
        </div>
        <q-stepper-navigation class="row justify-between">
          <q-btn no-caps class="settings-action-button" flat color="primary" icon="navigate_before" :label="$t('common.previous')" @click="step = 1" />
          <q-btn no-caps class="settings-action-button" unelevated color="primary" icon-right="navigate_next" :label="$t('common.next')" :disable="!networkConfigValid" @click="step = 3" />
        </q-stepper-navigation>
      </q-step>

      <q-step :name="3" :title="$t('setup.networkTest')" icon="network_check" :done="step > 3">
        <q-btn no-caps class="settings-action-button" outline color="primary" icon="network_check" :label="$t('setup.startTest')" :loading="networkTesting" @click="testNetwork" />
        <q-list v-if="networkResults.length" bordered separator class="settings-list q-mt-md">
          <q-item v-for="result in networkResults" :key="result.key">
            <q-item-section avatar>
              <q-icon :name="result.ok ? 'check_circle' : 'error'" :color="result.ok ? 'positive' : 'negative'" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $t('network.' + result.key) }}</q-item-label>
              <q-item-label caption>{{ networkResultText(result) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <q-stepper-navigation class="row justify-between">
          <q-btn no-caps class="settings-action-button" flat color="primary" icon="navigate_before" :label="$t('common.previous')" @click="step = 2" />
          <q-btn no-caps class="settings-action-button" unelevated color="primary" icon-right="navigate_next" :label="$t('common.next')" @click="step = 4" />
        </q-stepper-navigation>
      </q-step>

      <q-step :name="4" :title="$t('setup.defaultPlayback')" icon="headphones">
        <q-option-group v-model="config.transcodeOption" :options="transcodeOptions" color="primary" />
        <div class="text-caption text-grey-7 q-mt-sm">{{ $t('setup.transcodeHint') }}</div>
        <q-stepper-navigation class="row justify-between">
          <q-btn no-caps class="settings-action-button" flat color="primary" icon="navigate_before" :label="$t('common.previous')" @click="step = 3" />
          <q-btn no-caps class="settings-action-button" unelevated color="primary" icon="done" :label="$t('setup.saveAndScan')" :loading="saving" @click="completeSetup" />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>
  </q-page>
</template>

<script>
import { t } from '../../i18n'
import NotifyMixin from '../../mixins/Notification.js'
import InterfaceLanguage from '../../components/InterfaceLanguage.vue'

export default {
  name: 'Setup',
  components: { InterfaceLanguage },
  mixins: [NotifyMixin],
  data () {
    return {
      step: 1,
      saving: false,
      folderChecking: false,
      networkTesting: false,
      networkResults: [],
      folder: { name: 'VoiceWork', path: '' },
      config: {
        rootFolders: [],
        httpProxyMode: 'direct',
        httpProxyHost: '',
        httpProxyPort: 0,
        transcodeOption: 'off'
      },

    }
  },
  computed: {
    proxyModeOptions () {
      return [
        { label: t('setup.direct'), value: 'direct' },
        { label: t('setup.environment'), value: 'environment' },
        { label: t('setup.manual'), value: 'manual' }
      ]
    },
    transcodeOptions () {
      return [
        { label: t('setup.originalAudio'), value: 'off' },
        { label: 'AAC 128k', value: 'aac 128' },
        { label: 'AAC 320k', value: 'aac 320' }
      ]
    },
    networkConfigValid () {
      if (this.config.httpProxyMode !== 'manual') return true
      const port = Number(this.config.httpProxyPort)
      return Number.isInteger(port) && port >= 1 && port <= 65535
    }
  },
  methods: {
    async loadConfig () {
      try {
        const response = await this.$axios.get('/api/config/admin')
        const current = response.data.config || {}
        this.config = {
          ...this.config,
          rootFolders: Array.isArray(current.rootFolders) ? current.rootFolders.map(item => ({ ...item })) : [],
          httpProxyMode: current.httpProxyMode || (Number(current.httpProxyPort) > 0 ? 'manual' : 'direct'),
          httpProxyHost: current.httpProxyHost || '',
          httpProxyPort: Number(current.httpProxyPort) || 0,
          transcodeOption: current.transcodeOption || 'off'
        }
        this.folder.path = current.voiceWorkDefaultPath || ''
      } catch (error) {
        this.showErrNotif((error.response && error.response.data.error) || error.message || error)
      }
    },
    async checkAndAddFolder () {
      if (!this.folder.name || !this.folder.path) {
        this.showWarnNotif(t('setup.folderRequired'))
        return
      }
      if (this.config.rootFolders.some(item => item.name === this.folder.name)) {
        this.showWarnNotif(t('setup.duplicateFolder'))
        return
      }
      this.folderChecking = true
      try {
        const response = await this.$axios.post('/api/config/admin/validate-root-folder', { rootFolder: this.folder })
        this.config.rootFolders.push(response.data.rootFolder)
        this.folder = { name: '', path: '' }
      } catch (error) {
        this.showErrNotif((error.response && error.response.data.error) || error.message || error)
      } finally {
        this.folderChecking = false
      }
    },
    removeFolder (index) {
      this.config.rootFolders.splice(index, 1)
    },
    async testNetwork () {
      this.networkTesting = true
      this.networkResults = []
      try {
        const response = await this.$axios.post('/api/config/admin/network-test', { config: this.config })
        this.networkResults = response.data.results || []
      } catch (error) {
        this.showErrNotif((error.response && error.response.data.error) || error.message || error)
      } finally {
        this.networkTesting = false
      }
    },
    networkResultText (result) {
      if (result.ok) return t('setup.networkSuccess', { status: result.status, duration: result.durationMs })
      return t('setup.networkFailure', { error: result.error || t('setup.connectionFailed'), duration: result.durationMs })
    },
    async completeSetup () {
      this.saving = true
      try {
        const response = await this.$axios.post('/api/config/admin/complete-setup', { config: this.config })
        this.showSuccNotif(response.data.message)
        await this.$router.replace('/admin#scanner')
      } catch (error) {
        this.showErrNotif((error.response && error.response.data.error) || error.message || error)
      } finally {
        this.saving = false
      }
    }
  },
  created () {
    this.loadConfig()
  }
}
</script>

<style scoped>
.setup-page :deep(.q-stepper) { border-radius: 6px; border-color: var(--admin-border); background: var(--admin-surface); }
.setup-page :deep(.q-stepper__step-inner) { padding-right: 24px; }
.setup-page :deep(.q-stepper__nav), .setup-step-actions { display: flex; flex-wrap: wrap; gap: 12px; }
@media (max-width: 599px) {
  .setup-page :deep(.q-stepper__step-inner) { padding-right: 12px; padding-left: 48px; }
  .setup-page .settings-control :deep(.q-btn-toggle .q-btn) { padding-right: 4px; padding-left: 4px; }
}
</style>
