<template>
  <q-page class="admin-page setup-page">
    <div class="setup-heading">
      <div class="text-h5">首次初始化</div>
      <div class="text-caption text-grey-7">完成媒体目录、联网方式和默认播放方式设置。</div>
    </div>

    <q-stepper v-model="step" vertical color="primary" animated flat bordered>
      <q-step :name="1" title="添加媒体目录" icon="folder" :done="step > 1">
        <q-list v-if="config.rootFolders.length" bordered separator class="q-mb-md">
          <q-item v-for="(folder, index) in config.rootFolders" :key="`${folder.name}-${folder.path}`">
            <q-item-section>
              <q-item-label>{{ folder.name }}</q-item-label>
              <q-item-label caption>{{ folder.path }}</q-item-label>
              <q-item-label v-if="folder.workCount !== undefined" caption>
                识别到 {{ folder.workCount }} 个作品目录
                <span v-if="folder.unreadableCount">，{{ folder.unreadableCount }} 个子目录无法读取</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat round dense icon="delete" color="negative" aria-label="移除媒体目录" @click="removeFolder(index)" />
            </q-item-section>
          </q-item>
        </q-list>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4"><q-input v-model.trim="folder.name" outlined dense label="目录名称" /></div>
          <div class="col-12 col-sm-8"><q-input v-model.trim="folder.path" outlined dense label="绝对路径" /></div>
        </div>
        <div class="row justify-between q-mt-md">
          <q-btn outline color="primary" icon="playlist_add" label="检查并添加" :loading="folderChecking" @click="checkAndAddFolder" />
          <q-btn color="primary" icon-right="navigate_next" label="下一步" :disable="config.rootFolders.length === 0" @click="step = 2" />
        </div>
      </q-step>

      <q-step :name="2" title="选择联网方式" icon="lan" :done="step > 2">
        <q-btn-toggle
          v-model="config.httpProxyMode"
          spread
          unelevated
          no-caps
          toggle-color="primary"
          :options="proxyModeOptions"
        />
        <div v-if="config.httpProxyMode === 'environment'" class="text-caption text-grey-7 q-mt-md">
          服务器会读取 HTTP_PROXY、HTTPS_PROXY 和 NO_PROXY 环境变量。
        </div>
        <div v-if="config.httpProxyMode === 'manual'" class="row q-col-gutter-md q-mt-sm">
          <div class="col-12 col-sm-7"><q-input v-model.trim="config.httpProxyHost" outlined dense label="代理主机" hint="留空时使用 127.0.0.1" /></div>
          <div class="col-12 col-sm-5"><q-input v-model.number="config.httpProxyPort" outlined dense type="number" min="1" max="65535" label="代理端口" /></div>
        </div>
        <q-stepper-navigation class="row justify-between">
          <q-btn flat color="primary" icon="navigate_before" label="上一步" @click="step = 1" />
          <q-btn color="primary" icon-right="navigate_next" label="下一步" :disable="!networkConfigValid" @click="step = 3" />
        </q-stepper-navigation>
      </q-step>

      <q-step :name="3" title="测试服务器联网" icon="network_check" :done="step > 3">
        <q-btn outline color="primary" icon="network_check" label="开始测试" :loading="networkTesting" @click="testNetwork" />
        <q-list v-if="networkResults.length" bordered separator class="q-mt-md">
          <q-item v-for="result in networkResults" :key="result.key">
            <q-item-section avatar>
              <q-icon :name="result.ok ? 'check_circle' : 'error'" :color="result.ok ? 'positive' : 'negative'" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ result.label }}</q-item-label>
              <q-item-label caption>{{ networkResultText(result) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <q-stepper-navigation class="row justify-between">
          <q-btn flat color="primary" icon="navigate_before" label="上一步" @click="step = 2" />
          <q-btn color="primary" icon-right="navigate_next" label="下一步" @click="step = 4" />
        </q-stepper-navigation>
      </q-step>

      <q-step :name="4" title="选择默认播放方式" icon="headphones">
        <q-option-group v-model="config.transcodeOption" :options="transcodeOptions" color="primary" />
        <div class="text-caption text-grey-7 q-mt-sm">AAC 会按需生成，不会改动 NAS 中的原始音频。</div>
        <q-stepper-navigation class="row justify-between">
          <q-btn flat color="primary" icon="navigate_before" label="上一步" @click="step = 3" />
          <q-btn color="primary" icon="done" label="保存并前往扫描" :loading="saving" @click="completeSetup" />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>
  </q-page>
</template>

<script>
import NotifyMixin from '../../mixins/Notification.js'

export default {
  name: 'Setup',
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
      proxyModeOptions: [
        { label: '直连', value: 'direct' },
        { label: '环境变量', value: 'environment' },
        { label: '手动代理', value: 'manual' }
      ],
      transcodeOptions: [
        { label: '原始音频', value: 'off' },
        { label: 'AAC 128k', value: 'aac 128' },
        { label: 'AAC 320k', value: 'aac 320' }
      ]
    }
  },
  computed: {
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
        this.showWarnNotif('请填写目录名称和绝对路径')
        return
      }
      if (this.config.rootFolders.some(item => item.name === this.folder.name)) {
        this.showWarnNotif('目录名称不能重复')
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
      if (result.ok) return `HTTP ${result.status}，${result.durationMs} ms`
      return `${result.error || '连接失败'}，${result.durationMs} ms`
    },
    async completeSetup () {
      this.saving = true
      try {
        const response = await this.$axios.post('/api/config/admin/complete-setup', { config: this.config })
        this.showSuccNotif(response.data.message)
        await this.$router.replace('/admin/scanner')
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
.setup-page { max-width: 920px; }
.setup-heading { margin: 8px 0 24px; }
.setup-page :deep(.q-stepper) { border-radius: 6px; }
.setup-page :deep(.q-stepper__step-inner) { padding-right: 24px; }
@media (max-width: 599px) {
  .setup-page :deep(.q-stepper__step-inner) { padding-right: 12px; padding-left: 12px; }
}
</style>
