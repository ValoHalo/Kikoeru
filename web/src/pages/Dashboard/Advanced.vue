<template>
  <q-page class="admin-page admin-page--with-fixed-actions settings-page">
  <q-form class="settings-form" @submit="onSubmit">
    <div class="settings-heading">
      <div class="text-h5">高级设置</div>
      <div class="text-caption text-grey-7">管理爬虫、扫描、服务器和媒体库存储配置。</div>
    </div>
    <section class="settings-section" aria-labelledby="crawler-settings-title">
      <div class="settings-section__heading">
        <q-icon name="travel_explore" size="22px" />
        <div><div id="crawler-settings-title" class="text-subtitle1 text-weight-medium">爬虫设置</div><div class="text-caption text-grey-7">控制元数据语言、请求节奏和代理连接。</div></div>
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
            <q-btn flat no-caps color="warning" icon="restart_alt" label="恢复标签" :loading="uncensorTagsLoading" @click="confirmUncensorTags" />
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
            <q-input v-model="config.httpProxyHost" input-class="text-right" style="max-width: 160px;" />
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
            <q-btn flat no-caps color="primary" icon="network_check" label="测试" :loading="networkTestLoading" @click="testNetwork" />
          </q-item-section>
        </q-item>
      </q-list>
    </section>

    <section class="settings-section" aria-labelledby="scanner-settings-title">
      <div class="settings-section__heading">
        <q-icon name="folder_open" size="22px" />
            <div><div id="scanner-settings-title" class="text-subtitle1 text-weight-medium">文件夹扫描</div><div class="text-caption text-grey-7">设置递归深度和自动监听。</div></div>
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
        <div><div id="server-settings-title" class="text-subtitle1 text-weight-medium">Web 服务器</div><div class="text-caption text-grey-7">网络与认证设置保存后需要重启程序。</div></div>
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
        <div><div id="security-settings-title" class="text-subtitle1 text-weight-medium">安全</div><div class="text-caption text-grey-7">显示只能通过配置文件控制的运行模式。</div></div>
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
        <div><div id="other-settings-title" class="text-subtitle1 text-weight-medium">其它设置</div><div class="text-caption text-grey-7">控制更新检查和本地数据目录策略。</div></div>
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
            <q-item-label caption>使用程序所在位置下的covers文件夹，并忽略封面文件夹路径设置</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.coverUseDefaultPath" dense />
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
.settings-page { max-width: 920px; margin: 0 auto; padding: 16px 16px 112px; }
.settings-heading { margin: 8px 0 28px; }
.settings-heading .text-caption { max-width: 100%; overflow-wrap: anywhere; white-space: normal; }
.settings-section { margin-bottom: 30px; }
.settings-section__heading { display: flex; align-items: center; gap: 12px; margin: 0 4px 10px; }
.settings-section__heading .q-icon { color: var(--q-color-primary); }
.settings-list { overflow: hidden; border-radius: 6px; }
.settings-list .q-item { min-height: 76px; }
.settings-list .q-item__section--avatar,
.settings-list .q-item__section--side { padding-left: 24px; }
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
.settings-actions.admin-page-actions { padding: 0; border: 0; background: transparent; box-shadow: none; backdrop-filter: none; }
.settings-actions.admin-page-actions .settings-save-button { width: 56px; height: 56px; min-width: 56px; min-height: 56px; color: rgba(0, 0, 0, .52); background: #fff; box-shadow: 0 6px 18px rgba(22, 32, 44, .2); transition: color .18s ease, background-color .18s ease, box-shadow .18s ease, transform .18s ease; }
.settings-actions.admin-page-actions .settings-save-button--active { color: #fff; background: var(--q-primary); box-shadow: 0 8px 22px rgba(var(--kikoeru-accent-rgb), .34); }
.settings-actions.admin-page-actions .settings-save-button--active:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(var(--kikoeru-accent-rgb), .4); }
.settings-save-button :deep(.q-icon) { font-size: 28px; }
.body--dark .settings-actions.admin-page-actions { border: 0; background: transparent; box-shadow: none; }
.body--dark .settings-actions.admin-page-actions .settings-save-button { color: rgba(255, 255, 255, .6); background: #2b2b2b; box-shadow: 0 6px 18px rgba(0, 0, 0, .42); }
.body--dark .settings-actions.admin-page-actions .settings-save-button--active { color: #fff; background: var(--q-primary); box-shadow: 0 8px 22px rgba(var(--kikoeru-accent-rgb), .38); }
.tag-language-control { display: flex; align-items: center; gap: 8px; }
.settings-control .q-btn-toggle { gap: 4px; padding: 2px; border: 1px solid rgba(0, 0, 0, .12); border-radius: 5px; background: rgba(0, 0, 0, .045); }
.settings-control .q-btn-toggle :deep(.q-btn) { min-height: 34px; padding: 4px 12px; border-radius: 3px !important; color: rgba(0, 0, 0, .68); font-size: 14px; line-height: 1.25; }
.settings-control .q-btn-toggle :deep(.q-icon) { font-size: 18px; }
.settings-control .q-btn--active { box-shadow: 0 1px 3px rgba(0, 0, 0, .22); color: #fff; }
.body--dark .settings-control .q-btn-toggle { border-color: rgba(255, 255, 255, .18); background: rgba(255, 255, 255, .08); }
.body--dark .settings-control .q-btn-toggle :deep(.q-btn) { color: rgba(255, 255, 255, .72); }
.body--dark .settings-control :deep(.q-btn--active) { color: #fff; }

@media (max-width: 699px) {
  .settings-page { padding-right: 12px; padding-left: 12px; }
  .settings-list .q-item { height: auto !important; min-height: 72px; align-items: flex-start; flex-wrap: wrap; gap: 12px; padding-top: 14px; padding-bottom: 14px; }
  .settings-page .q-item__section--avatar,
  .settings-page .q-item__section--side { width: 100%; min-width: 0; align-items: flex-start; padding-left: 0; }
  .settings-page .q-item__section--avatar .q-gutter-sm { display: flex; flex-wrap: wrap; align-items: center; width: 100%; }
  .settings-control--wide .q-btn-toggle { width: 100%; }
  .settings-control--wide .q-btn { min-width: 0; flex: 1 1 auto; }
  .tag-language-control { flex-wrap: wrap; }
  .settings-actions.admin-page-actions { left: auto; }
  .settings-actions.admin-page-actions .settings-save-button { width: 56px; }
}
</style>
