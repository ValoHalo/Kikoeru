<template>
  <q-dialog :model-value="true" @update:model-value="$emit('close')">
    <q-card class="position-dialog">
      <q-card-section class="row items-center"><div class="text-h6">{{ $t('playbackProtection.positions') }}</div><q-space /><q-btn v-close-popup flat round dense icon="close" :aria-label="$t('common.close')" /></q-card-section>
      <q-linear-progress v-if="loading" indeterminate />
      <q-banner v-if="error" class="text-negative">{{ error }}</q-banner>
      <q-list separator class="position-list">
        <q-item v-for="position in positions" :key="position.id" clickable :disable="restoring" @click="restore(position)">
          <q-item-section><q-item-label lines="1">{{ position.title }}</q-item-label><q-item-label caption class="position-path">{{ position.relative_path }}</q-item-label><q-item-label caption>{{ dateLabel(position.created_at) }}</q-item-label></q-item-section>
          <q-item-section side>{{ formatSeconds(position.seconds) }}<q-icon name="restore" /></q-item-section>
        </q-item>
        <q-item v-if="!loading && !positions.length"><q-item-section>{{ $t('playbackProtection.empty') }}</q-item-section></q-item>
      </q-list>
    </q-card>
  </q-dialog>
</template>

<script>
import { formatSeconds } from '../utils'

export default {
  name: 'PlaybackPositions',
  emits: ['close'],
  data () { return { positions: [], loading: false, restoring: false, error: '' } },
  async mounted () {
    this.loading = true
    try { this.positions = (await this.$axios.get('/api/histroy/positions')).data.positions }
    catch (error) { this.error = error.response?.data?.error || this.$t('playbackProtection.failed') }
    finally { this.loading = false }
  },
  methods: {
    formatSeconds,
    dateLabel (value) { return new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`).toLocaleString(this.$i18n.locale) },
    async restore (position) {
      this.restoring = true
      this.error = ''
      try {
        const { data } = await this.$axios.get(`/api/tracks/${position.work_id}`)
        const tracks = []
        const walk = items => items.forEach(item => item.type === 'folder' ? walk(item.children || []) : tracks.push(item))
        walk(data)
        const track = tracks.find(item => item.relativePath === position.relative_path)
        if (!track) throw new Error(this.$t('bookmark.fileMissing'))
        track.nsfw = position.nsfw == null ? null : Boolean(position.nsfw)
        const sameTrack = this.$store.getters['AudioPlayer/currentPlayingFile'].hash === track.hash
        this.$store.commit('AudioPlayer/SET_WORK_RATINGS', [track])
        this.$store.commit('AudioPlayer/SET_QUEUE', { workId: position.work_id, queue: [track], index: 0, resetPlaying: false, resumeHistroySeconds: position.seconds, notifyHistoryRestore: false })
        this.$store.commit('AudioPlayer/PAUSE')
        if (sameTrack) {
          this.$store.commit('AudioPlayer/SET_NEW_CURRENT_TIME', position.seconds)
          this.$store.commit('AudioPlayer/RESUME_HISTROY_SECONDS_DONE')
        }
        this.$emit('close')
      } catch (error) { this.error = error.response?.data?.error || error.message || this.$t('playbackProtection.failed') }
      finally { this.restoring = false }
    }
  }
}
</script>

<style scoped>
.position-dialog { width: 600px; max-width: calc(100vw - 32px); }
.position-list { max-height: 65vh; overflow: auto; }
.position-path { overflow-wrap: anywhere; }
</style>
