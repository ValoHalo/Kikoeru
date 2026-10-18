<template>
  <div>
    <template v-if="isLyricsPage">
      <SubtitleReader v-if="subtitleFile" :file="subtitleFile" :files="subtitleFiles" @back="backToWork" @select="selectSubtitle" />
      <div v-else class="q-pa-md">
        <q-btn flat dense no-caps icon="arrow_back" :label="$t('common.back')" color="primary" @click="backToWork" />
        <div class="q-pa-xl text-center" role="status">
          <q-spinner v-if="loadingData" size="36px" color="primary" />
          <p class="q-mt-md">{{ $t(loadingData ? 'subtitleReader.loading' : 'subtitleReader.unavailable') }}</p>
          <q-btn v-if="!loadingData" outline color="primary" icon="refresh" :label="$t('subtitleReader.retry')" @click="requestData" />
        </div>
      </div>
    </template>
    <div v-show="!isLyricsPage">
      <div class="q-px-md q-pt-sm">
        <q-btn flat dense no-caps icon="arrow_back" :label="$t('common.back')" color="primary" @click="backToWorks" />
      </div>
      <div v-if="workUnavailable" class="q-pa-xl text-center text-grey">{{ $t('work.unavailable') }}</div>
      <template v-if="metadataLoaded">
        <WorkDetails :metadata="metadata" @reset="requestData()" @resumeHistroy="resumeMetadataPlayHistroy" @history-cleared="clearPlaybackHistory">
          <template #folder-action>
            <q-btn
              v-if="!metadata.files_missing"
              flat round icon="folder_special"
              :color="isDefaultFolder ? 'primary' : undefined"
              :aria-label="$t(isDefaultFolder ? 'workTree.clearDefaultFolder' : 'workTree.setDefaultFolder')"
              :aria-pressed="isDefaultFolder"
              :disable="loadingData"
              @click="toggleDefaultFolder"
            >
              <AppTooltip>{{ $t(isDefaultFolder ? 'workTree.clearDefaultFolder' : 'workTree.setDefaultFolder') }}</AppTooltip>
            </q-btn>
          </template>
        </WorkDetails>
        <RelatedWorks :metadata="metadata" />
        <div class="q-px-md q-pt-sm">
          <q-btn flat no-caps icon="bookmarks" :label="$t('bookmark.currentWork')" @click="showBookmarks = true" />
        </div>
        <BookmarksDialog v-if="showBookmarks" :work-id="Number(workid)" @close="showBookmarks = false" />
        <!-- <WorkQueue :queue="tracks" :editable="false" /> -->
        <WorkTree
          v-if="!metadata.files_missing"
          ref="workTree"
          :tree="tree"
          :metadata="metadata"
          :importantTreePathArr="importantTreePathArr"
          :default-folder="defaultFolder"
          @path-change="currentFolder = $event"
          :editable="false"
        />
      </template>
    </div>
  </div>
</template>

<script>
import WorkDetails from 'components/WorkDetails.vue'
// import WorkQueue from 'components/WorkQueue'
import WorkTree from 'components/WorkTree.vue'
import SubtitleReader from 'components/SubtitleReader.vue'
import RelatedWorks from 'components/RelatedWorks.vue'
import BookmarksDialog from 'components/BookmarksDialog.vue'
import NotifyMixin from '../mixins/Notification.js'
import { mapState } from 'vuex'
import { getImportantTreePath } from 'src/utils'
import { folderExists, workFolderStorageKey } from '../utils/workFolder.mjs'

export default {
  name: 'Work',

  mixins: [NotifyMixin],

  components: {
    SubtitleReader,
    WorkDetails,
    // WorkQueue,
    WorkTree,
    RelatedWorks,
    BookmarksDialog
  },

  data () {
    return {
      workid: this.$route.params.id,
      showBookmarks: false,
      metadata: {
        id: parseInt(this.$route.params.id),
        circle: {}
      },
      tree: [],
      metadataLoaded: false,
      loadingData: true,
      workUnavailable: false,
      importantTreePathArr: [],
      defaultFolder: null,
      currentFolder: [],
      dataRequest: 0,
      metadataRequest: 0,
      historyRequest: 0,
      historyRefreshPending: false,
    }
  },

  computed: {
    defaultFolderKey () {
      return workFolderStorageKey(this.$store.state.User.name, this.workid)
    },
    isDefaultFolder () {
      return Array.isArray(this.defaultFolder) && JSON.stringify(this.defaultFolder) === JSON.stringify(this.currentFolder)
    },
    isLyricsPage () { return this.$route.name === 'lyrics' },
    subtitleFiles () {
      if (!this.isLyricsPage) return []
      const hash = `${this.workid}/${this.$route.params.hash}`
      const findFolder = items => {
        if (items.some(item => item.hash === hash)) return items.filter(item => item.type !== 'folder' && /\.(lrc|srt|vtt|ass|ssa)$/i.test(item.title || ''))
        for (const item of items) {
          if (item.type === 'folder') {
            const files = findFolder(item.children || [])
            if (files.length) return files
          }
        }
        return []
      }
      return findFolder(this.tree)
    },
    subtitleFile () { return this.subtitleFiles.find(file => file.hash === `${this.workid}/${this.$route.params.hash}`) },
    ...mapState('AudioPlayer', [
      'playing',
      'playWorkId',
      'smartPathEnabled',
      'smartPathPreferEffect',
      'smartPathAudioTypes'
    ]),
  },

  watch: {
    '$store.state.User.name' () {
      this.clearPlaybackHistory()
      this.loadDefaultFolder()
      this.$nextTick(() => this.$refs.workTree?.initPath())
      if (this.metadataLoaded) this.refreshPlaybackHistory()
      else this.requestData()
    },
    '$store.state.AudioPlayer.historySavedRevision' () { this.refreshPlaybackHistory() },
    '$store.state.AudioPlayer.historyRevision' () { this.clearPlaybackHistory() },
    $route (to) {
      if (!to.path.startsWith('/work/') || String(to.params.id) === String(this.workid)) return
      this.workid = to.params.id;
      this.metadata.state = null;
      this.requestData();
    },
    
    metadata() {
    }
  },

  created () {
    this.requestData()
  },

  beforeUnmount () {
    this.dataRequest++
    this.metadataRequest++
    this.historyRequest++
  },

  methods: {
    clearPlaybackHistory (workId = this.workid) {
      if (Number(workId) !== Number(this.workid)) return
      this.historyRequest++
      this.historyRefreshPending = false
      this.metadata = { ...this.metadata, state: null, play_updated_at: null, play_updated_at_full: null }
    },
    async refreshPlaybackHistory () {
      const request = ++this.historyRequest
      if (!this.metadataLoaded) { this.historyRefreshPending = true; return }
      this.historyRefreshPending = false
      const workId = this.workid
      const user = this.$store.state.User.name
      try {
        const { data } = await this.$axios.get(`/api/work/${workId}`)
        if (request !== this.historyRequest || workId !== this.workid || user !== this.$store.state.User.name || !this.metadataLoaded) return
        this.metadata = { ...this.metadata, state: data.state, play_updated_at: data.play_updated_at, play_updated_at_full: data.play_updated_at_full }
      } catch {
        // A failed refresh keeps the last confirmed history without interrupting playback.
      }
    },
    loadDefaultFolder () {
      this.defaultFolder = null
      try {
        const saved = JSON.parse(localStorage.getItem(this.defaultFolderKey))
        if (Array.isArray(saved) && saved.every(part => typeof part === 'string' && part.length > 0)) this.defaultFolder = saved
      } catch {
        // Unavailable storage or an invalid saved value leaves the global preference in effect.
      }
    },
    toggleDefaultFolder () {
      if (this.loadingData || !folderExists(this.tree, this.currentFolder)) return
      const clear = this.isDefaultFolder
      try {
        if (clear) localStorage.removeItem(this.defaultFolderKey)
        else localStorage.setItem(this.defaultFolderKey, JSON.stringify(this.currentFolder))
        this.defaultFolder = clear ? null : this.currentFolder.slice()
        this.showSuccNotif(this.$t(clear ? 'workTree.defaultFolderCleared' : 'workTree.defaultFolderSaved'))
      } catch {
        this.showErrNotif(this.$t('workTree.defaultFolderSaveFailed'))
      }
    },
    backToWork () {
      if (this.subtitleFile && this.$refs.workTree) {
        this.$refs.workTree.path = String(this.subtitleFile.subtitle || '').replace(/\\/g, '/').split('/').filter(Boolean)
      }
      const workPath = `/work/${this.workid}`
      const previous = this.$router.options.history.state.back
      if (previous === workPath || (typeof previous === 'string' && previous.startsWith(workPath + '?'))) this.$router.back()
      else this.$router.replace(workPath)
    },
    selectSubtitle (file) {
      this.$router.replace({ name: 'lyrics', params: { id: this.workid, hash: String(file.hash).split('/').pop() } })
    },
    backToWorks () {
      const previous = this.$router.options.history.state.back
      if (typeof previous === 'string' && previous.startsWith('/') && !previous.startsWith('//')) this.$router.back()
      else this.$router.push('/works')
    },
    async requestMetaData() {
      const request = ++this.metadataRequest
      const historyRequest = this.historyRequest
      const workId = this.workid
      const user = this.$store.state.User.name
      try {
        const response = await this.$axios.get(`/api/work/${workId}`);
        if (request !== this.metadataRequest || workId !== this.workid || user !== this.$store.state.User.name) return false
        if (historyRequest !== this.historyRequest) {
          response.data.state = null
          response.data.play_updated_at = null
          response.data.play_updated_at_full = null
        }
        this.metadata = response.data
        this.metadataLoaded = true
        // 如果有播放状态记录
        // 同时当前尚未播放，则设置历史播放进度
        if (!this.metadata.files_missing && !this.isLyricsPage && this.metadata.state && Array.isArray(this.metadata.state.queue) && this.metadata.state.queue.length > 0 && this.playWorkId == 0) {
          this.resumeMetadataPlayHistroy()
        }
        return true
      } catch (error ) {
        if (request !== this.metadataRequest || workId !== this.workid || user !== this.$store.state.User.name) return false
        if (error.response && error.response.status === 404 && this.$store.getters['AudioPlayer/sfwOnly']) {
          this.workUnavailable = true
          return false
        }
        if (error.response) {
          // 请求已发出，但服务器响应的状态码不在 2xx 范围内
          this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
        } else {
          this.showErrNotif(error.message || error)
        }
        return false
      }
    },

    async requestTracks() {
      const request = this.dataRequest
      try {
        const response = await this.$axios.get(`/api/tracks/${this.workid}`, {
          params: {
            smartPath: this.smartPathEnabled,
            preferEffect: this.smartPathPreferEffect,
            audioTypes: this.smartPathAudioTypes,
          },
        });
        if (request !== this.dataRequest) return
        this.tree = response.data;
        this.importantTreePathArr = getImportantTreePath(this.tree)
      } catch (error) {
        if (request !== this.dataRequest) return
        if (error.response) {
          // 请求已发出，但服务器响应的状态码不在 2xx 范围内
          this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
        } else {
          this.showErrNotif(error.message || error)
        }
      }
    },

    async requestData () {
      const request = ++this.dataRequest
      this.clearPlaybackHistory()
      this.loadingData = true
      this.metadataLoaded = false
      this.workUnavailable = false
      this.tree = []
      this.importantTreePathArr = []
      this.currentFolder = []
      this.loadDefaultFolder()
      if (await this.requestMetaData() && request === this.dataRequest && !this.metadata.files_missing) await this.requestTracks()
      if (request !== this.dataRequest) return
      this.loadingData = false
      if (this.historyRefreshPending) this.refreshPlaybackHistory()
    },

    resumeMetadataPlayHistroy() {
      if (!this.metadata.state || !Array.isArray(this.metadata.state.queue) || this.metadata.state.queue.length === 0) {
        return
      }
      this.$store.commit('AudioPlayer/SET_QUEUE', {
        workId: this.metadata.id,
        queue: this.metadata.state.queue,
        index: this.metadata.state.index,
        resetPlaying: false,
        resumeHistroySeconds: this.metadata.state.seconds,
      })
      if (this.metadata.state.playMode) this.$store.commit('AudioPlayer/SET_PLAY_MODE', this.metadata.state.playMode)
      if (Object.prototype.hasOwnProperty.call(this.metadata.state, 'playbackRate')) this.$store.commit('AudioPlayer/SET_PLAYBACK_RATE', this.metadata.state.playbackRate)
      console.log(`resume seconds = ${this.metadata.state.seconds}`)
    }
  }
}
</script>
