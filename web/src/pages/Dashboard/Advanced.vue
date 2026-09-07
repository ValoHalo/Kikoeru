<template>
  <q-page class="admin-page admin-page--with-fixed-actions settings-page">
  <q-form class="settings-form" @submit="onSubmit">
    <header class="settings-heading">
      <div>
        <h1>高级设置</h1>
        <div class="text-caption text-grey-7">管理爬虫、扫描、服务器和媒体库存储配置。</div>
      </div>
    </header>
    <section class="settings-section" aria-labelledby="crawler-settings-title">
      <div class="settings-section__heading">
        <q-icon name="travel_explore" size="22px" />
        <div><h2 id="crawler-settings-title">爬虫设置</h2><div class="text-caption text-grey-7">控制元数据语言、请求节奏和代理连接。</div></div>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>标签语言</q-item-label>
            <q-item-label caption>从 DLSite 爬取的标签元数据的语言</q-item-label>
          </q-item-section>

          <q-item-section side class="settings-control">
            <div class="tag-language-control">
              <q-btn-toggle v-model="config.tagLanguage" dense unelevated no-caps toggle-color="primary" :options="tagLanguageOptions" />
              <q-btn flat no-caps color="primary" icon="refresh" label="刷新标签名称" :loading="refreshTagsLoading" @click="refreshTagNames">
                <q-tooltip>先保存语言设置，再用当前语言刷新数据库中的标签名称</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>恢复原始标签名称</q-item-label>
            <q-item-label caption>将数据库中的 DLsite 和谐标签名恢复为原始名称；此操作无法自动撤销。</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn outline no-caps class="settings-action-button" color="warning" icon="restart_alt" label="恢复标签" :loading="uncensorTagsLoading" @click="confirmUncensorTags" />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>DLsite 超时时间</q-item-label>
            <q-item-label caption>默认 10000 毫秒</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-input
              v-model.number="config.dlsiteTimeout"
              class="settings-number-field"
              outlined hide-bottom-space
              dense
              type="number"
              input-class="settings-number-input text-center"
            >
              <template #before>
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('dlsiteTimeout') }" flat round dense icon="restart_alt" :aria-label="`恢复默认值 ${numericDefaults.dlsiteTimeout}`" @click="restoreNumericDefault('dlsiteTimeout')">
                  <q-tooltip>恢复默认值：{{ numericDefaults.dlsiteTimeout }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>HVDB 超时时间</q-item-label>
            <q-item-label caption>默认 10000 毫秒</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-input
              v-model.number="config.hvdbTimeout"
              class="settings-number-field"
              outlined hide-bottom-space
              dense
              type="number"
              input-class="settings-number-input text-center"
            >
              <template #before>
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('hvdbTimeout') }" flat round dense icon="restart_alt" :aria-label="`恢复默认值 ${numericDefaults.hvdbTimeout}`" @click="restoreNumericDefault('hvdbTimeout')">
                  <q-tooltip>恢复默认值：{{ numericDefaults.hvdbTimeout }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>重新请求间隔时间</q-item-label>
            <q-item-label caption>默认 2000 毫秒</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-input
              v-model.number="config.retryDelay"
              class="settings-number-field"
              outlined hide-bottom-space
              dense
              type="number"
              input-class="settings-number-input text-center"
            >
              <template #before>
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('retryDelay') }" flat round dense icon="restart_alt" :aria-label="`恢复默认值 ${numericDefaults.retryDelay}`" @click="restoreNumericDefault('retryDelay')">
                  <q-tooltip>恢复默认值：{{ numericDefaults.retryDelay }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>请求最大尝试次数</q-item-label>
            <q-item-label caption>默认 5</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-input
              v-model.number="config.retry"
              class="settings-number-field"
              outlined hide-bottom-space
              dense
              type="number"
              input-class="settings-number-input text-center"
            >
              <template #before>
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('retry') }" flat round dense icon="restart_alt" :aria-label="`恢复默认值 ${numericDefaults.retry}`" @click="restoreNumericDefault('retry')">
                  <q-tooltip>恢复默认值：{{ numericDefaults.retry }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>爬虫并行任务数量</q-item-label>
            <q-item-label caption>默认 16</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-input
              v-model.number="config.maxParallelism"
              class="settings-number-field"
              outlined hide-bottom-space
              dense
              type="number"
              input-class="settings-number-input text-center"
            >
              <template #before>
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('maxParallelism') }" flat round dense icon="restart_alt" :aria-label="`恢复默认值 ${numericDefaults.maxParallelism}`" @click="restoreNumericDefault('maxParallelism')">
                  <q-tooltip>恢复默认值：{{ numericDefaults.maxParallelism }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>联网方式</q-item-label>
            <q-item-label caption>直连、读取服务器环境变量，或手动指定 HTTP 代理</q-item-label>
          </q-item-section>
          <q-item-section side class="settings-control settings-control--wide">
            <q-btn-toggle v-model="config.httpProxyMode" dense unelevated no-caps toggle-color="primary" :options="proxyModeOptions" />
          </q-item-section>
        </q-item>

        <q-item v-if="config.httpProxyMode === 'environment'">
          <q-item-section>
            <q-item-label>环境变量代理</q-item-label>
            <q-item-label caption>读取服务器进程的 HTTP_PROXY、HTTPS_PROXY 和 NO_PROXY</q-item-label>
          </q-item-section>
        </q-item>

        <q-item v-if="config.httpProxyMode === 'manual'">
          <q-item-section>
            <q-item-label>HTTP 代理主机</q-item-label>
            <q-item-label caption>留空时使用 127.0.0.1</q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-input v-model="config.httpProxyHost" dense outlined hide-bottom-space aria-label="HTTP 代理主机" input-class="text-right" style="max-width: 160px;" />
          </q-item-section>
        </q-item>

        <q-item v-if="config.httpProxyMode === 'manual'">
          <q-item-section>
            <q-item-label>HTTP 代理端口</q-item-label>
            <q-item-label caption>1 到 65535</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-input
              v-model.number="config.httpProxyPort"
              class="settings-number-field"
              outlined hide-bottom-space
              dense
              type="number"
              input-class="settings-number-input text-center"
            >
              <template #before>
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('httpProxyPort') }" flat round dense icon="restart_alt" :aria-label="`恢复默认值 ${numericDefaults.httpProxyPort}`" @click="restoreNumericDefault('httpProxyPort')">
                  <q-tooltip>恢复默认值：{{ numericDefaults.httpProxyPort }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>联网测试</q-item-label>
            <q-item-label caption>直接使用当前页面中的参数，不需要先保存</q-item-label>
            <div v-if="networkResults.length" class="q-mt-sm">
              <q-chip v-for="result in networkResults" :key="result.key" dense square :color="result.ok ? 'positive' : 'negative'" text-color="white" :icon="result.ok ? 'check' : 'close'">
                {{ result.label }}
              </q-chip>
            </div>
          </q-item-section>
          <q-item-section side>
            <q-btn outline no-caps class="settings-action-button" color="primary" icon="network_check" label="测试联网" :loading="networkTestLoading" @click="testNetwork" />
          </q-item-section>
        </q-item>
      </q-list>
    </section>

    <section class="settings-section" aria-labelledby="scanner-settings-title">
      <div class="settings-section__heading">
        <q-icon name="folder_open" size="22px" />
            <div><h2 id="scanner-settings-title">文件夹扫描</h2><div class="text-caption text-grey-7">设置递归深度和自动监听。</div></div>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>最大递归扫描深度</q-item-label>
            <q-item-label caption>默认 2</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-input
              v-model.number="config.scannerMaxRecursionDepth"
              class="settings-number-field"
              outlined hide-bottom-space
              dense
              type="number"
              input-class="settings-number-input text-center"
            >
              <template #before>
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('scannerMaxRecursionDepth') }" flat round dense icon="restart_alt" :aria-label="`恢复默认值 ${numericDefaults.scannerMaxRecursionDepth}`" @click="restoreNumericDefault('scannerMaxRecursionDepth')">
                  <q-tooltip>恢复默认值：{{ numericDefaults.scannerMaxRecursionDepth }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            <q-item-label>扫描时跳过清理音声库</q-item-label>
            <q-item-label caption>是否跳过清理不存在的音声（不推荐，默认不跳过）</q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-toggle v-model="config.skipCleanup" dense />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>启用文件监听</q-item-label>
            <q-item-label caption>监听媒体目录变化并自动加入新作品；实验性功能，修改后需重启服务器。</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle v-model="config.enableFileWatcher" dense />
          </q-item-section>
        </q-item>
      </q-list>
    </section>

    <section class="settings-section" aria-labelledby="server-settings-title">
      <div class="settings-section__heading">
        <q-icon name="dns" size="22px" />
        <div><h2 id="server-settings-title">Web 服务器</h2><div class="text-caption text-grey-7">网络与认证设置保存后需要重启程序。</div></div>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>用户验证</q-item-label>
            <q-item-label caption>是否启用用户验证（生产环境下无法修改此设置）</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.auth" dense :disable="config.production" />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>启用Gzip</q-item-label>
            <q-item-label caption>对网络传输启用Gzip压缩</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.enableGzip" dense/>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>设置端口号</q-item-label>
            <q-item-label caption>服务器监听端口号</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-input
              v-model.number="config.listenPort"
              class="settings-number-field"
              outlined hide-bottom-space
              dense
              type="number"
              input-class="settings-number-input text-center"
            >
              <template #before>
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('listenPort') }" flat round dense icon="restart_alt" :aria-label="`恢复默认值 ${numericDefaults.listenPort}`" @click="restoreNumericDefault('listenPort')">
                  <q-tooltip>恢复默认值：{{ numericDefaults.listenPort }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>屏蔽远程连接</q-item-label>
            <q-item-label caption>只允许本地访问，默认为false。更改此设置需要重启程序</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.blockRemoteConnection" dense/>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>token 过期时间</q-item-label>
            <q-item-label caption>默认 2592000 秒</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-input
              v-model.number="config.expiresIn"
              class="settings-number-field"
              outlined hide-bottom-space
              dense
              type="number"
              input-class="settings-number-input text-center"
            >
              <template #before>
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('expiresIn') }" flat round dense icon="restart_alt" :aria-label="`恢复默认值 ${numericDefaults.expiresIn}`" @click="restoreNumericDefault('expiresIn')">
                  <q-tooltip>恢复默认值：{{ numericDefaults.expiresIn }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>每页显示的音声数量</q-item-label>
            <q-item-label caption>默认 12</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-input
              v-model.number="config.pageSize"
              class="settings-number-field"
              outlined hide-bottom-space
              dense
              type="number"
              input-class="settings-number-input text-center"
            >
              <template #before>
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('pageSize') }" flat round dense icon="restart_alt" :aria-label="`恢复默认值 ${numericDefaults.pageSize}`" @click="restoreNumericDefault('pageSize')">
                  <q-tooltip>恢复默认值：{{ numericDefaults.pageSize }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>
      </q-list>
    </section>

    <section class="settings-section" aria-labelledby="security-settings-title">
      <div class="settings-section__heading">
        <q-icon name="shield" size="22px" />
        <div><h2 id="security-settings-title">安全</h2><div class="text-caption text-grey-7">显示只能通过配置文件控制的运行模式。</div></div>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>生产环境</q-item-label>
            <q-item-label caption>此设置无法在网页端修改，详情请查阅GitHub Wiki中关于配置文件的说明</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.production" dense disable />
          </q-item-section>
        </q-item>
      </q-list>
    </section>

    <section class="settings-section" aria-labelledby="other-settings-title">
      <div class="settings-section__heading">
        <q-icon name="settings" size="22px" />
        <div><h2 id="other-settings-title">其它设置</h2><div class="text-caption text-grey-7">控制更新检查和本地数据目录策略。</div></div>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>检查更新</q-item-label>
            <q-item-label caption>打开网页时是否检查更新</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.checkUpdate" dense />
          </q-item-section>
        </q-item>

        <q-item v-if="config.checkUpdate">
          <q-item-section>
            <q-item-label>检查测试版更新</q-item-label>
            <q-item-label caption>是否检查测试版更新</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.checkBetaUpdate" dense />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>数据库使用默认路径</q-item-label>
            <q-item-label caption>使用程序所在位置下的sqlite文件夹，并忽略databaseFolderDir设置（如无必要请勿修改，更改此设置需要重启程序）</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.dbUseDefaultPath" dense />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>封面使用默认路径</q-item-label>
            <q-item-label caption>使用程序数据目录下的 covers 文件夹</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle v-model="config.coverUseDefaultPath" dense aria-label="封面使用默认路径" />
          </q-item-section>
        </q-item>

        <q-item v-if="!config.coverUseDefaultPath">
          <q-item-section>
            <q-item-label>封面文件夹路径</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-input v-model="config.coverFolderDir" outlined dense hide-bottom-space required style="width: 360px; max-width: 100%;" aria-label="封面文件夹路径" />
          </q-item-section>
        </q-item>

      </q-list>
    </section>

    <div class="settings-actions admin-page-actions row justify-end">
      <q-btn
        class="settings-save-button"
        :class="{ 'settings-save-button--active': hasUnsavedChanges }"
        :loading="loading"
        round
        unelevated
        icon="save"
        type="submit"
        aria-label="保存设置"
      >
        <q-tooltip>{{ hasUnsavedChanges ? '保存修改' : '保存设置' }}</q-tooltip>
      </q-btn>
    </div>
  </q-form>
  </q-page>
</template>

<script>
import NotifyMixin from '../../mixins/Notification.js'

export default {
  name: 'Advanced',

  mixins: [NotifyMixin],

  data () {
    return {
      config: {},
      savedConfigSnapshot: '',
      loading: false,
      refreshTagsLoading: false,
      uncensorTagsLoading: false,
      networkTestLoading: false,
      networkResults: [],
      numericDefaults: Object.freeze({
        dlsiteTimeout: 10000,
        hvdbTimeout: 10000,
        retryDelay: 2000,
        retry: 5,
        maxParallelism: 16,
        httpProxyPort: 0,
        scannerMaxRecursionDepth: 2,
        listenPort: 8888,
        expiresIn: 2592000,
        pageSize: 12,
      }),
      tagLanguageOptions: [
        { label: '简', value: 'zh-cn' },
        { label: '繁', value: 'zh-tw' },
        { label: '日', value: 'ja-jp' },
        { label: 'Eng', value: 'en-us' },
      ],
      proxyModeOptions: [
        { label: '直连', value: 'direct' },
        { label: '环境变量', value: 'environment' },
        { label: '手动代理', value: 'manual' },
      ],
    }
  },

  computed: {
    hasUnsavedChanges () {
      return this.savedConfigSnapshot !== '' && JSON.stringify(this.config) !== this.savedConfigSnapshot
    },
  },

  methods: {
    restoreNumericDefault (key) {
      this.config[key] = this.numericDefaults[key]
    },

    isNumericSettingModified (key) {
      if (!Object.prototype.hasOwnProperty.call(this.config, key)) return false
      return this.config[key] === '' || Number(this.config[key]) !== this.numericDefaults[key]
    },

    requestConfig () {
      this.$axios.get('/api/config/admin')
        .then((response) => {
          this.config = response.data.config
          if (!this.config.httpProxyMode) {
            this.config.httpProxyMode = Number(this.config.httpProxyPort) > 0 ? 'manual' : 'direct'
          }
          this.savedConfigSnapshot = JSON.stringify(this.config)
        })
        .catch((error) => {
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            if (error.response.status !== 401) {
              this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
            }
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    testNetwork () {
      this.networkTestLoading = true
      this.networkResults = []
      this.$axios.post('/api/config/admin/network-test', { config: this.config })
        .then((response) => {
          this.networkResults = response.data.results || []
          const successCount = this.networkResults.filter(item => item.ok).length
          if (successCount === this.networkResults.length) this.showSuccNotif('联网测试全部通过')
          else this.showWarnNotif(`联网测试通过 ${successCount}/${this.networkResults.length} 项`)
        })
        .catch((error) => this.showErrNotif((error.response && error.response.data.error) || error.message || error))
        .finally(() => { this.networkTestLoading = false })
    },

    onSubmit () {
      this.loading = true
      this.$axios.put('/api/config/admin', {
        config: this.config
      })
        .then((response) => {
          this.loading = false
          this.savedConfigSnapshot = JSON.stringify(this.config)
          this.showSuccNotif(response.data.message)
        })
        .catch((error) => {
          this.loading = false
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    refreshTagNames () {
      this.refreshTagsLoading = true
      this.$axios.post('/api/config/admin/refresh-tags')
        .then((response) => this.showSuccNotif(response.data.message))
        .catch((error) => this.showErrNotif((error.response && error.response.data.error) || error.message || error))
        .finally(() => { this.refreshTagsLoading = false })
    },

    confirmUncensorTags () {
      this.$q.dialog({
        title: '恢复原始标签名称',
        message: '此操作会批量修改数据库中的标签名称，且无法自动撤销。确定继续吗？',
        cancel: { label: '取消', flat: true },
        ok: { label: '恢复标签', color: 'warning', flat: true },
      }).onOk(() => this.uncensorTags())
    },

    uncensorTags () {
      this.uncensorTagsLoading = true
      this.$axios.post('/api/uncensor/tags')
        .then(() => this.showSuccNotif('标签名称已恢复'))
        .catch((error) => this.showErrNotif((error.response && error.response.data.error) || error.message || error))
        .finally(() => { this.uncensorTagsLoading = false })
    },
  },

  created () {
    this.requestConfig()
  }
}
</script>

<style lang="scss" scoped>
.settings-list .q-input { width: 140px; max-width: 100%; }
.settings-list .settings-number-field { width: 156px; }
.settings-number-field :deep(.q-field__before) { padding-right: 8px; }
.settings-number-reset { color: rgba(0, 0, 0, .46); }
.settings-number-reset--active { color: var(--q-primary); background: rgba(var(--kikoeru-accent-rgb), .1); }
.body--dark .settings-number-reset { color: rgba(255, 255, 255, .5); }
.body--dark .settings-number-reset--active { color: var(--q-primary); }
.settings-number-field :deep(.settings-number-input) { font-size: 16px; font-weight: 500; line-height: 24px; font-variant-numeric: tabular-nums; }
.settings-list :deep(input[type="number"]) { appearance: textfield; }
.settings-list :deep(input[type="number"]::-webkit-inner-spin-button),
.settings-list :deep(input[type="number"]::-webkit-outer-spin-button) { margin: 0; appearance: none; }
.tag-language-control { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
@media (max-width: 699px) {
  .settings-list .q-input { margin-left: auto; }
  .tag-language-control { width: 100%; }
  .tag-language-control > .q-btn { min-height: 44px; }
}
</style>
