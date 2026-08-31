<template>
  <q-page class="admin-page">
    <div class="row q-col-gutter-md q-mb-md">
      <div v-if="state === 'running'" class="col-xs-12 col-sm-12 row q-pa-sm">
        <q-btn
          class="col"
          color="negative"
          icon="stop"
          label="终止扫描进程"
          :disable="state !== 'running' || !(loggedIn || socketConnected)"
          @click="killScanProceess()"
        />
      </div>

      <div class="col-xs-6 col-sm-4 row q-pa-sm">
        <q-btn
          class="col"
          color="teal"
          icon="folder"
          label="扫描本地音声库"
          :disable="state === 'running' || !(loggedIn || socketConnected)"
          @click="performScan()"
        />
      </div>

      <div class="col-xs-6 col-sm-4 row q-pa-sm">
        <q-btn
          class="col"
          color="primary"
          icon="refresh"
          label="刷新音声库信息"
          :disable="state === 'running' || !(loggedIn || socketConnected)"
          @click="performUpdate()"
        />
      </div>

      <div class="col-xs-12 col-sm-4 row q-pa-sm">
        <q-btn
          class="col"
          color="secondary"
          icon="find_replace"
          label="扫描作品内文件变化"
          :disable="state === 'running' || !(loggedIn || socketConnected)"
          @click="performWorkFileScan()"
        />
      </div>

      <div class="col-xs-6 col-sm-4 row q-pa-sm">
        <q-btn
          class="col"
          color="warning"
          icon="replay"
          label="只重试失败项"
          :disable="state === 'running' || persistedFailures.length === 0 || !(loggedIn || socketConnected)"
          @click="retryFailed()"
        />
      </div>

      <div class="col-xs-6 col-sm-4 row q-pa-sm">
        <q-btn
          class="col"
          outline
          color="primary"
          icon="network_check"
          label="测试联网"
          :loading="networkTesting"
          :disable="state === 'running'"
          @click="testNetwork()"
        />
      </div>
    </div>

    <q-card v-if="persistedFailures.length" class="q-ma-md">
      <q-card-section class="row items-center justify-between">
        <div>
          <div class="text-subtitle1">失败历史</div>
          <div class="text-caption text-grey-7">服务器重启后仍会保留，共 {{ persistedFailures.length }} 项</div>
        </div>
        <q-btn flat round dense color="negative" icon="delete_sweep" aria-label="清除失败记录" :loading="failureLoading" @click="clearFailures">
          <q-tooltip>清除全部失败记录</q-tooltip>
        </q-btn>
      </q-card-section>
      <q-separator />
      <q-list separator>
        <q-expansion-item v-for="failure in persistedFailures" :key="failure.id" icon="error_outline" :label="failure.code" :caption="failure.message">
          <q-item dense>
            <q-item-section>
              <q-item-label caption>阶段：{{ stageLabel(failure.stage) }}　尝试：{{ failure.attempts }} 次</q-item-label>
              <q-item-label caption>目录：{{ failure.root_folder }}/{{ failure.relative_dir }}</q-item-label>
              <q-item-label caption>最近失败：{{ failure.updated_at }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-expansion-item>
      </q-list>
    </q-card>

    <q-card v-show="state" class="q-ma-md">
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
        
        <q-scroll-area style="height: 256px;" class="bg-dark text-white q-pa-md">
          <div v-for="(log, index) in allLogs" :key="index" >
            <span :class="textColorOnLevel(log.level)">➜ {{log.message}}</span>
          </div>
        </q-scroll-area>
      </q-expansion-item>
    </q-card>

    <q-card v-show="(tasks.length > 0) || (failedTasks.length > 0)" class="q-ma-md">
      <q-tabs
        v-model="tab"
        dense
        inline-label
        class="text-grey"
        active-color="white"
        active-bg-color="brown"
        indicator-color="yellow"
        align="justify"
        narrow-indicator
      >
        <q-tab name="tasks" icon="hourglass_full" label="处理中">
          <q-badge v-show="tasks.length > 0" color="primary" floating>{{tasks.length}}</q-badge>
        </q-tab>
        <q-tab name="failedTasks" icon="error_outline" label="处理失败">
          <q-badge v-show="failedTasks.length > 0" color="red" floating>{{failedTasks.length}}</q-badge>
        </q-tab>
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="tab" animated>
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
                
                <q-card>
                  <q-card-section class="bg-dark text-white">
                    <div v-for="(log, index) in item.logs" :key="index">
                      <span :class="textColorOnLevel(log.level)">➜ {{log.message}}</span>
                    </div>
                  </q-card-section>
                </q-card>
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
                
                <q-card>
                  <q-card-section class="bg-dark text-white">
                    <div v-for="(log, index) in item.logs" :key="index">
                      <span :class="textColorOnLevel(log.level)">➜ {{log.message}}</span>
                    </div>
                  </q-card-section>
                </q-card>
              </q-expansion-item>
              
            </template>
          </q-virtual-scroll>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-page>
</template>

<script>
import NotifyMixin from '../../mixins/Notification.js'

export default {
  name: 'Scanner',

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
      this.showErrNotif('连接Socket失败')
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
        if (passed === results.length) this.showSuccNotif('联网测试全部通过')
        else this.showWarnNotif(`联网测试通过 ${passed}/${results.length} 项`)
      } catch (error) {
        this.showErrNotif((error.response && error.response.data.error) || error.message || error)
      } finally {
        this.networkTesting = false
      }
    },

    stageLabel (stage) {
      return { metadata: '元数据', cover: '封面', filesystem: '文件系统', database: '数据库' }[stage] || stage
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
          return { level: 'info', message: `[${res.rjcode}] 添加成功! Added: ${res.count}` }
        } else if (res.result === 'updated') {
          return { level: 'info', message: `[${res.rjcode}] 更新成功! Updated: ${res.count}` }
        } else {
          return { level: 'error', message: `[${res.rjcode}] 处理失败! Failed: ${res.count}` }
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
