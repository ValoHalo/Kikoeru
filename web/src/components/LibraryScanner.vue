<template>
  <section id="scanner" aria-labelledby="scanner-title" class="settings-section">
    <div class="settings-section__heading">
      <q-icon name="youtube_searched_for" size="22px" />
      <h2 id="scanner-title">{{ $t('libraryScanner.title') }}</h2>
    </div>
    <div class="library-scan-actions">
      <q-btn v-if="state === 'running'" unelevated no-caps class="settings-action-button" color="negative" icon="stop" :label="$t('libraryScanner.stop')" :aria-label="$t('libraryScanner.stopProcess')"
        :disable="!(loggedIn || socketConnected)" @click="killScanProceess()" />
      <q-btn v-else unelevated no-caps class="settings-action-button" color="primary" icon="play_arrow" :label="$t('libraryScanner.scan')" :aria-label="$t('libraryScanner.scanLibrary')"
        :disable="!(loggedIn || socketConnected)" @click="performScan()" />
      <q-btn outline no-caps class="settings-action-button" color="primary" icon="refresh" :label="$t('libraryScanner.refreshMetadata')" :aria-label="$t('libraryScanner.refreshLibrary')"
        :disable="state === 'running' || !(loggedIn || socketConnected)" @click="performUpdate()" />
      <q-btn outline no-caps class="settings-action-button" color="primary" icon="find_replace" :label="$t('libraryScanner.scanFiles')" :aria-label="$t('libraryScanner.scanChanges')"
        :disable="state === 'running' || !(loggedIn || socketConnected)" @click="performWorkFileScan()" />
      <q-btn outline no-caps class="settings-action-button" color="primary" icon="replay" :label="$t('libraryScanner.retry')" :aria-label="$t('libraryScanner.retryOnly')"
        :disable="state === 'running' || persistedFailures.length === 0 || !(loggedIn || socketConnected)" @click="retryFailed()" />
      <q-btn outline no-caps class="settings-action-button settings-action-button--neutral" icon="network_check" :label="$t('libraryScanner.networkTest')" :aria-label="$t('libraryScanner.networkTest')"
        :loading="networkTesting" :disable="state === 'running'" @click="testNetwork()" />
    </div>

    <div v-if="persistedFailures.length" class="scanner-status q-mt-md">
      <div class="row items-center justify-between q-pa-md">
        <div>
          <div class="text-subtitle1">{{ $t('libraryScanner.failureHistory') }}</div>
          <div class="text-caption text-grey-7">{{ $t('libraryScanner.failureCount', { count: persistedFailures.length }) }}</div>
        </div>
        <q-btn outline dense class="settings-icon-button" color="negative" icon="delete_sweep" :aria-label="$t('libraryScanner.clearFailures')" :loading="failureLoading" @click="clearFailures">
          <q-tooltip>{{ $t('libraryScanner.clearAllFailures') }}</q-tooltip>
        </q-btn>
      </div>
      <q-separator />
      <q-list separator>
        <q-expansion-item v-for="failure in persistedFailures" :key="failure.id" icon="error_outline" :label="failure.code" :caption="failure.message">
          <q-item dense>
            <q-item-section>
              <q-item-label caption>{{ $t('libraryScanner.failureStage', { value: stageLabel(failure.stage), attempts: failure.attempts }) }}</q-item-label>
              <q-item-label caption>{{ $t('libraryScanner.failureDirectory', { root_folder: failure.root_folder, relative_dir: failure.relative_dir }) }}</q-item-label>
              <q-item-label caption>{{ $t('libraryScanner.lastFailure', { updated_at: failure.updated_at }) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-expansion-item>
      </q-list>
    </div>

    <div v-show="state" class="scanner-status q-mt-md">
      <q-expansion-item expand-separator>
        <template v-slot:header>
          <q-item-section avatar>
            <q-spinner-gears v-if="state === 'running'" color="primary" size="2em" />
            <q-icon v-else-if="state === 'finished'" name="done" color="positive" size="2em" />
            <q-icon v-else-if="state === 'error'" name="bug_report" color="red" size="2em" />
          </q-item-section>

          <q-item-section>
            <q-item-label v-if="allLogs.length > 1" class="ellipsis">{{allLogs[allLogs.length - 2].message}}</q-item-label>
            <q-item-label v-if="allLogs.length > 0" class="ellipsis">{{allLogs[allLogs.length - 1].message}}</q-item-label>
          </q-item-section>
        </template>
        
        <q-scroll-area style="height: 256px;" class="scanner-logs bg-dark text-white q-pa-md">
          <div v-for="(log, index) in allLogs" :key="index" >
            <span :class="textColorOnLevel(log.level)">➜ {{log.message}}</span>
          </div>
        </q-scroll-area>
      </q-expansion-item>
    </div>

    <div v-show="(tasks.length > 0) || (failedTasks.length > 0)" class="scanner-status q-mt-md">
      <q-tabs
        v-model="tab"
        dense
        inline-label
        class="text-grey"
        active-color="primary"
        indicator-color="primary"
        align="justify"
        narrow-indicator
      >
        <q-tab name="tasks" icon="hourglass_full" :label="$t('libraryScanner.processing')">
          <q-badge v-show="tasks.length > 0" color="primary" floating>{{tasks.length}}</q-badge>
        </q-tab>
        <q-tab name="failedTasks" icon="error_outline" :label="$t('libraryScanner.failed')">
          <q-badge v-show="failedTasks.length > 0" color="red" floating>{{failedTasks.length}}</q-badge>
        </q-tab>
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="tab" animated class="bg-transparent">
        <q-tab-panel name="tasks" class="q-pa-none">
          <q-virtual-scroll
            separator
            style="max-height: 313px;"
            :items="tasks"
            :virtual-scroll-item-size="52"
          >
            <template v-slot="{ item, index }">
              <q-expansion-item expand-separator :key="index">
                <template v-slot:header>
                  <q-item-section avatar>
                    <q-spinner-hourglass color="primary" size="2em" />
                  </q-item-section>

                  <q-item-section>
                    <q-item-label v-if="item.logs.length > 0" class="ellipsis">{{item.logs[item.logs.length - 1].message}}</q-item-label>
                    <q-item-label caption>{{ item.rjcode }}</q-item-label>
                  </q-item-section>
                </template>
                
                <div class="scanner-logs bg-dark text-white q-pa-md">
                    <div v-for="(log, index) in item.logs" :key="index">
                      <span :class="textColorOnLevel(log.level)">➜ {{log.message}}</span>
                    </div>
                </div>
              </q-expansion-item>
            </template>
          </q-virtual-scroll>
        </q-tab-panel>

        <q-tab-panel name="failedTasks" class="q-pa-none">
          <q-virtual-scroll
            separator
            style="max-height: 313px;"
            :items="failedTasks"
            :virtual-scroll-item-size="52"
          >
            <template v-slot="{ item, index }">
              <q-expansion-item
                expand-separator
                :key="index"
                expand-icon-class="text-white"
                header-class="bg-negative"
              >
                <template v-slot:header>
                  <q-item-section avatar>
                    <q-icon name="bug_report" color="white" size="2em" />
                  </q-item-section>

                  <q-item-section>
                    <q-item-label class="text-white ellipsis" >
                      {{item.logs[item.logs.length - 1].message}}
                    </q-item-label>

                    <q-item-label caption class="text-white">
                      {{ item.rjcode }}
                    </q-item-label>
                  </q-item-section>
                </template>
                
                <div class="scanner-logs bg-dark text-white q-pa-md">
                    <div v-for="(log, index) in item.logs" :key="index">
                      <span :class="textColorOnLevel(log.level)">➜ {{log.message}}</span>
                    </div>
                </div>
              </q-expansion-item>
              
            </template>
          </q-virtual-scroll>
        </q-tab-panel>
      </q-tab-panels>
    </div>
  </section>
</template>

<script>
import { t } from '../i18n'
import NotifyMixin from '../mixins/Notification.js'

export default {
  name: 'LibraryScanner',

  mixins: [NotifyMixin],

  data () {
    return {
      tab: 'tasks',
      state: null, // ['running', 'finished', 'error']
      loggedIn: false,
      socketConnected: false,
      tasks: [], // 正在处理中的并行任务
      failedTasks: [], // 处理失败的任务
      mainLogs: [],
      results: [],
      persistedFailures: [],
      failureLoading: false,
      networkTesting: false
    }
  },

  methods: {
    onScanTasks (payload) {
      this.tasks = payload.tasks
    },
    onScanFailedTasks (payload) {
      this.failedTasks = payload.failedTasks
    },
    onScanMainLogs (payload) {
      this.mainLogs = payload.mainLogs
    },
    onScanResults (payload) {
      this.results = payload.results
    },
    onScanInitState (payload) {
      this.state = 'running'
      this.tasks = payload.tasks
      this.failedTasks = payload.failedTasks
      this.mainLogs = payload.mainLogs
      this.results = payload.results
    },

    onScanFinished (payload) {
      this.state = 'finished'
      this.allLogs.push({
        level: 'info',
        message: payload.message
      })
      this.loadFailures()
    },
    onScanError () {
      this.state = 'error'
      this.loadFailures()
    },
    onSocketSuccess () {
      this.loggedIn = true
    },
    onSocketConnect () {
      this.socketConnected = true
    },
    onSocketDisconnect () {
      this.socketConnected = false
    },
    onSocketConnectError () {
      this.socketConnected = false
      this.showErrNotif(t('libraryScanner.socketFailed'))
    },
    cleanRerun() {
      this.tasks = []
      this.failedTasks = []
      this.mainLogs = []
      this.results = []
      this.state = 'running'
    },

    performScan () {
      this.cleanRerun()
      this.$socket.emit('PERFORM_SCAN')
    },

    performWorkFileScan () {
      this.cleanRerun()
      this.$socket.emit('PERFORM_LYRIC_SCAN')
    },

    performUpdate () {
      this.cleanRerun()
      this.$socket.emit('PERFORM_UPDATE')
    },

    retryFailed () {
      this.cleanRerun()
      this.$socket.emit('PERFORM_RETRY_FAILED')
    },

    async loadFailures () {
      this.failureLoading = true
      try {
        const response = await this.$axios.get('/api/scan-failures')
        this.persistedFailures = response.data.failures || []
      } catch (error) {
        this.showErrNotif((error.response && error.response.data.error) || error.message || error)
      } finally {
        this.failureLoading = false
      }
    },

    async clearFailures () {
      this.failureLoading = true
      try {
        const response = await this.$axios.delete('/api/scan-failures')
        this.persistedFailures = []
        this.showSuccNotif(response.data.message)
      } catch (error) {
        this.showErrNotif((error.response && error.response.data.error) || error.message || error)
      } finally {
        this.failureLoading = false
      }
    },

    async testNetwork () {
      this.networkTesting = true
      try {
        const response = await this.$axios.post('/api/config/admin/network-test')
        const results = response.data.results || []
        const passed = results.filter(item => item.ok).length
        if (passed === results.length) this.showSuccNotif(t('common.networkPassed'))
        else this.showWarnNotif(t('libraryScanner.networkSummary', { passed: passed, count: results.length }))
      } catch (error) {
        this.showErrNotif((error.response && error.response.data.error) || error.message || error)
      } finally {
        this.networkTesting = false
      }
    },

    stageLabel (stage) {
      return { metadata: t('common.metadata'), cover: t('libraryScanner.cover'), filesystem: t('libraryScanner.filesystem'), database: t('libraryScanner.database') }[stage] || stage
    },

    killScanProceess () {
      this.$socket.emit('KILL_SCAN_PROCESS')
    },

    textColorOnLevel(level) {
      switch(level) {
        case 'error': return 'text-red';
        case 'warn': return 'text-yellow';
        default: return '';
      }
    }
  },

  computed: {
    allLogs () {
      const resultLogs = this.results.map(res => {
        if (res.result === 'added') {
          return { level: 'info', message: t('libraryScanner.addedLog', { rjcode: res.rjcode, count: res.count }) }
        } else if (res.result === 'updated') {
          return { level: 'info', message: t('libraryScanner.updatedLog', { rjcode: res.rjcode, count: res.count }) }
        } else {
          return { level: 'error', message: t('libraryScanner.failedLog', { rjcode: res.rjcode, count: res.count }) }
        }
      })
      return this.mainLogs.concat(resultLogs)
    }
  },

  mounted () {
    const listeners = {
      SCAN_TASKS: this.onScanTasks,
      SCAN_FAILED_TASKS: this.onScanFailedTasks,
      SCAN_MAIN_LOGS: this.onScanMainLogs,
      SCAN_RESULTS: this.onScanResults,
      SCAN_INIT_STATE: this.onScanInitState,
      SCAN_FINISHED: this.onScanFinished,
      SCAN_ERROR: this.onScanError,
      success: this.onSocketSuccess,
      connect: this.onSocketConnect,
      disconnect: this.onSocketDisconnect,
      connect_error: this.onSocketConnectError
    }
    this.socketListeners = listeners
    Object.entries(listeners).forEach(([event, listener]) => this.$socket.on(event, listener))
    this.socketConnected = this.$socket.connected
    this.$socket.emit('ON_SCANNER_PAGE')
    this.loadFailures()
  },

  beforeUnmount () {
    Object.entries(this.socketListeners || {}).forEach(([event, listener]) => {
      this.$socket.removeListener(event, listener)
    })
  },
}
</script>
