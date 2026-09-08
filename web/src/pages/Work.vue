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
        <WorkDetails :metadata="metadata" @reset="requestData()" @resumeHistroy="resumeMetadataPlayHistroy" />
        <RelatedWorks :metadata="metadata" />
        <!-- <WorkQueue :queue="tracks" :editable="false" /> -->
        <WorkTree
          ref="workTree"
          :tree="tree"
          :metadata="metadata"
          :importantTreePathArr="importantTreePathArr"
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
import NotifyMixin from '../mixins/Notification.js'
import { mapState } from 'vuex'
import { getImportantTreePath } from 'src/utils'

export default {
  name: 'Work',

  mixins: [NotifyMixin],

  components: {
    SubtitleReader,
    WorkDetails,
    // WorkQueue,
    WorkTree,
    RelatedWorks
  },

  data () {
    return {
      workid: this.$route.params.id,
      metadata: {
        id: parseInt(this.$route.params.id),
        circle: {}
      },
      tree: [],
      metadataLoaded: false,
      loadingData: true,
      workUnavailable: false,
      importantTreePathArr: []
    }
  },

  computed: {
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

  methods: {
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
      try {
        const response = await this.$axios.get(`/api/work/${this.workid}`);
        this.metadata = response.data
        this.metadataLoaded = true
        // 如果有播放状态记录
        // 同时当前尚未播放，则设置历史播放进度
        if (!this.isLyricsPage && this.metadata.state && Array.isArray(this.metadata.state.queue) && this.metadata.state.queue.length > 0 && this.playWorkId == 0) {
          this.resumeMetadataPlayHistroy()
        }
        return true
      } catch (error ) {
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
      try {
        const response = await this.$axios.get(`/api/tracks/${this.workid}`, {
          params: {
            smartPath: this.smartPathEnabled,
            preferEffect: this.smartPathPreferEffect,
            audioTypes: this.smartPathAudioTypes,
          },
        });
        this.tree = response.data;
        this.importantTreePathArr = getImportantTreePath(this.tree)
      } catch (error) {
        if (error.response) {
          // 请求已发出，但服务器响应的状态码不在 2xx 范围内
          this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
        } else {
          this.showErrNotif(error.message || error)
        }
      }
    },

    async requestData () {
      this.loadingData = true
      this.metadataLoaded = false
      this.workUnavailable = false
      this.tree = []
      if (await this.requestMetaData()) await this.requestTracks()
      this.loadingData = false
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
