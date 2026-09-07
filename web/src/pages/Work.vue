<template>
  <div>
    <div class="q-px-md q-pt-sm">
      <q-btn flat dense no-caps icon="arrow_back" label="返回" color="primary" @click="backToWorks" />
    </div>
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
  </div>
</template>

<script>
import WorkDetails from 'components/WorkDetails.vue'
// import WorkQueue from 'components/WorkQueue'
import WorkTree from 'components/WorkTree.vue'
import RelatedWorks from 'components/RelatedWorks.vue'
import NotifyMixin from '../mixins/Notification.js'
import { mapState } from 'vuex'
import { getImportantTreePath } from 'src/utils'

export default {
  name: 'Work',

  mixins: [NotifyMixin],

  components: {
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
      importantTreePathArr: []
    }
  },

  computed: {
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
    backToWorks () {
      const previous = this.$router.options.history.state.back
      if (typeof previous === 'string' && previous.startsWith('/') && !previous.startsWith('//')) this.$router.back()
      else this.$router.push('/works')
    },
    async requestMetaData() {
      try {
        const response = await this.$axios.get(`/api/work/${this.workid}`);
        this.metadata = response.data
        // 如果有播放状态记录
        // 同时当前尚未播放，则设置历史播放进度
        if (this.metadata.state && Array.isArray(this.metadata.state.queue) && this.metadata.state.queue.length > 0 && this.playWorkId == 0) {
          this.resumeMetadataPlayHistroy()
        }
      } catch (error ) {
        if (error.response) {
          // 请求已发出，但服务器响应的状态码不在 2xx 范围内
          this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
        } else {
          this.showErrNotif(error.message || error)
        }
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

    requestData () {
      this.requestMetaData();
      this.requestTracks();
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
