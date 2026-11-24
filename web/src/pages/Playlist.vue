<template>
  <q-page class="playlist-page">
    <header class="playlist-heading">
      <q-icon name="queue_music" size="28px" />
      <h1>{{ $t('common.playlists') }}</h1>
      <q-space />
      <q-btn v-if="activeTab === 'current'" flat round icon="save" :disable="queue.length === 0" :aria-label="$t('playlist.saveQueue')" @click="openSaveDialog"><AppTooltip>{{ $t('playlist.saveQueue') }}</AppTooltip></q-btn>
      <q-btn v-if="activeTab === 'current'" flat round class="kikoeru-danger-text" icon="delete_sweep" :disable="queue.length === 0" :aria-label="$t('playlist.clearQueue')" @click="EMPTY_QUEUE"><AppTooltip>{{ $t('playlist.clearQueue') }}</AppTooltip></q-btn>
    </header>

    <q-tabs v-model="activeTab" inline-label no-caps dense align="left" active-color="primary" indicator-color="transparent" class="playlist-tabs q-mb-lg">
      <q-tab name="current" icon="queue_music" :label="$t('playlist.currentQueue')" />
      <q-tab name="saved" icon="library_music" :label="$t('playlist.savedPlaylists')" />
    </q-tabs>

    <q-tab-panels v-model="activeTab" animated class="bg-transparent">
      <q-tab-panel name="current" class="q-pa-none">
        <q-list v-if="queueCopy.length" bordered separator class="playlist-surface-list">
          <draggable v-model="queueCopy" item-key="hash" handle=".current-queue-handle" @change="onCurrentQueueMoved">
            <template #item="{ element: track, index }">
              <q-item clickable v-ripple :active="queueIndex === index" active-class="kikoeru-active-item" class="playlist-track-item" @click="SET_TRACK(index)">
                <q-item-section avatar><q-img :key="coverUrl(track)" :src="coverUrl(track)" ratio="1" class="playlist-cover rounded-borders" /></q-item-section>
                <q-item-section><q-item-label lines="1" :class="{ 'text-weight-medium': queueIndex === index }">{{ $privateText(track.title) }}</q-item-label><q-item-label caption lines="1" class="playlist-track-subtitle">{{ $privateText(track.workTitle) }}</q-item-label></q-item-section>
                <q-item-section side class="current-queue-handle"><q-icon name="drag_handle" /></q-item-section>
                <q-item-section side><q-btn flat round dense icon="close" class="kikoeru-danger-text" :aria-label="$t('playlist.removeFromQueue')" @click.stop="REMOVE_FROM_QUEUE(index)" /></q-item-section>
              </q-item>
            </template>
          </draggable>
        </q-list>
        <div v-else class="playlist-empty"><div class="playlist-empty__icon"><q-icon name="queue_music" size="34px" /></div><div>{{ $t('playlist.emptyQueue') }}</div></div>
      </q-tab-panel>

      <q-tab-panel name="saved" class="q-pa-none">
        <div class="playlist-saved-layout">
          <div v-if="!selectedPlaylist || $q.screen.gt.sm" class="playlist-panel">
            <div class="playlist-panel__heading"><div class="text-subtitle1 text-weight-medium">{{ $t('playlist.savedPlaylists') }}</div><q-space /><q-btn flat round dense icon="refresh" :loading="loadingPlaylists" :aria-label="$t('playlist.refresh')" @click="loadPlaylists"><AppTooltip>{{ $t('common.refresh') }}</AppTooltip></q-btn></div>
            <q-list v-if="playlists.length" class="playlist-sidebar-list">
              <q-item v-for="playlist in playlists" :key="playlist.id" clickable v-ripple :active="selectedPlaylist && selectedPlaylist.id === playlist.id" active-class="kikoeru-active-item" @click="openPlaylist(playlist.id)">
                <q-item-section avatar><q-icon name="library_music" /></q-item-section>
                <q-item-section><q-item-label lines="1">{{ playlist.name }}</q-item-label><q-item-label caption class="playlist-track-subtitle">{{ $t('playlist.trackCount', { count: playlist.item_count }) }}</q-item-label></q-item-section>
                <q-item-section side><q-icon name="chevron_right" /></q-item-section>
              </q-item>
            </q-list>
            <div v-else-if="!loadingPlaylists" class="playlist-empty playlist-empty--embedded"><div class="playlist-empty__icon"><q-icon name="library_music" size="34px" /></div><div>{{ $t('playlist.noPlaylists') }}</div></div>
          </div>

          <div v-if="selectedPlaylist" class="playlist-panel">
            <div class="playlist-panel__heading no-wrap">
              <q-btn v-if="$q.screen.lt.md" flat round dense icon="arrow_back" :aria-label="$t('playlist.back')" @click="closePlaylist" />
              <div class="col text-subtitle1 text-weight-medium ellipsis q-ml-sm">{{ selectedPlaylist.name }}</div>
              <q-space />
              <q-btn flat round dense icon="play_arrow" :disable="availableItems.length === 0" :aria-label="$t('playlist.playList')" @click="playSelected"><AppTooltip>{{ $t('playlist.play') }}</AppTooltip></q-btn>
              <q-btn flat round dense icon="playlist_add" :disable="availableItems.length === 0" :aria-label="$t('playlist.append')" @click="appendSelected"><AppTooltip>{{ $t('playlist.append') }}</AppTooltip></q-btn>
              <q-btn flat round dense icon="more_vert" :aria-label="$t('playlist.moreActions')"><q-menu><q-list dense style="min-width: 150px"><q-item clickable v-close-popup @click="openRenameDialog"><q-item-section avatar><q-icon name="edit" /></q-item-section><q-item-section>{{ $t('common.rename') }}</q-item-section></q-item><q-item clickable v-close-popup class="kikoeru-danger-text" @click="confirmDeletePlaylist"><q-item-section avatar><q-icon name="delete" /></q-item-section><q-item-section>{{ $t('common.delete') }}</q-item-section></q-item></q-list></q-menu></q-btn>
            </div>
            <q-list v-if="playlistItems.length" separator class="playlist-items-list">
              <draggable v-model="playlistItems" item-key="itemId" handle=".saved-playlist-handle" @change="savePlaylistOrder">
                <template #item="{ element: track }">
                  <q-item :class="{ 'playlist-item--unavailable': !track.available }">
                    <q-item-section avatar><q-img v-if="track.available" :key="coverUrl(track)" :src="coverUrl(track)" ratio="1" class="playlist-cover rounded-borders" /><q-icon v-else name="link_off" size="28px" /></q-item-section>
                    <q-item-section><q-item-label lines="1">{{ $privateText(track.title) }}</q-item-label><q-item-label caption lines="1" class="playlist-track-subtitle">{{ $privateText(track.workTitle) }}{{ track.available ? '' : $t('playlist.unavailable') }}</q-item-label></q-item-section>
                    <q-item-section side class="saved-playlist-handle"><q-icon name="drag_handle" /></q-item-section>
                    <q-item-section side><q-btn flat round dense icon="close" class="kikoeru-danger-text" :aria-label="$t('playlist.removeTrack')" @click="removeSavedItem(track)" /></q-item-section>
                  </q-item>
                </template>
              </draggable>
            </q-list>
            <div v-else class="playlist-empty playlist-empty--embedded">{{ $t('playlist.empty') }}</div>
          </div>
          <div v-else-if="$q.screen.gt.sm" class="playlist-panel playlist-empty"><div class="playlist-empty__icon"><q-icon name="queue_music" size="34px" /></div><div>{{ $t('playlist.select') }}</div></div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <q-dialog v-model="showSaveDialog"><q-card class="playlist-dialog app-form-dialog"><q-form @submit.prevent="saveCurrentQueue"><q-card-section><div class="text-h6">{{ $t('playlist.saveQueue') }}</div></q-card-section><q-card-section class="q-pt-none"><q-input v-model.trim="newPlaylistName" autofocus outlined :label="$t('playlist.name')" maxlength="80" :rules="[value => Boolean(value) || $t('common.nameRequired')]" /></q-card-section><q-card-actions align="right"><q-btn class="app-dialog-cancel" flat :label="$t('common.cancel')" v-close-popup /><q-btn unelevated color="primary" :label="$t('common.save')" type="submit" :loading="savingPlaylist" /></q-card-actions></q-form></q-card></q-dialog>
    <q-dialog v-model="showRenameDialog"><q-card class="playlist-dialog app-form-dialog"><q-form @submit.prevent="renameSelectedPlaylist"><q-card-section><div class="text-h6">{{ $t('playlist.rename') }}</div></q-card-section><q-card-section class="q-pt-none"><q-input v-model.trim="renameValue" autofocus outlined :label="$t('playlist.name')" maxlength="80" :rules="[value => Boolean(value) || $t('common.nameRequired')]" /></q-card-section><q-card-actions align="right"><q-btn class="app-dialog-cancel" flat :label="$t('common.cancel')" v-close-popup /><q-btn unelevated color="primary" :label="$t('common.save')" type="submit" /></q-card-actions></q-form></q-card></q-dialog>
  </q-page>
</template>

<script>
import { appDialog } from '../utils/appDialog'
import { t } from '../i18n'
import draggable from 'vuedraggable'
import { mapMutations, mapState } from 'vuex'
import { getTrackWorkId, toPlaylistItem } from '../utils'
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
      return this.$store.getters['AudioPlayer/coverUrl'](getTrackWorkId(track), 'sam')
    },
    toPlaylistItem (track) {
      return toPlaylistItem(track)
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
    confirmDeletePlaylist () { appDialog(this.$q, { title: t('playlist.delete'), message: t('playlist.deletePrompt', { name: this.selectedPlaylist.name }), cancel: t('common.cancel'), ok: { label: t('common.delete'), color: 'negative' } }).onOk(() => this.deleteSelectedPlaylist()) },
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
.playlist-page {
  max-width: 1160px;
  margin: 0 auto;
  padding: 28px 24px 120px;
}

.playlist-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.playlist-heading > .q-icon {
  color: var(--kikoeru-accent-text);
}

.playlist-heading h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 500;
  line-height: 36px;
  letter-spacing: 0;
}

.playlist-tabs {
  padding: 6px;
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  background: var(--kikoeru-surface);
}

.playlist-tabs :deep(.q-tabs__content) { gap: 4px; }
.playlist-tabs :deep(.q-tab) { flex: 1; min-height: 44px; padding: 8px 12px; border-radius: var(--kikoeru-radius-sm); color: var(--kikoeru-muted); }
.playlist-tabs :deep(.q-tab--active) { color: var(--kikoeru-accent-text) !important; background: var(--kikoeru-active-bg); }

.playlist-surface-list,
.playlist-panel {
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  background: var(--kikoeru-surface);
  overflow: hidden;
}

.playlist-saved-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.playlist-panel__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 58px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--kikoeru-border);
}

.playlist-sidebar-list { padding: 8px; }
.playlist-sidebar-list .q-item { min-height: 64px; border-radius: var(--kikoeru-radius-sm); margin-bottom: 4px; }
.playlist-sidebar-list .q-item__section--avatar { min-width: 38px; color: var(--kikoeru-muted); }
.playlist-sidebar-list .kikoeru-active-item .q-item__section--avatar { color: inherit; }

.playlist-track-item { min-height: 64px; padding: 8px 16px; }
.playlist-items-list .q-item { min-height: 64px; padding: 8px 16px; }
.playlist-cover { width: 44px; height: 44px; background: var(--kikoeru-inset); border: 1px solid var(--kikoeru-border); }
.playlist-track-subtitle { color: var(--kikoeru-muted); }
.kikoeru-active-item .playlist-track-subtitle { color: inherit; opacity: 0.85; }
.playlist-item--unavailable { opacity: 0.6; }

.playlist-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 260px;
  padding: 28px 20px;
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  background: var(--kikoeru-surface);
  color: var(--kikoeru-muted);
}

.playlist-empty--embedded {
  border: 0;
  border-radius: 0;
}

.playlist-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--kikoeru-inset);
}

.playlist-dialog { width: 420px; max-width: 92vw; border-radius: var(--kikoeru-radius-md); }
.current-queue-handle, .saved-playlist-handle { cursor: grab; color: var(--kikoeru-muted); }

@media (max-width: 1023px) {
  .playlist-saved-layout { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 699px) {
  .playlist-page { padding: 20px 12px 120px; }
  .playlist-heading h1 { font-size: 22px; }
}
</style>
