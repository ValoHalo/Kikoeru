<template>
  <div class="work-tree-section">
    <div class="work-tree-toolbar">
      <q-breadcrumbs gutter="xs" class="work-tree-breadcrumbs">
        <q-breadcrumbs-el>
          <q-btn no-caps flat dense size="md" icon="folder" :label="$t('workTree.root')" @click="path = []" />
        </q-breadcrumbs-el>

        <q-breadcrumbs-el v-for="(folderName, index) in path" :key="index" class="cursor-pointer">
          <q-btn no-caps flat dense size="md" icon="folder" :label="$privateText(folderName)" @click="onClickBreadcrumb(index)" />
        </q-breadcrumbs-el>
      </q-breadcrumbs>

      <div class="work-tree-actions">
        <q-btn flat round class="work-tree-playlist" icon="keyboard_arrow_up" :aria-label="$t('workTree.backToTop')" @click="scrollToTop"><AppTooltip>{{ $t('workTree.backToTop') }}</AppTooltip></q-btn>
        <q-btn flat round class="work-tree-playlist" icon="playlist_add" :disable="allAudioTracks.length === 0" :aria-label="$t('workTree.addWorkToPlaylist')" @click="openPlaylistPicker(allAudioTracks)"><AppTooltip>{{ $t('workTree.addWorkToPlaylist') }}</AppTooltip></q-btn>
      </div>
    </div>

    <q-dialog v-model="showPlaylistPicker">
      <q-card class="playlist-picker-dialog app-form-dialog">
        <q-card-section><div class="text-h6">{{ $t('workTree.addToPlaylist') }}</div><div class="text-caption text-grey-7">{{ $t('workTree.trackCount', { count: pendingPlaylistTracks.length }) }}</div></q-card-section>
        <q-list v-if="savedPlaylists.length" separator bordered class="scroll" style="max-height: 42vh">
          <q-item v-for="playlist in savedPlaylists" :key="playlist.id" clickable v-ripple @click="addPendingToPlaylist(playlist.id)"><q-item-section avatar><q-icon name="library_music" /></q-item-section><q-item-section><q-item-label>{{ playlist.name }}</q-item-label><q-item-label caption>{{ $t('workTree.playlistTrackCount', { count: playlist.item_count }) }}</q-item-label></q-item-section><q-item-section side><q-icon name="add" /></q-item-section></q-item>
        </q-list>
        <q-card-section v-else-if="!loadingPlaylists" class="text-grey text-center">{{ $t('workTree.noPlaylists') }}</q-card-section>
        <q-separator />
        <q-form @submit.prevent="createPlaylistFromPending">
          <q-card-section><q-input v-model.trim="newPlaylistName" outlined dense :label="$t('workTree.newPlaylistName')" maxlength="80" :rules="[value => Boolean(value) || $t('common.nameRequired')]"><template #append><q-btn flat round dense icon="add" type="submit" :loading="addingToPlaylist" :aria-label="$t('workTree.createAndAdd')" /></template></q-input></q-card-section>
        </q-form>
        <q-card-actions align="right"><q-btn class="app-dialog-cancel" flat :label="$t('common.cancel')" v-close-popup /></q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="edit_img">
      <ImageEditor
        v-if="edit_img"
        :src="edit_img_src"
        :work-id="metadata.id"
        @saved="onCoverSaved"
      />
    </q-dialog>

    <q-dialog v-model="preview_img">
      <q-card v-if="preview_img_list.length" class="image-preview-dialog">
        <q-card-section class="image-preview-header">
          <div class="image-preview-title">
            <div class="text-h6">{{ $privateText(preview_img_name) }}</div>
            <div class="text-subtitle2">{{ preview_img_idx+1 }}/{{ preview_img_list.length }}</div>
          </div>
          <div v-if="isAdministrator || playWorkId > 0" class="image-preview-actions">
            <q-btn
              v-if="isAdministrator"
              outline
              :label="$t('workTree.editCover')"
              @click="editImg(preview_img_list[preview_img_idx])"
            />
            <q-btn v-if="playWorkId > 0" outline @click="setVisualPlayerCover(preview_img_list[preview_img_idx])">{{ $t('workTree.visualizerCover') }}</q-btn>
          </div>
        </q-card-section>

        <q-card-section class="image-preview-stage">
          <q-img class="image-preview-media" :src="$privateImage(preview_img_url)" fit="contain" />
        </q-card-section>

        <q-card-actions align="around">
          <q-btn flat :label="$t('workTree.previous')" color="primary" @click="changePreviewImg(false)" />
          <q-btn flat :label="$t('common.close')" color="negative" v-close-popup />
          <q-btn flat :label="$t('workTree.next')" color="primary" @click="changePreviewImg(true)" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-card v-if="folderEntries.length" flat bordered class="work-tree-card">
      <q-list separator>
        <q-item
          clickable
          v-ripple
          v-for="item in folderEntries"
          :key="item.hash"
          :active="item.type === 'audio' && currentPlayingFile.hash === item.hash"
          active-class="work-tree-item--active"
          @click="onClickItem(item)"
          class="non-selectable work-tree-item"
        >
          <q-item-section avatar style="position: relative;">
            <q-icon size="32px" v-if="item.type === 'folder'" color="amber" name="folder" />
            <q-icon size="32px" v-else-if="isSubtitle(item)" color="info" name="subtitles" />
            <q-icon size="32px" v-else-if="item.type === 'text'" color="info" name="description" />
            <q-icon size="32px" v-else-if="item.type === 'other'" color="info" name="description" />
            <q-btn v-else round dense unelevated color="primary" :icon="playIcon(item.hash)" @click="onClickPlayButton(item.hash)" />

          </q-item-section>

          <q-item-section class="work-tree-filename">
            <q-item-label :class="{ 'text-weight-medium': item.type === 'audio' && currentPlayingFile.hash === item.hash }">{{ $privateText(item.title) }}</q-item-label>
            <q-item-label v-if="item.children" caption lines="1">{{ $t('workTree.itemCount', { count: visibleFiles(item.children).length }) }}</q-item-label>

            <q-item-label
              v-if="item.type === 'audio' && ((Number.isFinite(item.duration) && item.duration >= 0) || isLastPlayed(item))"
              caption
              class="work-tree-audio-meta"
            >
              <span v-if="Number.isFinite(item.duration) && item.duration >= 0" class="work-tree-duration">
                <q-icon size="0.85rem" name="schedule" class="q-mr-xs" />
                {{ formatSeconds(item.duration) }}
              </span>
              <span v-if="isLastPlayed(item)" class="work-tree-last-played">
                {{ $t('workTree.lastPlayed', { time: lastPlayed.time }) }}
              </span>
            </q-item-label>
          </q-item-section>

          <q-item-section v-if="item.type === 'audio'" side class="work-tree-track-actions">
            <div class="row no-wrap items-center q-gutter-x-xs">
              <q-btn
                flat round dense icon="playlist_play"
                class="work-tree-track-btn"
                :aria-label="$t('workTree.playNext')"
                @click.stop="playNext(item)"
              ><AppTooltip>{{ $t('workTree.playNext') }}</AppTooltip></q-btn>
              <q-btn
                flat round dense icon="playlist_add"
                class="work-tree-track-btn"
                :aria-label="$t('workTree.addToQueue')"
                @click.stop="addToQueue(item)"
              ><AppTooltip>{{ $t('workTree.addToQueue') }}</AppTooltip></q-btn>
            </div>
          </q-item-section>

          <!-- 上下文菜单 -->
          <q-menu
            v-if="item.type === 'folder' || item.type === 'audio' || item.type === 'text' || item.type === 'image' || item.type === 'other'"
            touch-position
            context-menu
            auto-close
            transition-show="jump-down"
            transition-hide="jump-up"
          >
            <q-list dense style="min-width: 170px">
              <q-item clickable @click="addToQueue(item)" v-if="item.type === 'audio'">
                <q-item-section avatar><q-icon name="playlist_add" /></q-item-section>
                <q-item-section>{{ $t('workTree.addToQueue') }}</q-item-section>
              </q-item>

              <q-item clickable @click="playNext(item)" v-if="item.type === 'audio'">
                <q-item-section avatar><q-icon name="playlist_play" /></q-item-section>
                <q-item-section>{{ $t('workTree.playNext') }}</q-item-section>
              </q-item>

              <q-item clickable @click="openPlaylistPicker(item.type === 'folder' ? collectAudioTracks(item.children) : [item])" v-if="item.type === 'folder' || item.type === 'audio'">
                <q-item-section avatar><q-icon name="queue_music" /></q-item-section>
                <q-item-section>{{ $t('workTree.addToPlaylist') }}</q-item-section>
              </q-item>

              <q-item clickable @click="download(item)" v-if="item.type !== 'folder'">
                <q-item-section avatar><q-icon name="download" /></q-item-section>
                <q-item-section>{{ $t('workTree.download') }}</q-item-section>
              </q-item>

            </q-list>
          </q-menu>
        </q-item>
      </q-list>
    </q-card>
    <WorkImageGallery
      v-if="folderImages.length"
      :key="JSON.stringify([metadata.id, ...path])"
      :images="folderImages"
      :can-edit="isAdministrator"
      :class="{ 'q-mt-sm': folderEntries.length }"
      @preview="openPreviewImg"
      @edit="editImg"
      @download="download"
    />
  </div>
</template>

<script>
import { t } from '../i18n'
import ImageEditor from './ImageEditor.vue'
import WorkImageGallery from './WorkImageGallery.vue'
import { mapState, mapGetters } from 'vuex'
import { formatSeconds } from '../utils'
import NotifyMixin from '../mixins/Notification.js'
import { initialWorkFolder } from '../utils/workFolder.mjs'

export default {
  name: 'WorkTree',
  emits: ['path-change'],
  mixins: [NotifyMixin],

  components: {
    ImageEditor,
    WorkImageGallery,
  },

  data() {
    return {
      path: [],
      internalTree: [],
      preview_img: false,
      edit_img: false,
      edit_img_src: '',
      preview_img_idx: 0,
      preview_img_list: [],
      showPlaylistPicker: false,
      savedPlaylists: [],
      pendingPlaylistTracks: [],
      newPlaylistName: '',
      loadingPlaylists: false,
      addingToPlaylist: false,
    }
  },

  props: {
    defaultFolder: {
      type: Array,
      default: null,
    },
    tree: {
      type: Array,
      required: true,
    },
    metadata: {
      type: Object,
      required: true,
    },
    importantTreePathArr: {
      type: Array,
      default: () => [],
    }
  },

  watch: {
    tree (value) {
      this.internalTree = value;
      this.initPath();
    },

    importantTreePathArr () {
      this.initPath()
    },

    path: {
      deep: true,
      immediate: true,
      handler (value) { this.$emit('path-change', value.slice()) }
    }
  },

  computed: {
    lastPlayed () {
      const state = this.metadata.state
      const index = Number(state?.index)
      const track = Array.isArray(state?.queue) && Number.isInteger(index) ? state.queue[index] : null
      if (!track || !this.metadata.play_updated_at_full) return null
      const reference = this.playlistItemFromTrack(track)
      if (reference.workId !== Number(this.metadata.id) || !reference.relativePath) return null
      const date = new Date(this.metadata.play_updated_at_full)
      if (!Number.isFinite(date.getTime())) return null
      const time = new Intl.DateTimeFormat(this.$i18n.locale, {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).format(date)
      return { relativePath: reference.relativePath, time }
    },
    isAdministrator () {
      return this.$store.state.User.canManage === true
    },

    fatherFolder () {
      let fatherFolder = this.internalTree.concat()
      this.path.forEach(folderName => {
        fatherFolder = fatherFolder.find(item => item.type === 'folder' && item.title === folderName).children
      })

      return this.visibleFiles(fatherFolder)
    },

    folderEntries () {
      return this.fatherFolder.filter(item => item.type !== 'image')
    },

    folderImages () {
      return this.fatherFolder.filter(item => item.type === 'image')
    },

    queue () {
      const queue = []
      this.fatherFolder.forEach(item => {
        if (item.type === 'audio') {
          queue.push(item)
        }
      })

      return queue
    },

    allAudioTracks () {
      return this.collectAudioTracks(this.internalTree)
    },

    preview_img_url () {
      const item = this.preview_img_list[this.preview_img_idx];
      return item ? this.originalImgSrc(item) : "";
    },

    preview_img_name () {
      const item = this.preview_img_list[this.preview_img_idx];
      return item ? item.title : "";
    },

    ...mapState('AudioPlayer', [
      'playing',
      'playWorkId',
    ]),

    ...mapGetters('AudioPlayer', [
      'currentPlayingFile'
    ])
  },

  methods: {
    formatSeconds,

    isLastPlayed (item) {
      return item.type === 'audio' && this.lastPlayed && this.playlistItemFromTrack(item).relativePath === this.lastPlayed.relativePath
    },

    scrollToTop () { window.scrollTo({ top: 0, behavior: 'smooth' }) },

    isSubtitle (item) {
      return item.type !== 'folder' && /\.(lrc|srt|vtt|ass|ssa)$/i.test(item.title || '')
    },

    visibleFiles (items) {
      return this.$store.state.AudioPlayer.hideSubtitleFiles
        ? items.filter(item => item.type === 'folder' || !/\.(lrc|srt|ass|ssa|vtt)$/i.test(item.title || ''))
        : items
    },

    collectAudioTracks (items, result = []) {
      for (const item of items || []) {
        if (item.type === 'audio') result.push(item)
        else if (item.type === 'folder' && Array.isArray(item.children)) this.collectAudioTracks(item.children, result)
      }
      return result
    },

    playlistItemFromTrack (track) {
      const workId = Number(track.workId) || Number(String(track.hash || '').split('/')[0]) || Number(this.metadata.id)
      const relativePath = track.relativePath || [track.subtitle, track.title].filter(Boolean).join('/')
      return { workId, relativePath: String(relativePath).replace(/\\/g, '/'), title: track.title, workTitle: track.workTitle || this.metadata.title || '' }
    },

    async openPlaylistPicker (tracks) {
      this.pendingPlaylistTracks = (tracks || []).filter(track => track.type === 'audio')
      if (this.pendingPlaylistTracks.length === 0) return
      this.newPlaylistName = ''
      this.showPlaylistPicker = true
      this.loadingPlaylists = true
      try {
        const response = await this.$axios.get('/api/playlists')
        this.savedPlaylists = response.data.playlists || []
      } catch (error) {
        this.showErrNotif(this.playlistError(error, t('workTree.loadPlaylistsFailed')))
      } finally {
        this.loadingPlaylists = false
      }
    },

    async addPendingToPlaylist (playlistId) {
      if (this.addingToPlaylist) return
      this.addingToPlaylist = true
      try {
        await this.$axios.post(`/api/playlists/${playlistId}/items`, { items: this.pendingPlaylistTracks.map(track => this.playlistItemFromTrack(track)) })
        this.showPlaylistPicker = false
        this.showSuccNotif(t('workTree.tracksAdded', { count: this.pendingPlaylistTracks.length }))
      } catch (error) {
        this.showErrNotif(this.playlistError(error, t('workTree.addFailed')))
      } finally {
        this.addingToPlaylist = false
      }
    },

    async createPlaylistFromPending () {
      if (!this.newPlaylistName || this.addingToPlaylist) return
      this.addingToPlaylist = true
      try {
        await this.$axios.post('/api/playlists', { name: this.newPlaylistName, items: this.pendingPlaylistTracks.map(track => this.playlistItemFromTrack(track)) })
        this.showPlaylistPicker = false
        this.showSuccNotif(t('workTree.playlistCreated'))
      } catch (error) {
        this.showErrNotif(this.playlistError(error, t('workTree.createFailed')))
      } finally {
        this.addingToPlaylist = false
      }
    },

    playlistError (error, fallback) {
      return error.response && error.response.data && error.response.data.error ? error.response.data.error : fallback
    },

    playIcon (hash) {
      return this.playing && this.currentPlayingFile.hash === hash ? "pause" : "play_arrow"            
    },

    initPath () {
      this.path = initialWorkFolder(this.internalTree, this.defaultFolder, this.importantTreePathArr)
    },
    
    onClickBreadcrumb (index) {
      this.path = this.path.slice(0, index+1)
    },

    onClickItem (item) {
      if (item.type === 'folder') {
        this.path.push(item.title);
      } else if (this.isSubtitle(item)) {
        this.$router.push({ name: 'lyrics', params: { id: this.metadata.id, hash: String(item.hash).split('/').pop() } });
      } else if (item.type === 'image') {
        this.openPreviewImg(item);
      } else if (item.type === 'text' || item.type === 'image') {
        this.openFile(item);
      } else if (item.type === 'other') {
        this.download(item);
      } else if (this.currentPlayingFile.hash !== item.hash) {
        this.$store.commit('AudioPlayer/SET_QUEUE', {
          workId: this.metadata.id,
          queue: this.queue.concat(),
          index: this.queue.findIndex(file => file.hash === item.hash),
          resetPlaying: true
        })
      }
    },

    onClickPlayButton (hash) {
      if (this.currentPlayingFile.hash === hash) {
        this.$store.commit('AudioPlayer/TOGGLE_PLAYING')
      } else {
        this.$store.commit('AudioPlayer/SET_QUEUE', {
          workId: this.metadata.id,
          queue: this.queue.concat(),
          index: this.queue.findIndex(file => file.hash === hash),
          resetPlaying: true
        })
      }
    },

    addToQueue (file) {
      this.$store.commit('AudioPlayer/ADD_TO_QUEUE', file)
    },

    playNext (file) {
      this.$store.commit('AudioPlayer/PLAY_NEXT', file)
    },

    download (file) {
      // Fallback to old API for an old backend 
      const url = file.mediaDownloadUrl || `/api/media/download/${file.hash}`;
      const link = document.createElement('a');
      link.href = url;
      link.target="_blank";
      link.click();
    },

    setVisualPlayerCover (imgFile) {
      if (!imgFile) return;
      const urlWithoutToken = imgFile.mediaDownloadUrl ? `${imgFile.mediaDownloadUrl}` : `/api/media/download/${imgFile.hash}`;
      this.$store.commit('AudioPlayer/SET_VISUAL_PLAYER_COVER_URL', urlWithoutToken);
      this.$q.notify({
        message: t('workTree.coverSaved'),
        actions: [
          { label: t('workTree.openFullscreen'),
            handler: () => {
              // this.$router.push(`/fullScreenPlayer/${this.playWorkId}`)
              this.$router.push(`/fullScreenPlayer`)
            }
          }
        ],
      });
    },

    openFile (file) {
      // Fallback to old API for an old backend 
      const url = file.mediaStreamUrl || `/api/media/stream/${file.hash}`;
      const link = document.createElement('a');
      link.href = url;
      link.target="_blank";
      link.click();
    },

    originalImgSrc (file) {
      // Fallback to old API for an old backend 
      const url = file.mediaStreamUrl || `/api/media/stream/${file.hash}`;
      return url
    },

    openPreviewImg(item) {
      const preview_img_list = this.folderImages
      let preview_img_idx = -1;
      preview_img_list.forEach((i, idx) => {
        if (i.hash === item.hash) {
          preview_img_idx = idx;
        }
      });
      this.preview_img = true;
      this.preview_img_list = preview_img_list;
      this.preview_img_idx = preview_img_idx;
    },

    changePreviewImg(next) {
      if (this.preview_img_list.length <= 1) return;
      const length = this.preview_img_list.length;
      this.preview_img_idx = (length +this.preview_img_idx + (next ? 1 : -1) ) % length;
    },

    editImg (item) {
      if (!item) return
      this.edit_img_src = this.originalImgSrc(item)
      this.edit_img = true
    },

    onCoverSaved () {
      this.edit_img = false
      this.$router.go(0)
    },
  },
  
  mounted() {
    this.internalTree = this.tree;
    this.initPath()
  }
}
</script>

<style scoped>
.work-tree-section { margin: 12px 0 24px; }
.work-tree-card {
  background: var(--kikoeru-surface);
  border-color: var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  overflow: hidden;
  box-shadow: none;
}
.work-tree-item {
  min-height: 58px;
  padding-top: 8px;
  padding-bottom: 8px;
  transition: background-color .15s ease;
}
.work-tree-item--active {
  background: var(--kikoeru-active-bg);
  color: var(--kikoeru-accent-text);
  box-shadow: inset 3px 0 0 var(--q-primary);
}
.work-tree-filename { min-width: 0; overflow-wrap: anywhere; }
.work-tree-audio-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; color: var(--kikoeru-muted); }
.work-tree-item--active .work-tree-audio-meta { color: inherit; opacity: 0.85; }
.work-tree-duration { display: inline-flex; align-items: center; white-space: nowrap; }
.work-tree-last-played { color: var(--kikoeru-accent-text); white-space: normal; overflow-wrap: anywhere; }
.work-tree-track-actions { padding-left: 8px; }
.work-tree-track-actions .q-btn { width: 32px; height: 32px; min-width: 32px; min-height: 32px; color: var(--kikoeru-accent-text); }
.work-tree-actions { display: flex; gap: 4px; color: var(--kikoeru-muted); }

.work-tree-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  margin-bottom: 8px;
}

.work-tree-breadcrumbs {
  min-width: 0;
  padding: 6px 0;
}

.work-tree-breadcrumbs :deep(.q-breadcrumbs__el),
.work-tree-breadcrumbs :deep(.q-btn) {
  min-width: 0;
  max-width: 100%;
}

.work-tree-breadcrumbs :deep(.q-btn .block) {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: left;
}

.work-tree-breadcrumbs :deep(.q-btn__content) {
  flex-wrap: nowrap;
}

.work-tree-playlist {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
}

.playlist-picker-dialog {
  width: 460px;
  max-width: 92vw;
  max-height: 80vh;
  border-radius: 8px;
}

.image-preview-dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(1200px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  height: min(920px, calc(100vh - 48px));
  height: min(920px, calc(100dvh - 48px));
  max-height: calc(100vh - 48px);
  max-height: calc(100dvh - 48px);
}

.image-preview-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.image-preview-title {
  min-width: 0;
  flex: 1 1 240px;
}

.image-preview-title .text-h6 {
  overflow-wrap: anywhere;
}

.image-preview-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-preview-stage {
  display: flex;
  min-height: 0;
  padding: 0 16px;
}

.image-preview-media {
  width: 100%;
  height: 100%;
}

@media (max-width: 599px) {
  .image-preview-title {
    flex-basis: 100%;
  }

  .image-preview-actions {
    width: 100%;
  }

  .image-preview-actions .q-btn {
    min-width: 0;
    flex: 1 1 0;
  }
}
</style>
