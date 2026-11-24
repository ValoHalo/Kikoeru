<template>
  <div class="work-tree-section">
    <q-card flat bordered class="work-tree-card">
      <div class="work-tree-toolbar">
        <div class="work-tree-nav">
          <q-breadcrumbs gutter="xs" class="work-tree-breadcrumbs">
            <template #separator>
              <q-icon size="16px" name="chevron_right" class="work-tree-sep" />
            </template>
            <q-breadcrumbs-el>
              <q-btn
                no-caps
                flat
                dense
                size="sm"
                icon="folder"
                :label="$t('workTree.root')"
                class="work-crumb-btn"
                :class="{ 'work-crumb-btn--current': path.length === 0 }"
                @click="path = []"
              />
            </q-breadcrumbs-el>

            <q-breadcrumbs-el v-for="(folderName, index) in path" :key="index" class="cursor-pointer">
              <q-btn
                no-caps
                flat
                dense
                size="sm"
                icon="folder_open"
                :label="$privateText(folderName)"
                class="work-crumb-btn"
                :class="{ 'work-crumb-btn--current': index === path.length - 1 }"
                @click="onClickBreadcrumb(index)"
              />
            </q-breadcrumbs-el>
          </q-breadcrumbs>

          <div v-if="queue.length > 0" class="work-tree-summary">
            <span>{{ $t('workTree.trackCount', { count: queue.length }) }}</span>
            <span v-if="currentFolderDuration > 0" class="work-tree-summary-dot" aria-hidden="true">·</span>
            <span v-if="currentFolderDuration > 0" class="work-tree-tabular">{{ formatSeconds(currentFolderDuration) }}</span>
          </div>
        </div>

        <div class="work-tree-actions">
          <slot name="folder-actions" />
          <slot name="toolbar-actions" />
        </div>
      </div>

      <q-list v-if="folderEntries.length" separator class="work-tree-list">
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
          <q-item-section avatar class="work-tree-avatar">
            <span v-if="item.type === 'folder'" class="work-file-badge work-file-badge--folder">
              <q-icon size="20px" name="folder" />
            </span>
            <span v-else-if="isSubtitle(item)" class="work-file-badge work-file-badge--subtitle">
              <q-icon size="20px" name="subtitles" />
            </span>
            <span v-else-if="item.type === 'text'" class="work-file-badge work-file-badge--doc">
              <q-icon size="20px" name="description" />
            </span>
            <span v-else-if="item.type === 'other'" class="work-file-badge work-file-badge--other">
              <q-icon size="20px" name="insert_drive_file" />
            </span>
            <q-btn
              v-else
              round
              dense
              unelevated
              class="work-track-play-btn"
              :class="{ 'work-track-play-btn--active': currentPlayingFile.hash === item.hash }"
              :icon="playIcon(item.hash)"
              @click.stop="onClickPlayButton(item.hash)"
            />
          </q-item-section>

          <q-item-section class="work-tree-filename">
            <q-item-label
              class="work-tree-item-title"
              :class="{ 'work-tree-item-title--active': item.type === 'audio' && currentPlayingFile.hash === item.hash }"
            >
              {{ $privateText(item.title) }}
            </q-item-label>

            <q-item-label
              v-if="item.type === 'audio' && ((Number.isFinite(item.duration) && item.duration >= 0) || isLastPlayed(item))"
              caption
              class="work-tree-audio-meta"
            >
              <span v-if="Number.isFinite(item.duration) && item.duration >= 0" class="work-tree-duration work-tree-tabular">
                <q-icon size="13px" name="schedule" />
                <span>{{ formatSeconds(item.duration) }}</span>
              </span>
              <span v-if="isLastPlayed(item)" class="work-tree-last-played">
                <q-icon size="13px" name="history" />
                <span>{{ $t('workTree.lastPlayed', { time: lastPlayed.time }) }}</span>
              </span>
            </q-item-label>
          </q-item-section>

          <!-- 文件夹右侧数量与指示 -->
          <q-item-section v-if="item.type === 'folder'" side class="work-tree-folder-side">
            <div class="row no-wrap items-center q-gutter-x-xs">
              <span v-if="item.children" class="work-folder-count">
                {{ $t('workTree.itemCount', { count: visibleFiles(item.children).length }) }}
              </span>
              <q-btn
                v-if="collectAudioTracks(item.children).length > 0"
                flat
                round
                dense
                icon="more_vert"
                class="work-tree-more-btn"
                :aria-label="$t('workTree.moreActions')"
                @click.stop
              >
                <AppTooltip>{{ $t('workTree.moreActions') }}</AppTooltip>
                <q-menu anchor="bottom right" self="top right">
                  <q-list dense style="min-width: 170px">
                    <q-item clickable v-close-popup @click="openPlaylistPicker(collectAudioTracks(item.children))">
                      <q-item-section avatar><q-icon name="queue_music" /></q-item-section>
                      <q-item-section>{{ $t('workTree.addToPlaylist') }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
              <q-icon name="chevron_right" size="18px" class="work-folder-chevron" />
            </div>
          </q-item-section>

          <!-- 音频行快捷操作 -->
          <q-item-section v-else-if="item.type === 'audio'" side class="work-tree-track-actions">
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
              <q-btn
                flat round dense icon="more_vert"
                class="work-tree-more-btn"
                :aria-label="$t('workTree.moreActions')"
                @click.stop
              >
                <AppTooltip>{{ $t('workTree.moreActions') }}</AppTooltip>
                <q-menu anchor="bottom right" self="top right">
                  <q-list dense style="min-width: 170px">
                    <q-item clickable v-close-popup @click="openPlaylistPicker([item])">
                      <q-item-section avatar><q-icon name="queue_music" /></q-item-section>
                      <q-item-section>{{ $t('workTree.addToPlaylist') }}</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="download(item)">
                      <q-item-section avatar><q-icon name="download" /></q-item-section>
                      <q-item-section>{{ $t('workTree.download') }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </q-item-section>

          <!-- 文本/字幕/其它文件快捷下载 -->
          <q-item-section v-else side class="work-tree-track-actions">
            <q-btn
              flat round dense icon="download"
              class="work-tree-more-btn"
              :aria-label="$t('workTree.download')"
              @click.stop="download(item)"
            ><AppTooltip>{{ $t('workTree.download') }}</AppTooltip></q-btn>
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

    <section v-if="folderImages.length" class="work-gallery-card">
      <div class="work-gallery-header">
        <q-icon name="photo_library" size="17px" class="work-gallery-icon" />
        <span class="work-gallery-title">{{ $t('workTree.imagesTitle') }}</span>
        <span class="work-gallery-count">{{ folderImages.length }}</span>
      </div>
      <WorkImageGallery
        :key="JSON.stringify([metadata.id, ...path])"
        :images="folderImages"
        :can-edit="isAdministrator"
        @preview="openPreviewImg"
        @edit="editImg"
        @download="download"
      />
    </section>

    <q-dialog v-model="showPlaylistPicker">
      <q-card class="playlist-picker-dialog app-form-dialog">
        <q-card-section class="kikoeru-dialog-header">
          <div class="kikoeru-dialog-title-group">
            <span class="kikoeru-dialog-icon">
              <q-icon name="queue_music" size="18px" />
            </span>
            <div class="kikoeru-dialog-title-text">
              <div class="kikoeru-dialog-title">{{ $t('workTree.addToPlaylist') }}</div>
              <div class="kikoeru-dialog-subtitle">{{ $t('workTree.trackCount', { count: pendingPlaylistTracks.length }) }}</div>
            </div>
          </div>
          <q-btn flat round dense icon="close" class="kikoeru-dialog-close" :aria-label="$t('common.close')" v-close-popup />
        </q-card-section>

        <q-card-section class="kikoeru-dialog-body playlist-picker-body">
          <div v-if="loadingPlaylists" class="q-pa-md text-center">
            <q-spinner color="primary" size="26px" />
          </div>
          <q-list v-else-if="savedPlaylists.length" separator class="playlist-picker-list scroll">
            <q-item
              v-for="playlist in savedPlaylists"
              :key="playlist.id"
              clickable
              v-ripple
              class="playlist-picker-item"
              @click="addPendingToPlaylist(playlist.id)"
            >
              <q-item-section avatar class="playlist-picker-avatar">
                <q-icon name="library_music" size="20px" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="playlist-picker-name">{{ playlist.name }}</q-item-label>
                <q-item-label caption>{{ $t('workTree.playlistTrackCount', { count: playlist.item_count }) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon name="add" size="18px" color="primary" />
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="kikoeru-dialog-empty">
            <span class="kikoeru-dialog-empty-icon"><q-icon name="queue_music" size="22px" /></span>
            <span>{{ $t('workTree.noPlaylists') }}</span>
          </div>

          <q-form class="playlist-picker-create" @submit.prevent="createPlaylistFromPending">
            <div class="kikoeru-dialog-field-label">{{ $t('workTree.createAndAdd') }}</div>
            <div class="playlist-picker-create-row">
              <q-input
                v-model.trim="newPlaylistName"
                outlined
                dense
                hide-bottom-space
                class="playlist-picker-input"
                :placeholder="$t('workTree.newPlaylistName')"
                maxlength="80"
                :rules="[value => Boolean(value) || $t('common.nameRequired')]"
              />
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="add"
                :label="$t('common.create')"
                type="submit"
                class="playlist-picker-create-btn"
                :disable="!newPlaylistName"
                :loading="addingToPlaylist"
              />
            </div>
          </q-form>
        </q-card-section>

        <q-card-actions class="kikoeru-dialog-footer">
          <q-btn class="app-dialog-cancel" flat no-caps :label="$t('common.cancel')" v-close-popup />
        </q-card-actions>
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
            <div class="text-subtitle2">{{ preview_img_idx + 1 }}/{{ preview_img_list.length }}</div>
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

  data () {
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
      this.internalTree = value
      this.initPath()
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

    currentFolderDuration () {
      return this.queue.reduce((sum, item) => (Number.isFinite(item.duration) && item.duration > 0 ? sum + item.duration : sum), 0)
    },

    allAudioTracks () {
      return this.collectAudioTracks(this.internalTree)
    },

    preview_img_url () {
      const item = this.preview_img_list[this.preview_img_idx]
      return item ? this.originalImgSrc(item) : ''
    },

    preview_img_name () {
      const item = this.preview_img_list[this.preview_img_idx]
      return item ? item.title : ''
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

    audioTracksAtPath (folderPath) {
      let items = this.internalTree
      for (const name of folderPath || []) {
        const next = (items || []).find(item => item.type === 'folder' && item.title === name)
        if (!next) return []
        items = next.children || []
      }
      return this.visibleFiles(items || []).filter(item => item.type === 'audio')
    },

    playPrimary () {
      let tracks = this.queue
      if (!tracks.length) {
        const primaryPath = initialWorkFolder(this.internalTree, this.defaultFolder, this.importantTreePathArr)
        tracks = this.audioTracksAtPath(primaryPath)
      }
      if (!tracks.length) tracks = this.allAudioTracks
      if (!tracks.length) return
      this.$store.commit('AudioPlayer/SET_QUEUE', {
        workId: this.metadata.id,
        queue: tracks.concat(),
        index: 0,
        resetPlaying: true
      })
    },

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
      return this.playing && this.currentPlayingFile.hash === hash ? 'pause' : 'play_arrow'
    },

    initPath () {
      this.path = initialWorkFolder(this.internalTree, this.defaultFolder, this.importantTreePathArr)
    },

    onClickBreadcrumb (index) {
      this.path = this.path.slice(0, index + 1)
    },

    onClickItem (item) {
      if (item.type === 'folder') {
        this.path.push(item.title)
      } else if (this.isSubtitle(item)) {
        this.$router.push({ name: 'lyrics', params: { id: this.metadata.id, hash: String(item.hash).split('/').pop() } })
      } else if (item.type === 'image') {
        this.openPreviewImg(item)
      } else if (item.type === 'text' || item.type === 'image') {
        this.openFile(item)
      } else if (item.type === 'other') {
        this.download(item)
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
      const url = file.mediaDownloadUrl || `/api/media/download/${file.hash}`
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.click()
    },

    setVisualPlayerCover (imgFile) {
      if (!imgFile) return
      const urlWithoutToken = imgFile.mediaDownloadUrl ? `${imgFile.mediaDownloadUrl}` : `/api/media/download/${imgFile.hash}`
      this.$store.commit('AudioPlayer/SET_VISUAL_PLAYER_COVER_URL', urlWithoutToken)
      this.$q.notify({
        message: t('workTree.coverSaved'),
        actions: [
          {
            label: t('workTree.openFullscreen'),
            handler: () => {
              this.$router.push('/fullScreenPlayer')
            }
          }
        ],
      })
    },

    openFile (file) {
      const url = file.mediaStreamUrl || `/api/media/stream/${file.hash}`
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.click()
    },

    originalImgSrc (file) {
      const url = file.mediaStreamUrl || `/api/media/stream/${file.hash}`
      return url
    },

    openPreviewImg (item) {
      const preview_img_list = this.folderImages
      let preview_img_idx = -1
      preview_img_list.forEach((i, idx) => {
        if (i.hash === item.hash) {
          preview_img_idx = idx
        }
      })
      this.preview_img = true
      this.preview_img_list = preview_img_list
      this.preview_img_idx = preview_img_idx
    },

    changePreviewImg (next) {
      if (this.preview_img_list.length <= 1) return
      const length = this.preview_img_list.length
      this.preview_img_idx = (length + this.preview_img_idx + (next ? 1 : -1)) % length
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

  mounted () {
    this.internalTree = this.tree
    this.initPath()
  }
}
</script>

<style scoped>
.work-tree-section {
  margin: 16px 0 28px;
}

.work-tree-card {
  background: var(--kikoeru-surface);
  border-color: var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  overflow: hidden;
  box-shadow: var(--kikoeru-shadow-card);
}

.work-tree-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px 14px;
  padding: 10px 14px;
  background: var(--kikoeru-inset);
  border-bottom: 1px solid var(--kikoeru-border);
}

.work-tree-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  min-width: 0;
}

.work-tree-breadcrumbs {
  min-width: 0;
}

.work-tree-sep {
  color: var(--kikoeru-muted);
  opacity: 0.7;
}

.work-crumb-btn {
  min-height: 30px;
  padding: 2px 7px;
  border-radius: var(--kikoeru-radius-sm);
  color: var(--kikoeru-muted);
  font-size: 13.5px;
  font-weight: 500;
}

.work-crumb-btn:hover {
  color: var(--kikoeru-accent-text);
}

.work-crumb-btn--current {
  color: var(--kikoeru-text);
  font-weight: 600;
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

.work-tree-summary {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--kikoeru-surface);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-muted);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.work-tree-summary-dot {
  opacity: 0.6;
}

.work-tree-tabular {
  font-variant-numeric: tabular-nums;
}

.work-tree-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  color: var(--kikoeru-muted);
}

.work-tree-play-folder {
  min-height: 32px;
  padding: 0 10px;
  border-radius: var(--kikoeru-radius-sm);
  background: rgba(var(--kikoeru-accent-rgb), 0.12);
  color: var(--kikoeru-accent-text);
  font-weight: 500;
}

.work-tree-play-folder:hover {
  background: rgba(var(--kikoeru-accent-rgb), 0.2);
}

.work-tree-icon-btn {
  width: 34px;
  height: 34px;
  min-width: 34px;
  min-height: 34px;
  color: var(--kikoeru-muted);
}

.work-tree-icon-btn:hover {
  color: var(--kikoeru-accent-text);
}

.work-tree-item {
  min-height: 60px;
  padding: 10px 14px;
  transition: background-color .15s ease;
}

.work-tree-item:hover {
  background: color-mix(in srgb, var(--kikoeru-inset) 70%, transparent);
}

.work-tree-item--active {
  background: var(--kikoeru-active-bg) !important;
  color: var(--kikoeru-accent-text);
  box-shadow: inset 3px 0 0 var(--q-primary);
}

.work-tree-avatar {
  min-width: 48px;
  padding-right: 12px;
}

.work-file-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.work-file-badge--folder {
  background: rgba(245, 158, 11, 0.14);
  color: #d97706;
}

.body--dark .work-file-badge--folder {
  background: rgba(251, 191, 36, 0.16);
  color: #fbbf24;
}

.work-file-badge--subtitle {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.body--dark .work-file-badge--subtitle {
  background: rgba(74, 222, 128, 0.16);
  color: #86efac;
}

.work-file-badge--doc,
.work-file-badge--other {
  background: rgba(var(--kikoeru-accent-rgb), 0.1);
  color: var(--kikoeru-accent-text);
}

.work-track-play-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  background: rgba(var(--kikoeru-accent-rgb), 0.12);
  color: var(--kikoeru-accent-text);
  transition: background-color .15s ease, color .15s ease, transform .15s ease;
}

.work-tree-item:hover .work-track-play-btn,
.work-track-play-btn--active {
  background: var(--q-primary);
  color: var(--kikoeru-on-accent);
}

.work-tree-filename {
  min-width: 0;
  overflow-wrap: anywhere;
}

.work-tree-item-title {
  font-size: 14.5px;
  line-height: 1.45;
  color: var(--kikoeru-text);
}

.work-tree-item-title--active {
  font-weight: 600;
  color: var(--kikoeru-accent-text);
}

.work-tree-audio-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 3px;
  color: var(--kikoeru-muted);
}

.work-tree-item--active .work-tree-audio-meta {
  color: inherit;
  opacity: 0.9;
}

.work-tree-duration {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  font-size: 12.5px;
}

.work-tree-last-played {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border-radius: 4px;
  background: rgba(var(--kikoeru-accent-rgb), 0.12);
  color: var(--kikoeru-accent-text);
  font-size: 12px;
  font-weight: 500;
  white-space: normal;
  overflow-wrap: anywhere;
}

.work-tree-folder-side {
  padding-left: 8px;
}

.work-folder-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.work-folder-chevron {
  color: var(--kikoeru-muted);
  opacity: 0.7;
}

.work-tree-track-actions {
  padding-left: 8px;
}

.work-tree-track-btn,
.work-tree-more-btn {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  color: var(--kikoeru-muted);
  transition: color .15s ease;
}

.work-tree-track-btn:hover,
.work-tree-more-btn:hover {
  color: var(--kikoeru-accent-text);
}

.work-gallery-card {
  margin-top: 16px;
  padding: 14px 16px 16px;
  background: var(--kikoeru-surface);
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  box-shadow: var(--kikoeru-shadow-card);
}

.work-gallery-header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 12px;
}

.work-gallery-icon {
  color: var(--kikoeru-muted);
}

.work-gallery-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--kikoeru-text);
}

.work-gallery-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-muted);
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.playlist-picker-dialog {
  width: min(460px, calc(100vw - 28px));
  max-height: 82dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.playlist-picker-body {
  min-height: 0;
  gap: 14px !important;
}

.playlist-picker-list {
  max-height: 36vh;
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
}

.playlist-picker-item {
  min-height: 50px;
}

.playlist-picker-avatar {
  min-width: 36px;
  color: var(--kikoeru-accent-text);
}

.playlist-picker-name {
  font-weight: 500;
  overflow-wrap: anywhere;
}

.playlist-picker-create {
  padding-top: 12px;
  border-top: 1px solid var(--kikoeru-border);
}

.playlist-picker-create-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.playlist-picker-input {
  flex: 1 1 auto;
  min-width: 0;
}

.playlist-picker-create-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: var(--kikoeru-radius-sm);
  flex-shrink: 0;
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

@media (max-width: 699px) {
  .work-tree-toolbar {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding: 10px 12px;
  }

  .work-tree-actions {
    justify-content: flex-end;
  }

  .work-tree-item {
    padding: 10px 12px;
  }

  .work-gallery-card {
    padding: 12px 14px 14px;
  }

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

@media (prefers-reduced-motion: reduce) {
  .work-tree-item,
  .work-track-play-btn {
    transition: none;
  }
}
</style>
