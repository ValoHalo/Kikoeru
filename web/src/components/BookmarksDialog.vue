<template>
  <q-dialog :model-value="true" :position="$q.screen.lt.sm ? 'bottom' : 'standard'" @update:model-value="$emit('close')">
    <q-card class="bookmarks-dialog">
      <q-card-section class="row items-center q-pb-sm">
        <div class="text-h6">{{ $t(track ? 'bookmark.currentTrack' : 'bookmark.currentWork') }}</div>
        <q-space />
        <q-btn flat round dense icon="refresh" :aria-label="$t('bookmark.refresh')" :loading="loading" @click="loadBookmarks"><AppTooltip>{{ $t('bookmark.refresh') }}</AppTooltip></q-btn>
        <q-btn flat round dense icon="close" :aria-label="$t('bookmark.close')" v-close-popup><AppTooltip>{{ $t('bookmark.close') }}</AppTooltip></q-btn>
      </q-card-section>
      <q-card-section v-if="track" class="q-pt-none">
        <div class="text-subtitle1 bookmark-text">{{ track.title }}</div>
        <div v-if="track.subtitle" class="text-caption text-grey bookmark-text">{{ track.subtitle }}</div>
        <q-btn class="q-mt-sm" outline color="primary" icon="bookmark_add" :label="$t('bookmark.record')" :disable="!relativePath || jumping" :loading="saving" @click="recordPosition" />
      </q-card-section>
      <q-separator />
      <div class="bookmarks-list scroll">
        <div v-if="loading" class="q-pa-lg text-center"><q-spinner color="primary" size="28px" :aria-label="$t('bookmark.loading')" /></div>
        <template v-else>
          <div v-if="loadFailed" class="q-pa-lg text-center text-grey">{{ $t('bookmark.loadFailed') }}</div>
          <div v-else-if="!bookmarks.length" class="q-pa-lg text-center text-grey">{{ $t('bookmark.empty') }}</div>
          <section v-for="group in groups" :key="group.path">
            <div v-if="!track" class="q-px-md q-pt-md q-pb-xs">
              <div class="text-subtitle2 bookmark-text">{{ group.title }}</div>
              <div class="text-caption text-grey bookmark-text">{{ group.directory || $t('bookmark.root') }}</div>
            </div>
            <q-list>
              <q-item v-for="bookmark in group.items" :key="bookmark.id" clickable v-ripple :disable="jumping" @click="jumpToBookmark(bookmark)">
                <q-item-section avatar><q-icon name="bookmark_border" color="primary" /></q-item-section>
                <q-item-section>
                  <q-item-label class="bookmark-text">{{ bookmark.name || formatSeconds(bookmark.seconds) }}</q-item-label>
                  <q-item-label v-if="bookmark.name && bookmark.name !== formatSeconds(bookmark.seconds)" caption>{{ formatSeconds(bookmark.seconds) }}</q-item-label>
                  <q-item-label v-if="bookmark.note" caption class="bookmark-text">{{ bookmark.note }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn flat round dense icon="more_vert" :aria-label="$t('bookmark.actions')" @click.stop>
                    <AppTooltip>{{ $t('bookmark.actions') }}</AppTooltip>
                    <q-menu>
                      <q-list dense>
                        <q-item clickable v-close-popup @click="editingBookmark = bookmark"><q-item-section avatar><q-icon name="edit" /></q-item-section><q-item-section>{{ $t('bookmark.edit') }}</q-item-section></q-item>
                        <q-item clickable v-close-popup @click="deleteBookmark(bookmark)"><q-item-section avatar><q-icon name="delete" /></q-item-section><q-item-section>{{ $t('bookmark.delete') }}</q-item-section></q-item>
                      </q-list>
                    </q-menu>
                  </q-btn>
                </q-item-section>
              </q-item>
            </q-list>
          </section>
        </template>
      </div>
    </q-card>
  </q-dialog>
  <BookmarkEditor v-if="editingBookmark" :bookmark="editingBookmark" @saved="onBookmarkUpdated" @close="editingBookmark = null" />
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { formatSeconds } from '../utils'
import NotifyMixin from '../mixins/Notification.js'
import BookmarkEditor from './BookmarkEditor.vue'

export default {
  name: 'BookmarksDialog',
  mixins: [NotifyMixin],
  components: { BookmarkEditor },
  props: {
    workId: { type: Number, required: true },
    track: { type: Object, default: null },
  },
  emits: ['close'],
  data () {
    return {
      bookmarks: [], loading: false, loadFailed: false, saving: false, jumping: false,
      editingBookmark: null, listRequest: 0,
    }
  },
  computed: {
    ...mapState('AudioPlayer', ['currentTime', 'playing', 'playingTranscode', 'queue', 'resumeHistroySeconds']),
    ...mapGetters('AudioPlayer', ['currentPlayingFile', 'sfwOnly']),
    relativePath () {
      if (!this.track) return ''
      return String(this.track.relativePath || [this.track.subtitle, this.track.title].filter(Boolean).join('/')).replace(/\\/g, '/')
    },
    scopeKey () {
      return JSON.stringify([this.$store.state.User.name, this.workId, this.relativePath, this.sfwOnly])
    },
    groups () {
      const groups = new Map()
      for (const bookmark of this.bookmarks) {
        const path = bookmark.relative_path
        if (!groups.has(path)) {
          const parts = path.split('/')
          groups.set(path, { path, title: parts.pop(), directory: parts.join('/'), items: [] })
        }
        groups.get(path).items.push(bookmark)
      }
      for (const group of groups.values()) group.items.sort((a, b) => a.seconds - b.seconds || a.id - b.id)
      return [...groups.values()]
    },
  },
  watch: {
    scopeKey: {
      immediate: true,
      handler () {
        this.bookmarks = []
        this.editingBookmark = null
        this.loadBookmarks()
      },
    },
  },
  beforeUnmount () { this.listRequest++ },
  methods: {
    formatSeconds,
    reportError (error) {
      this.showErrNotif(error.response
        ? error.response.data.error || `${error.response.status} ${error.response.statusText}`
        : error.message || String(error))
    },
    async loadBookmarks () {
      const request = ++this.listRequest
      this.loading = true
      this.loadFailed = false
      try {
        const params = { workId: this.workId }
        if (this.track) params.relativePath = this.relativePath
        const response = await this.$axios.get('/api/bookmarks', { params })
        if (request === this.listRequest) this.bookmarks = response.data.bookmarks
      } catch (error) {
        if (request === this.listRequest) { this.loadFailed = true; this.reportError(error) }
      } finally {
        if (request === this.listRequest) this.loading = false
      }
    },
    async recordPosition () {
      if (this.saving || !this.track || !this.relativePath) return
      const scope = this.scopeKey
      const seconds = this.resumeHistroySeconds >= 0 ? this.resumeHistroySeconds : this.currentTime
      const bookmark = { workId: this.workId, relativePath: this.relativePath, seconds: Math.floor(seconds) }
      this.saving = true
      try {
        await this.$axios.post('/api/bookmarks', bookmark)
        this.showSuccNotif(this.$t('bookmark.saved'))
        if (scope === this.scopeKey) await this.loadBookmarks()
      } catch (error) { this.reportError(error) }
      finally { this.saving = false }
    },
    onBookmarkUpdated (bookmark) {
      this.bookmarks = this.bookmarks.map(item => item.id === bookmark.id ? bookmark : item)
    },
    async deleteBookmark (bookmark) {
      try {
        await this.$axios.delete(`/api/bookmarks/${bookmark.id}`)
        this.bookmarks = this.bookmarks.filter(item => item.id !== bookmark.id)
        this.showSuccNotif(this.$t('bookmark.deleted'))
      } catch (error) { this.reportError(error) }
    },
    async jumpToBookmark (bookmark) {
      if (this.jumping) return
      const scope = this.scopeKey
      const keepPlaying = this.track ? this.playing : true
      this.jumping = true
      try {
        const { data } = await this.$axios.post(`/api/bookmarks/${bookmark.id}/resolve`, {}, { params: { nsfw: this.sfwOnly ? 1 : 0 } })
        if (scope !== this.scopeKey) return
        const target = data.queue[data.index]
        const current = this.currentPlayingFile
        const sameSource = current.mediaStreamUrl === target.mediaStreamUrl && (!this.playingTranscode || current.hash === target.hash)
        const resumePending = this.resumeHistroySeconds >= 0
        let queue = data.queue
        let index = data.index
        if (this.track) {
          index = this.$store.state.AudioPlayer.queueIndex
          queue = this.queue.map((item, position) => position === index ? target : item)
        }
        this.$store.commit('AudioPlayer/SET_WORK_RATINGS', data.queue)
        this.$store.commit('AudioPlayer/SET_QUEUE', {
          workId: target.workId, queue, index, resetPlaying: keepPlaying, resumeHistroySeconds: data.seconds, notifyHistoryRestore: false,
        })
        if (!keepPlaying) this.$store.commit('AudioPlayer/PAUSE')
        if (sameSource && !resumePending) {
          this.$store.commit('AudioPlayer/SET_NEW_CURRENT_TIME', data.seconds)
          this.$store.commit('AudioPlayer/RESUME_HISTROY_SECONDS_DONE')
        }
      } catch (error) {
        if (error.response?.status === 410 && error.response.data.code === 'BOOKMARK_FILE_MISSING') {
          this.bookmarks = this.bookmarks.filter(item => item.id !== bookmark.id)
          this.showWarnNotif(this.$t('bookmark.fileMissing'))
        } else this.reportError(error)
      } finally { this.jumping = false }
    },
  },
}
</script>

<style scoped>
.bookmarks-dialog { width: 560px; max-width: 100%; max-height: 80dvh; display: flex; flex-direction: column; border-radius: 8px; }
.bookmarks-list { min-height: min(100px, 30dvh); }
.bookmark-text { overflow-wrap: anywhere; white-space: pre-wrap; }
</style>
