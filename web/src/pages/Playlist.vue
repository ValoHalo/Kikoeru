<template>
  <q-page class="playlist-page q-pa-md">
    <div class="row items-center q-mb-sm">
      <div class="text-h5">{{ $t('common.playlists') }}</div>
      <q-space />
      <q-btn v-if="activeTab === 'current'" flat round icon="save" :disable="queue.length === 0" :aria-label="$t('playlist.saveQueue')" @click="openSaveDialog"><q-tooltip>{{ $t('playlist.saveQueue') }}</q-tooltip></q-btn>
      <q-btn v-if="activeTab === 'current'" flat round color="negative" icon="delete_sweep" :disable="queue.length === 0" :aria-label="$t('playlist.clearQueue')" @click="EMPTY_QUEUE"><q-tooltip>{{ $t('playlist.clearQueue') }}</q-tooltip></q-btn>
    </div>

    <q-tabs v-model="activeTab" dense align="left" active-color="primary" indicator-color="primary" class="playlist-tabs q-mb-md">
      <q-tab name="current" icon="queue_music" :label="$t('playlist.currentQueue')" />
      <q-tab name="saved" icon="library_music" :label="$t('playlist.savedPlaylists')" />
    </q-tabs>

    <q-tab-panels v-model="activeTab" animated class="bg-transparent">
      <q-tab-panel name="current" class="q-pa-none">
        <q-list v-if="queueCopy.length" bordered separator>
          <draggable v-model="queueCopy" item-key="hash" handle=".current-queue-handle" @change="onCurrentQueueMoved">
            <template #item="{ element: track, index }">
              <q-item clickable v-ripple :active="queueIndex === index" active-class="bg-primary text-white" @click="SET_TRACK(index)">
                <q-item-section avatar><q-img :key="coverUrl(track)" :src="coverUrl(track)" ratio="1" class="playlist-cover rounded-borders" /></q-item-section>
                <q-item-section><q-item-label lines="1">{{ track.title }}</q-item-label><q-item-label caption lines="1" :class="{ 'text-white': queueIndex === index }">{{ track.workTitle }}</q-item-label></q-item-section>
                <q-item-section side class="current-queue-handle"><q-icon name="drag_handle" :color="queueIndex === index ? 'white' : 'grey-7'" /></q-item-section>
                <q-item-section side><q-btn flat round dense icon="close" :color="queueIndex === index ? 'white' : 'negative'" :aria-label="$t('playlist.removeFromQueue')" @click.stop="REMOVE_FROM_QUEUE(index)" /></q-item-section>
              </q-item>
            </template>
          </draggable>
        </q-list>
        <div v-else class="playlist-empty text-center text-grey q-pa-xl"><q-icon name="queue_music" size="42px" class="q-mb-sm" /><div>{{ $t('playlist.emptyQueue') }}</div></div>
      </q-tab-panel>

      <q-tab-panel name="saved" class="q-pa-none">
        <div class="row q-col-gutter-md">
          <div v-if="!selectedPlaylist || $q.screen.gt.sm" class="col-12 col-md-4">
            <div class="row items-center q-mb-sm"><div class="text-subtitle1 text-weight-medium">{{ $t('playlist.savedPlaylists') }}</div><q-space /><q-btn flat round dense icon="refresh" :loading="loadingPlaylists" :aria-label="$t('playlist.refresh')" @click="loadPlaylists"><q-tooltip>{{ $t('common.refresh') }}</q-tooltip></q-btn></div>
            <q-list v-if="playlists.length" bordered separator>
              <q-item v-for="playlist in playlists" :key="playlist.id" clickable v-ripple :active="selectedPlaylist && selectedPlaylist.id === playlist.id" active-class="bg-primary text-white" @click="openPlaylist(playlist.id)">
                <q-item-section avatar><q-icon name="library_music" /></q-item-section>
                <q-item-section><q-item-label lines="1">{{ playlist.name }}</q-item-label><q-item-label caption :class="{ 'text-white': selectedPlaylist && selectedPlaylist.id === playlist.id }">{{ $t('playlist.trackCount', { count: playlist.item_count }) }}</q-item-label></q-item-section>
                <q-item-section side><q-icon name="chevron_right" :color="selectedPlaylist && selectedPlaylist.id === playlist.id ? 'white' : undefined" /></q-item-section>
              </q-item>
            </q-list>
            <div v-else-if="!loadingPlaylists" class="playlist-empty text-center text-grey q-pa-xl"><q-icon name="library_music" size="42px" class="q-mb-sm" /><div>{{ $t('playlist.noPlaylists') }}</div></div>
          </div>

          <div v-if="selectedPlaylist" class="col-12 col-md-8">
            <div class="row items-center q-mb-sm no-wrap">
              <q-btn v-if="$q.screen.lt.md" flat round dense icon="arrow_back" :aria-label="$t('playlist.back')" @click="closePlaylist" />
              <div class="col text-subtitle1 text-weight-medium ellipsis q-ml-sm">{{ selectedPlaylist.name }}</div>
              <q-space />
              <q-btn flat round dense icon="play_arrow" :disable="availableItems.length === 0" :aria-label="$t('playlist.playList')" @click="playSelected"><q-tooltip>{{ $t('playlist.play') }}</q-tooltip></q-btn>
              <q-btn flat round dense icon="playlist_add" :disable="availableItems.length === 0" :aria-label="$t('playlist.append')" @click="appendSelected"><q-tooltip>{{ $t('playlist.append') }}</q-tooltip></q-btn>
              <q-btn flat round dense icon="more_vert" :aria-label="$t('playlist.moreActions')"><q-menu><q-list dense style="min-width: 140px"><q-item clickable v-close-popup @click="openRenameDialog"><q-item-section avatar><q-icon name="edit" /></q-item-section><q-item-section>{{ $t('common.rename') }}</q-item-section></q-item><q-item clickable v-close-popup class="text-negative" @click="confirmDeletePlaylist"><q-item-section avatar><q-icon name="delete" /></q-item-section><q-item-section>{{ $t('common.delete') }}</q-item-section></q-item></q-list></q-menu></q-btn>
            </div>
            <q-list v-if="playlistItems.length" bordered separator>
              <draggable v-model="playlistItems" item-key="itemId" handle=".saved-playlist-handle" @change="savePlaylistOrder">
                <template #item="{ element: track }">
                  <q-item :class="{ 'text-grey-6': !track.available }">
                    <q-item-section avatar><q-img v-if="track.available" :key="coverUrl(track)" :src="coverUrl(track)" ratio="1" class="playlist-cover rounded-borders" /><q-icon v-else name="link_off" size="28px" /></q-item-section>
                    <q-item-section><q-item-label lines="1">{{ track.title }}</q-item-label><q-item-label caption lines="1">{{ track.workTitle }}{{ track.available ? '' : $t('playlist.unavailable') }}</q-item-label></q-item-section>
                    <q-item-section side class="saved-playlist-handle"><q-icon name="drag_handle" /></q-item-section>
                    <q-item-section side><q-btn flat round dense icon="close" color="negative" :aria-label="$t('playlist.removeTrack')" @click="removeSavedItem(track)" /></q-item-section>
                  </q-item>
                </template>
              </draggable>
            </q-list>
            <div v-else class="playlist-empty text-center text-grey q-pa-xl">{{ $t('playlist.empty') }}</div>
          </div>
          <div v-else-if="$q.screen.gt.sm" class="col-md-8 playlist-empty text-center text-grey q-pa-xl"><q-icon name="queue_music" size="42px" class="q-mb-sm" /><div>{{ $t('playlist.select') }}</div></div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <q-dialog v-model="showSaveDialog"><q-card class="playlist-dialog"><q-form @submit.prevent="saveCurrentQueue"><q-card-section><div class="text-h6">{{ $t('playlist.saveQueue') }}</div></q-card-section><q-card-section class="q-pt-none"><q-input v-model.trim="newPlaylistName" autofocus outlined :label="$t('playlist.name')" maxlength="80" :rules="[value => Boolean(value) || $t('common.nameRequired')]" /></q-card-section><q-card-actions align="right"><q-btn flat :label="$t('common.cancel')" v-close-popup /><q-btn flat color="primary" :label="$t('common.save')" type="submit" :loading="savingPlaylist" /></q-card-actions></q-form></q-card></q-dialog>
    <q-dialog v-model="showRenameDialog"><q-card class="playlist-dialog"><q-form @submit.prevent="renameSelectedPlaylist"><q-card-section><div class="text-h6">{{ $t('playlist.rename') }}</div></q-card-section><q-card-section class="q-pt-none"><q-input v-model.trim="renameValue" autofocus outlined :label="$t('playlist.name')" maxlength="80" :rules="[value => Boolean(value) || $t('common.nameRequired')]" /></q-card-section><q-card-actions align="right"><q-btn flat :label="$t('common.cancel')" v-close-popup /><q-btn flat color="primary" :label="$t('common.save')" type="submit" /></q-card-actions></q-form></q-card></q-dialog>
  </q-page>
</template>

<script>
import { t } from '../i18n'
import draggable from 'vuedraggable'
import { mapMutations, mapState } from 'vuex'
import NotifyMixin from '../mixins/Notification.js'

export default {
  name: 'Playlist',
  components: { draggable },
  mixins: [NotifyMixin],
  data () {
    return {
      activeTab: 'current', queueCopy: [], playlists: [], selectedPlaylist: null, playlistItems: [], loadingPlaylists: false,
      showSaveDialog: false, savingPlaylist: false, newPlaylistName: '', showRenameDialog: false, renameValue: '',
    }
  },
  computed: {
    ...mapState('AudioPlayer', ['queue', 'queueIndex', 'playWorkId']),
    availableItems () { return this.playlistItems.filter(item => item.available) },
  },
  watch: {
    queue: { immediate: true, handler (value) { this.queueCopy = value.concat() } },
    activeTab (value) { if (value === 'saved' && this.playlists.length === 0) this.loadPlaylists() },
  },
  methods: {
    ...mapMutations('AudioPlayer', ['ADD_TO_QUEUE', 'EMPTY_QUEUE', 'REMOVE_FROM_QUEUE', 'SET_QUEUE', 'SET_TRACK']),
    coverUrl (track) {
      const workId = Number(track && track.workId) || Number(String((track && track.hash) || '').split('/')[0])
      return this.$store.getters['AudioPlayer/coverUrl'](workId, 'sam')
    },
    toPlaylistItem (track) {
      const workId = Number(track.workId) || Number(String(track.hash || '').split('/')[0])
      const relativePath = track.relativePath || [track.subtitle, track.title].filter(Boolean).join('/')
      return { workId, relativePath: String(relativePath).replace(/\\/g, '/'), title: track.title, workTitle: track.workTitle || '' }
    },
    onCurrentQueueMoved (event) {
      if (!event.moved) return
      const moved = event.moved
      let index = this.queueIndex
      if (moved.oldIndex === this.queueIndex) index = moved.newIndex
      else if (moved.oldIndex < this.queueIndex && moved.newIndex >= this.queueIndex) index--
      else if (moved.oldIndex > this.queueIndex && moved.newIndex <= this.queueIndex) index++
      this.SET_QUEUE({ workId: this.playWorkId, queue: this.queueCopy.concat(), index, resetPlaying: false })
    },
    openSaveDialog () { this.newPlaylistName = ''; this.showSaveDialog = true },
    async saveCurrentQueue () {
      if (!this.newPlaylistName || this.queue.length === 0) return
      this.savingPlaylist = true
      try {
        await this.$axios.post('/api/playlists', { name: this.newPlaylistName, items: this.queue.map(this.toPlaylistItem) })
        this.showSaveDialog = false
        this.showSuccNotif(t('playlist.saved'))
        await this.loadPlaylists()
      } catch (error) { this.showErrNotif(this.errorMessage(error, t('playlist.saveFailed'))) } finally { this.savingPlaylist = false }
    },
    async loadPlaylists () {
      this.loadingPlaylists = true
      try { const response = await this.$axios.get('/api/playlists'); this.playlists = response.data.playlists || [] }
      catch (error) { this.showErrNotif(this.errorMessage(error, t('playlist.loadFailed'))) }
      finally { this.loadingPlaylists = false }
    },
    async openPlaylist (id) {
      try { const response = await this.$axios.get(`/api/playlists/${id}`); this.selectedPlaylist = response.data.playlist; this.playlistItems = response.data.items || [] }
      catch (error) { this.showErrNotif(this.errorMessage(error, t('playlist.loadFailed'))) }
    },
    closePlaylist () { this.selectedPlaylist = null; this.playlistItems = [] },
    playSelected () {
      if (this.availableItems.length === 0) return
      this.SET_QUEUE({ workId: this.availableItems[0].workId, queue: this.availableItems.map(item => ({ ...item })), index: 0, resetPlaying: true })
    },
    appendSelected () { this.availableItems.forEach(item => this.ADD_TO_QUEUE({ ...item })); this.showSuccNotif(t('playlist.appended', { count: this.availableItems.length })) },
    openRenameDialog () { this.renameValue = this.selectedPlaylist.name; this.showRenameDialog = true },
    async renameSelectedPlaylist () {
      if (!this.renameValue) return
      try { await this.$axios.patch(`/api/playlists/${this.selectedPlaylist.id}`, { name: this.renameValue }); this.selectedPlaylist.name = this.renameValue; this.showRenameDialog = false; await this.loadPlaylists() }
      catch (error) { this.showErrNotif(this.errorMessage(error, t('playlist.renameFailed'))) }
    },
    confirmDeletePlaylist () { this.$q.dialog({ title: t('playlist.delete'), message: t('playlist.deletePrompt', { name: this.selectedPlaylist.name }), cancel: t('common.cancel'), ok: { label: t('common.delete'), color: 'negative' } }).onOk(() => this.deleteSelectedPlaylist()) },
    async deleteSelectedPlaylist () {
      try { await this.$axios.delete(`/api/playlists/${this.selectedPlaylist.id}`); this.closePlaylist(); await this.loadPlaylists() }
      catch (error) { this.showErrNotif(this.errorMessage(error, t('playlist.deleteFailed'))) }
    },
    async removeSavedItem (track) {
      try { await this.$axios.delete(`/api/playlists/${this.selectedPlaylist.id}/items/${track.itemId}`); this.playlistItems = this.playlistItems.filter(item => item.itemId !== track.itemId); await this.loadPlaylists() }
      catch (error) { this.showErrNotif(this.errorMessage(error, t('playlist.removeFailed'))) }
    },
    async savePlaylistOrder () {
      try { await this.$axios.put(`/api/playlists/${this.selectedPlaylist.id}/items/order`, { itemIds: this.playlistItems.map(item => item.itemId) }) }
      catch (error) { this.showErrNotif(this.errorMessage(error, t('playlist.reorderFailed'))); await this.openPlaylist(this.selectedPlaylist.id) }
    },
    errorMessage (error, fallback) { return error.response && error.response.data && error.response.data.error ? error.response.data.error : fallback },
  },
}
</script>

<style lang="scss" scoped>
.playlist-page { max-width: 1080px; margin: 0 auto; }
.playlist-tabs { border-bottom: 1px solid rgba(127, 127, 127, .28); }
.playlist-cover { width: 42px; height: 42px; }
.playlist-empty { min-height: 180px; }
.playlist-dialog { width: 420px; max-width: 92vw; border-radius: 8px; }
.current-queue-handle, .saved-playlist-handle { cursor: grab; }
</style>
