<template>
  <q-dialog :model-value="true" :position="$q.screen.lt.sm ? 'bottom' : 'standard'" @update:model-value="$emit('close')">
    <q-card class="bookmarks-dialog app-form-dialog">
      <q-card-section class="kikoeru-dialog-header">
        <div class="kikoeru-dialog-title-group">
          <span class="kikoeru-dialog-icon">
            <q-icon name="bookmarks" size="18px" />
          </span>
          <div class="kikoeru-dialog-title-text">
            <div class="bookmarks-title-row">
              <span class="kikoeru-dialog-title">{{ $t(track ? 'clips.panelTitle' : 'bookmark.currentWork') }}</span>
              <span v-if="tab === 'bookmarks' && !loading && bookmarks.length" class="bookmarks-count-pill">
                {{ bookmarks.length }}
              </span>
            </div>
            <div v-if="track" class="kikoeru-dialog-subtitle bookmark-text">{{ $privateText(track.title) }}</div>
          </div>
        </div>
        <div class="bookmarks-header-actions">
          <q-btn
            v-if="tab === 'bookmarks'"
            flat
            round
            dense
            icon="refresh"
            class="kikoeru-dialog-close"
            :aria-label="$t('bookmark.refresh')"
            :loading="loading"
            @click="loadBookmarks"
          >
            <AppTooltip>{{ $t('bookmark.refresh') }}</AppTooltip>
          </q-btn>
          <q-btn flat round dense icon="close" class="kikoeru-dialog-close" :aria-label="$t('bookmark.close')" v-close-popup>
            <AppTooltip>{{ $t('bookmark.close') }}</AppTooltip>
          </q-btn>
        </div>
      </q-card-section>

      <div v-if="track" class="bookmarks-track-bar">
        <div v-if="track.subtitle" class="bookmarks-track-dir bookmark-text">{{ $privateText(track.subtitle) }}</div>
        <div class="bookmarks-track-controls">
          <q-tabs v-model="tab" dense align="left" active-color="primary" indicator-color="primary" class="bookmarks-tabs">
            <q-tab name="bookmarks" no-caps :label="$t('bookmark.title')" />
            <q-tab name="clips" no-caps :label="$t('clips.title')" />
          </q-tabs>
          <q-btn
            v-if="tab === 'bookmarks'"
            unelevated
            dense
            no-caps
            color="primary"
            icon="bookmark_add"
            :label="$t('bookmark.record')"
            class="bookmarks-record-btn"
            :disable="!relativePath || jumping"
            :loading="saving"
            @click="recordPosition"
          />
        </div>
      </div>

      <ClipPanel v-if="track && tab === 'clips'" :work-id="workId" :track="track" />

      <div v-else class="bookmarks-list scroll">
        <div v-if="loading" class="bookmarks-state">
          <q-spinner color="primary" size="28px" :aria-label="$t('bookmark.loading')" />
        </div>
        <template v-else>
          <div v-if="loadFailed" class="kikoeru-dialog-empty">
            <span class="kikoeru-dialog-empty-icon"><q-icon name="error_outline" size="22px" /></span>
            <span>{{ $t('bookmark.loadFailed') }}</span>
          </div>
          <div v-else-if="!bookmarks.length" class="kikoeru-dialog-empty">
            <span class="kikoeru-dialog-empty-icon"><q-icon name="bookmark_border" size="22px" /></span>
            <span>{{ $t('bookmark.empty') }}</span>
          </div>
          <div v-else class="bookmarks-groups">
            <section v-for="group in groups" :key="group.path" class="bookmark-group">
              <div v-if="!track" class="bookmark-group-head">
                <q-icon name="audiotrack" size="16px" class="bookmark-group-icon" />
                <div class="bookmark-group-meta">
                  <div class="bookmark-group-title bookmark-text">{{ $privateText(group.title) }}</div>
                  <div class="bookmark-group-dir bookmark-text">{{ group.directory || $t('bookmark.root') }}</div>
                </div>
              </div>
              <q-list separator class="bookmark-group-list">
                <q-item
                  v-for="bookmark in group.items"
                  :key="bookmark.id"
                  clickable
                  v-ripple
                  :disable="jumping"
                  class="bookmark-row"
                  @click="jumpToBookmark(bookmark)"
                >
                  <q-item-section avatar class="bookmark-time-col">
                    <span class="bookmark-time-pill">{{ formatSeconds(bookmark.seconds) }}</span>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="bookmark-name bookmark-text">
                      {{ bookmark.name ? $privateText(bookmark.name) : formatSeconds(bookmark.seconds) }}
                    </q-item-label>
                    <q-item-label v-if="bookmark.note" caption class="bookmark-note bookmark-text">
                      {{ $privateText(bookmark.note) }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn flat round dense icon="more_vert" class="bookmark-more-btn" :aria-label="$t('bookmark.actions')" @click.stop>
                      <AppTooltip>{{ $t('bookmark.actions') }}</AppTooltip>
                      <q-menu anchor="bottom right" self="top right">
                        <q-list dense style="min-width: 136px">
                          <q-item clickable v-close-popup @click="editingBookmark = bookmark">
                            <q-item-section avatar><q-icon name="edit" /></q-item-section>
                            <q-item-section>{{ $t('bookmark.edit') }}</q-item-section>
                          </q-item>
                          <q-item clickable v-close-popup class="kikoeru-danger-text" @click="deleteBookmark(bookmark)">
                            <q-item-section avatar><q-icon name="delete" /></q-item-section>
                            <q-item-section>{{ $t('bookmark.delete') }}</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </q-item-section>
                </q-item>
              </q-list>
            </section>
          </div>
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
import ClipPanel from './ClipPanel.vue'

export default {
  name: 'BookmarksDialog',
  mixins: [NotifyMixin],
  components: { BookmarkEditor, ClipPanel },
  props: {
    workId: { type: Number, required: true },
    track: { type: Object, default: null },
  },
  emits: ['close'],
  data () {
    return {
      bookmarks: [],
      loading: false,
      loadFailed: false,
      saving: false,
      jumping: false,
      editingBookmark: null,
      listRequest: 0,
      tab: 'bookmarks',
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
          if (current.hash === target.hash) {
            this.$store.commit('AudioPlayer/REQUEST_MANUAL_SEEK', { seconds: data.seconds })
          } else {
            this.$store.commit('AudioPlayer/SET_NEW_CURRENT_TIME', data.seconds)
          }
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
.bookmarks-dialog {
  width: min(560px, calc(100vw - 24px));
  max-height: 82dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bookmarks-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bookmarks-count-pill {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-muted);
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.bookmarks-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.bookmarks-track-bar {
  padding: 10px 22px 0;
  border-bottom: 1px solid var(--kikoeru-border);
  background: color-mix(in srgb, var(--kikoeru-inset) 50%, transparent);
}

.bookmarks-track-dir {
  font-size: 12px;
  color: var(--kikoeru-muted);
  margin-bottom: 6px;
}

.bookmarks-track-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.bookmarks-tabs {
  min-width: 0;
}

.bookmarks-record-btn {
  margin-bottom: 6px;
  padding: 2px 10px;
  border-radius: var(--kikoeru-radius-sm);
  font-size: 12.5px;
}

.bookmarks-list {
  min-height: 160px;
  padding: 16px 22px 20px;
}

.bookmarks-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
}

.bookmarks-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bookmark-group {
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-sm);
  overflow: hidden;
  background: var(--kikoeru-surface);
}

.bookmark-group-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--kikoeru-inset);
  border-bottom: 1px solid var(--kikoeru-border);
}

.bookmark-group-icon {
  margin-top: 2px;
  color: var(--kikoeru-accent-text);
  flex-shrink: 0;
}

.bookmark-group-meta {
  min-width: 0;
  flex: 1 1 auto;
}

.bookmark-group-title {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.4;
}

.bookmark-group-dir {
  font-size: 12px;
  color: var(--kikoeru-muted);
}

.bookmark-row {
  min-height: 52px;
  padding: 8px 12px;
}

.bookmark-time-col {
  min-width: 0;
  padding-right: 12px;
}

.bookmark-time-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 5px;
  background: rgba(var(--kikoeru-accent-rgb), 0.12);
  color: var(--kikoeru-accent-text);
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.bookmark-name {
  font-size: 14px;
  font-weight: 500;
}

.bookmark-note {
  margin-top: 2px;
  color: var(--kikoeru-muted);
}

.bookmark-more-btn {
  color: var(--kikoeru-muted);
}

.bookmark-text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

@media (max-width: 599px) {
  .bookmarks-track-bar {
    padding: 8px 16px 0;
  }

  .bookmarks-list {
    padding: 12px 16px 16px;
  }
}
</style>
