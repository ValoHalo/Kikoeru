<template>
  <q-page class="admin-page admin-page--with-fixed-actions settings-page">
  <q-form class="settings-form" @submit="onSubmit">
    <header class="settings-heading">
      <div>
        <h1>{{ $t('advanced.title') }}</h1>
        <div class="text-caption text-grey-7">{{ $t('advanced.description') }}</div>
      </div>
    </header>
    <section class="settings-section" aria-labelledby="crawler-settings-title">
      <div class="settings-section__heading">
        <q-icon name="travel_explore" size="22px" />
        <div><h2 id="crawler-settings-title">{{ $t('advanced.crawler') }}</h2><div class="text-caption text-grey-7">{{ $t('advanced.crawlerHint') }}</div></div>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.tagLanguage') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.tagLanguageHint') }}</q-item-label>
          </q-item-section>

          <q-item-section side class="settings-control">
            <div class="tag-language-control">
              <q-btn-toggle v-model="config.tagLanguage" dense unelevated no-caps toggle-color="primary" :options="tagLanguageOptions" />
              <q-btn flat no-caps color="primary" icon="refresh" :label="$t('advanced.refreshTags')" :loading="refreshTagsLoading" @click="refreshTagNames">
                <q-tooltip>{{ $t('advanced.refreshTagsHint') }}</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.restoreTags') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.restoreTagsHint') }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn outline no-caps class="settings-action-button" color="warning" icon="restart_alt" :label="$t('advanced.restoreTagsAction')" :loading="uncensorTagsLoading" @click="confirmUncensorTags" />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.dlsiteTimeout') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.defaultDlsiteTimeout') }}</q-item-label>
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
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('dlsiteTimeout') }" flat round dense icon="restart_alt" :aria-label="$t('advanced.resetDlsiteTimeout', { dlsiteTimeout: numericDefaults.dlsiteTimeout })" @click="restoreNumericDefault('dlsiteTimeout')">
                  <q-tooltip>{{ $t('advanced.resetDlsiteTimeoutHint', { dlsiteTimeout: numericDefaults.dlsiteTimeout }) }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.hvdbTimeout') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.defaultDlsiteTimeout') }}</q-item-label>
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
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('hvdbTimeout') }" flat round dense icon="restart_alt" :aria-label="$t('advanced.resetHvdbTimeout', { hvdbTimeout: numericDefaults.hvdbTimeout })" @click="restoreNumericDefault('hvdbTimeout')">
                  <q-tooltip>{{ $t('advanced.resetHvdbTimeoutHint', { hvdbTimeout: numericDefaults.hvdbTimeout }) }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.retryDelay') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.defaultRetryDelay') }}</q-item-label>
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
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('retryDelay') }" flat round dense icon="restart_alt" :aria-label="$t('advanced.resetRetryDelay', { retryDelay: numericDefaults.retryDelay })" @click="restoreNumericDefault('retryDelay')">
                  <q-tooltip>{{ $t('advanced.resetRetryDelayHint', { retryDelay: numericDefaults.retryDelay }) }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.retry') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.defaultRetry') }}</q-item-label>
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
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('retry') }" flat round dense icon="restart_alt" :aria-label="$t('advanced.resetRetry', { retry: numericDefaults.retry })" @click="restoreNumericDefault('retry')">
                  <q-tooltip>{{ $t('advanced.resetRetryHint', { retry: numericDefaults.retry }) }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.parallelism') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.defaultParallelism') }}</q-item-label>
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
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('maxParallelism') }" flat round dense icon="restart_alt" :aria-label="$t('advanced.resetParallelism', { maxParallelism: numericDefaults.maxParallelism })" @click="restoreNumericDefault('maxParallelism')">
                  <q-tooltip>{{ $t('advanced.resetParallelismHint', { maxParallelism: numericDefaults.maxParallelism }) }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.proxyMode') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.proxyModeHint') }}</q-item-label>
          </q-item-section>
          <q-item-section side class="settings-control settings-control--wide">
            <q-btn-toggle v-model="config.httpProxyMode" dense unelevated no-caps toggle-color="primary" :options="proxyModeOptions" />
          </q-item-section>
        </q-item>

        <q-item v-if="config.httpProxyMode === 'environment'">
          <q-item-section>
            <q-item-label>{{ $t('advanced.environmentProxy') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.environmentProxyHint') }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-item v-if="config.httpProxyMode === 'manual'">
          <q-item-section>
            <q-item-label>{{ $t('advanced.proxyHost') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.proxyHostHint') }}</q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-input v-model="config.httpProxyHost" dense outlined hide-bottom-space :aria-label="$t('advanced.proxyHost')" input-class="text-right" style="max-width: 160px;" />
          </q-item-section>
        </q-item>

        <q-item v-if="config.httpProxyMode === 'manual'">
          <q-item-section>
            <q-item-label>{{ $t('advanced.proxyPort') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.proxyPortHint') }}</q-item-label>
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
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('httpProxyPort') }" flat round dense icon="restart_alt" :aria-label="$t('advanced.resetProxyPort', { httpProxyPort: numericDefaults.httpProxyPort })" @click="restoreNumericDefault('httpProxyPort')">
                  <q-tooltip>{{ $t('advanced.resetProxyPortHint', { httpProxyPort: numericDefaults.httpProxyPort }) }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.networkTest') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.networkTestHint') }}</q-item-label>
            <div v-if="networkResults.length" class="q-mt-sm">
              <q-chip v-for="result in networkResults" :key="result.key" dense square :color="result.ok ? 'positive' : 'negative'" text-color="white" :icon="result.ok ? 'check' : 'close'">
                {{ result.label }}
              </q-chip>
            </div>
          </q-item-section>
          <q-item-section side>
            <q-btn outline no-caps class="settings-action-button" color="primary" icon="network_check" :label="$t('advanced.testNetwork')" :loading="networkTestLoading" @click="testNetwork" />
          </q-item-section>
        </q-item>
      </q-list>
    </section>

    <section class="settings-section" aria-labelledby="scanner-settings-title">
      <div class="settings-section__heading">
        <q-icon name="folder_open" size="22px" />
            <div><h2 id="scanner-settings-title">{{ $t('advanced.scanner') }}</h2><div class="text-caption text-grey-7">{{ $t('advanced.scannerHint') }}</div></div>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.recursionDepth') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.defaultRecursionDepth') }}</q-item-label>
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
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('scannerMaxRecursionDepth') }" flat round dense icon="restart_alt" :aria-label="$t('advanced.resetRecursionDepth', { scannerMaxRecursionDepth: numericDefaults.scannerMaxRecursionDepth })" @click="restoreNumericDefault('scannerMaxRecursionDepth')">
                  <q-tooltip>{{ $t('advanced.resetRecursionDepthHint', { scannerMaxRecursionDepth: numericDefaults.scannerMaxRecursionDepth }) }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.skipCleanup') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.skipCleanupHint') }}</q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-toggle v-model="config.skipCleanup" dense />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.fileWatcher') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.fileWatcherHint') }}</q-item-label>
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
        <div><h2 id="server-settings-title">{{ $t('advanced.server') }}</h2><div class="text-caption text-grey-7">{{ $t('advanced.serverHint') }}</div></div>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.authentication') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.authenticationHint') }}</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.auth" dense :disable="config.production" />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.gzip') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.gzipHint') }}</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.enableGzip" dense/>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.listenPort') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.listenPortHint') }}</q-item-label>
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
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('listenPort') }" flat round dense icon="restart_alt" :aria-label="$t('advanced.resetListenPort', { listenPort: numericDefaults.listenPort })" @click="restoreNumericDefault('listenPort')">
                  <q-tooltip>{{ $t('advanced.resetListenPortHint', { listenPort: numericDefaults.listenPort }) }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.localOnly') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.localOnlyHint') }}</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.blockRemoteConnection" dense/>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.tokenExpiry') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.defaultTokenExpiry') }}</q-item-label>
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
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('expiresIn') }" flat round dense icon="restart_alt" :aria-label="$t('advanced.resetTokenExpiry', { expiresIn: numericDefaults.expiresIn })" @click="restoreNumericDefault('expiresIn')">
                  <q-tooltip>{{ $t('advanced.resetTokenExpiryHint', { expiresIn: numericDefaults.expiresIn }) }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.pageSize') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.defaultPageSize') }}</q-item-label>
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
                <q-btn class="settings-number-reset" :class="{ 'settings-number-reset--active': isNumericSettingModified('pageSize') }" flat round dense icon="restart_alt" :aria-label="$t('advanced.resetPageSize', { pageSize: numericDefaults.pageSize })" @click="restoreNumericDefault('pageSize')">
                  <q-tooltip>{{ $t('advanced.resetPageSizeHint', { pageSize: numericDefaults.pageSize }) }}</q-tooltip>
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
        <div><h2 id="security-settings-title">{{ $t('advanced.security') }}</h2><div class="text-caption text-grey-7">{{ $t('advanced.securityHint') }}</div></div>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.production') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.productionHint') }}</q-item-label>
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
        <div><h2 id="other-settings-title">{{ $t('advanced.other') }}</h2><div class="text-caption text-grey-7">{{ $t('advanced.otherHint') }}</div></div>
      </div>
      <q-list bordered separator class="settings-list">
        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.checkUpdates') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.checkUpdatesHint') }}</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.checkUpdate" dense />
          </q-item-section>
        </q-item>

        <q-item v-if="config.checkUpdate">
          <q-item-section>
            <q-item-label>{{ $t('advanced.checkBeta') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.checkBetaHint') }}</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.checkBetaUpdate" dense />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.defaultDatabasePath') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.defaultDatabasePathHint') }}</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-toggle v-model="config.dbUseDefaultPath" dense />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>{{ $t('advanced.defaultCoverPath') }}</q-item-label>
            <q-item-label caption>{{ $t('advanced.defaultCoverPathHint') }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle v-model="config.coverUseDefaultPath" dense :aria-label="$t('advanced.defaultCoverPath')" />
          </q-item-section>
        </q-item>

        <q-item v-if="!config.coverUseDefaultPath">
          <q-item-section>
            <q-item-label>{{ $t('advanced.coverFolder') }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-input v-model="config.coverFolderDir" outlined dense hide-bottom-space required style="width: 360px; max-width: 100%;" :aria-label="$t('advanced.coverFolder')" />
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
        :aria-label="$t('advanced.saveSettings')"
      >
        <q-tooltip>{{ hasUnsavedChanges ? $t('advanced.saveChanges') : $t('advanced.saveSettings') }}</q-tooltip>
      </q-btn>
    </div>
  </q-form>
  </q-page>
</template>

<script>
import { t } from '../../i18n'
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

    }
  },

  computed: {
    tagLanguageOptions () {
      return [
        { label: t('advanced.simplified'), value: 'zh-cn' },
        { label: t('advanced.traditional'), value: 'zh-tw' },
        { label: t('advanced.japanese'), value: 'ja-jp' },
        { label: t('advanced.english'), value: 'en-us' },
      ]
    },
    proxyModeOptions () {
      return [
        { label: t('advanced.direct'), value: 'direct' },
        { label: t('advanced.environment'), value: 'environment' },
        { label: t('advanced.manual'), value: 'manual' },
      ]
    },
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
          if (successCount === this.networkResults.length) this.showSuccNotif(t('common.networkPassed'))
          else this.showWarnNotif(t('advanced.networkSummary', { successCount: successCount, count: this.networkResults.length }))
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
        title: t('advanced.restoreTags'),
        message: t('advanced.restoreTagsPrompt'),
        cancel: { label: t('common.cancel'), flat: true },
        ok: { label: t('advanced.restoreTagsAction'), color: 'warning', flat: true },
      }).onOk(() => this.uncensorTags())
    },

    uncensorTags () {
      this.uncensorTagsLoading = true
      this.$axios.post('/api/uncensor/tags')
        .then(() => this.showSuccNotif(t('advanced.tagsRestored')))
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
