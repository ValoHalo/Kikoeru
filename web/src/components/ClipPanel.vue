<template>
  <div class="clip-panel scroll">
    <q-form class="q-pa-md" @submit="saveClip">
      <div class="row items-center q-mb-sm">
        <div class="text-subtitle2">{{ $t(draft.id ? 'clips.edit' : 'clips.new') }}</div>
        <q-space />
        <q-btn flat round dense icon="add" :aria-label="$t('clips.new')" :disable="saving" @click="resetDraft">
          <AppTooltip>{{ $t('clips.new') }}</AppTooltip>
        </q-btn>
      </div>
      <div class="clip-time-fields">
        <q-input :model-value="draft.startText" outlined dense :label="$t('clips.start')" placeholder="00:00" :disable="saving"
          :error="Boolean(startError)" :error-message="startError" @update:model-value="updateDraft({ startText: $event })">
          <template #append><q-btn flat round dense icon="my_location" :aria-label="$t('clips.captureStart')" :disable="!playbackReady || saving" @click="capturePosition('startText')"><AppTooltip>{{ $t('clips.captureStart') }}</AppTooltip></q-btn></template>
        </q-input>
        <q-input :model-value="draft.endText" outlined dense :label="$t('clips.end')" placeholder="00:00" :disable="saving"
          :error="Boolean(endError)" :error-message="endError" @update:model-value="updateDraft({ endText: $event })">
          <template #append><q-btn flat round dense icon="my_location" :aria-label="$t('clips.captureEnd')" :disable="!playbackReady || saving" @click="capturePosition('endText')"><AppTooltip>{{ $t('clips.captureEnd') }}</AppTooltip></q-btn></template>
        </q-input>
      </div>
      <div class="row items-center q-gutter-sm q-mb-md">
        <q-toggle :model-value="draft.loop" :label="$t('clips.loop')" @update:model-value="setLoop" />
        <q-space />
        <q-btn v-if="previewActive" flat round icon="stop" :aria-label="$t('clips.stopPreview')" @click="stopPreview"><AppTooltip>{{ $t('clips.stopPreview') }}</AppTooltip></q-btn>
        <q-btn outline color="primary" icon="play_arrow" :label="$t('clips.preview')" :disable="!rangeValid || !playbackReady || saving" @click="preview" />
      </div>
      <q-input :model-value="draft.name" outlined dense :label="$t('bookmark.name')" maxlength="120" :disable="saving" class="q-mb-sm" @update:model-value="updateDraft({ name: $event })" />
      <q-input :model-value="draft.note" outlined dense autogrow :label="$t('bookmark.note')" maxlength="500" :disable="saving" class="q-mb-md" @update:model-value="updateDraft({ note: $event })" />
      <div class="row justify-end">
        <q-btn type="submit" color="primary" icon="save" :label="$t('clips.save')" :disable="!rangeValid || !draft.name.trim()" :loading="saving" />
      </div>
    </q-form>
    <q-separator />
    <div class="row items-center q-px-md q-py-sm">
      <div class="text-subtitle2">{{ $t('clips.savedClips') }}</div>
      <q-space />
      <q-btn flat round dense icon="refresh" :aria-label="$t('clips.refresh')" :loading="loading" @click="loadClips"><AppTooltip>{{ $t('clips.refresh') }}</AppTooltip></q-btn>
    </div>
    <div v-if="loading" class="q-pa-md text-center"><q-spinner color="primary" size="28px" :aria-label="$t('clips.loading')" /></div>
    <div v-else-if="loadFailed" class="q-pa-md text-center text-grey">{{ $t('clips.loadFailed') }}</div>
    <div v-else-if="!clips.length" class="q-pa-md text-center text-grey">{{ $t('clips.empty') }}</div>
    <q-list v-else>
      <q-item v-for="clip in clips" :key="clip.id">
        <q-item-section avatar><q-btn flat round icon="play_arrow" :aria-label="$t('clips.play', { name: $privateText(clip.name) })" :disable="!playbackReady || saving" @click="playClip(clip)"><AppTooltip>{{ $t('clips.preview') }}</AppTooltip></q-btn></q-item-section>
        <q-item-section>
          <q-item-label class="clip-text">{{ $privateText(clip.name) }}</q-item-label>
          <q-item-label caption>{{ formatClipTime(clip.start_seconds) }} - {{ formatClipTime(clip.end_seconds) }}</q-item-label>
          <q-item-label v-if="clip.note" caption class="clip-text">{{ $privateText(clip.note) }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat round dense icon="more_vert" :aria-label="$t('clips.actions')" :disable="saving">
            <AppTooltip>{{ $t('clips.actions') }}</AppTooltip>
            <q-menu><q-list dense>
              <q-item clickable v-close-popup @click="editClip(clip)"><q-item-section avatar><q-icon name="edit" /></q-item-section><q-item-section>{{ $t('clips.edit') }}</q-item-section></q-item>
              <q-item clickable v-close-popup @click="deleteClip(clip)"><q-item-section avatar><q-icon name="delete" /></q-item-section><q-item-section>{{ $t('bookmark.delete') }}</q-item-section></q-item>
            </q-list></q-menu>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import NotifyMixin from '../mixins/Notification.js'
import { formatClipTime, parseClipTime, validClipRange } from '../utils/clipPlayback.mjs'

export default {
  name: 'ClipPanel',
  mixins: [NotifyMixin],
  props: { workId: { type: Number, required: true }, track: { type: Object, required: true } },
  data () {
    return { draft: { startText: '', endText: '', name: '', note: '', loop: false }, clips: [], loading: false, loadFailed: false, saving: false, listRequest: 0 }
  },
  computed: {
    ...mapState('AudioPlayer', ['currentTime', 'duration', 'playbackReadyHash', 'clipRange']),
    ...mapGetters('AudioPlayer', ['currentPlayingFile', 'sfwOnly']),
    relativePath () { return String(this.track.relativePath || [this.track.subtitle, this.track.title].filter(Boolean).join('/')).replace(/\\/g, '/') },
    scopeKey () { return JSON.stringify([this.$store.state.User.name, this.workId, this.relativePath, this.sfwOnly]) },
    playbackReady () { return this.track.hash === this.currentPlayingFile.hash && this.playbackReadyHash === this.track.hash && this.duration > 0 },
    trackDuration () {
      const duration = this.playbackReady ? this.duration : Number(this.track.duration) > 0 ? Number(this.track.duration) : Infinity
      return Math.round(duration * 1000) / 1000
    },
    start () { return parseClipTime(this.draft.startText) },
    end () { return parseClipTime(this.draft.endText) },
    rangeValid () { return validClipRange(this.start, this.end, this.trackDuration) },
    startError () {
      if (!this.draft.startText) return ''
      if (!Number.isFinite(this.start)) return this.$t('clips.invalidTime')
      return this.start >= this.trackDuration ? this.$t('clips.rangeInvalid') : ''
    },
    endError () {
      if (!this.draft.endText) return ''
      if (!Number.isFinite(this.end)) return this.$t('clips.invalidTime')
      return this.end > this.trackDuration || (Number.isFinite(this.start) && this.end <= this.start) ? this.$t('clips.rangeInvalid') : ''
    },
    previewActive () { return this.clipRange?.hash === this.track.hash },
  },
  watch: {
    scopeKey: { immediate: true, handler () {
      const previous = this.$store.state.AudioPlayer.clipDraft
      this.draft = previous?.scope === this.scopeKey ? { ...previous } : this.emptyDraft()
      this.storeDraft()
      this.clips = []
      this.loadClips()
    } },
  },
  beforeUnmount () { this.listRequest++ },
  methods: {
    formatClipTime,
    emptyDraft () { return { id: null, startText: '', endText: '', name: '', note: '', loop: false } },
    storeDraft () { this.$store.commit('AudioPlayer/SET_CLIP_DRAFT', { ...this.draft, scope: this.scopeKey, hash: this.track.hash }) },
    updateDraft (changes) {
      this.draft = { ...this.draft, ...changes }
      this.storeDraft()
      if ('startText' in changes || 'endText' in changes) this.$store.commit('AudioPlayer/SET_CLIP_RANGE', null)
    },
    resetDraft () { this.updateDraft(this.emptyDraft()) },
    capturePosition (field) { if (this.playbackReady) this.updateDraft({ [field]: formatClipTime(this.currentTime) }) },
    setLoop (loop) {
      this.updateDraft({ loop })
      if (this.previewActive) this.$store.commit('AudioPlayer/SET_CLIP_RANGE', { ...this.clipRange, loop })
    },
    preview () {
      if (!this.rangeValid || !this.playbackReady) return
      this.$store.commit('AudioPlayer/SET_CLIP_RANGE', { hash: this.track.hash, start: this.start, end: this.end, loop: this.draft.loop })
      this.$store.commit('AudioPlayer/SET_NEW_CURRENT_TIME', this.start)
      this.$store.commit('AudioPlayer/PLAY')
    },
    stopPreview () {
      this.$store.commit('AudioPlayer/PAUSE')
      this.$store.commit('AudioPlayer/SET_CLIP_RANGE', null)
    },
    editClip (clip) {
      this.updateDraft({ id: clip.id, startText: formatClipTime(clip.start_seconds), endText: formatClipTime(clip.end_seconds), name: clip.name, note: clip.note, loop: this.draft.loop })
      this.$el.scrollTop = 0
    },
    playClip (clip) { this.editClip(clip); this.preview() },
    reportError (error) { this.showErrNotif(error.response?.data?.error || error.message || String(error)) },
    async loadClips () {
      const request = ++this.listRequest
      this.loading = true
      this.loadFailed = false
      try {
        const { data } = await this.$axios.get('/api/clips', { params: { workId: this.workId, relativePath: this.relativePath, nsfw: this.sfwOnly ? 1 : 0 } })
        if (request === this.listRequest) this.clips = data.clips
      } catch (error) {
        if (request === this.listRequest) { this.loadFailed = true; this.reportError(error) }
      } finally { if (request === this.listRequest) this.loading = false }
    },
    async saveClip () {
      if (this.saving || !this.rangeValid || !this.draft.name.trim()) return
      const scope = this.scopeKey
      const id = this.draft.id
      const value = { workId: this.workId, relativePath: this.relativePath, startSeconds: this.start, endSeconds: this.end, name: this.draft.name.trim(), note: this.draft.note }
      this.saving = true
      try {
        const options = { params: { nsfw: this.sfwOnly ? 1 : 0 } }
        const { data } = id ? await this.$axios.patch(`/api/clips/${id}`, value, options) : await this.$axios.post('/api/clips', value, options)
        if (scope !== this.scopeKey) return
        this.updateDraft({ id: id || data.id, name: value.name })
        this.showSuccNotif(this.$t('clips.saved'))
        await this.loadClips()
      } catch (error) { this.reportError(error) }
      finally { this.saving = false }
    },
    async deleteClip (clip) {
      const scope = this.scopeKey
      try {
        await this.$axios.delete(`/api/clips/${clip.id}`)
        if (scope !== this.scopeKey) return
        this.clips = this.clips.filter(item => item.id !== clip.id)
        if (this.draft.id === clip.id) this.updateDraft({ id: null })
        this.showSuccNotif(this.$t('clips.deleted'))
      } catch (error) { this.reportError(error) }
    },
  },
}
</script>

<style scoped>
.clip-panel { min-height: 0; }
.clip-time-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.clip-text { overflow-wrap: anywhere; white-space: pre-wrap; }
@media (max-width: 380px) { .clip-time-fields { grid-template-columns: minmax(0, 1fr); gap: 0; } }
</style>
