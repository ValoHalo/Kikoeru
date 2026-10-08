<template>
  <q-dialog :model-value="true" :persistent="saving" @update:model-value="$emit('close')">
    <q-card class="bookmark-editor app-form-dialog">
      <q-form @submit.prevent="saveBookmark">
        <q-card-section>
          <div class="text-h6">{{ $t(bookmark.id ? 'bookmark.edit' : 'bookmark.add') }}</div>
          <div class="text-body2 text-grey q-mt-xs bookmark-file">{{ bookmark.relative_path }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none q-gutter-md">
          <q-input v-model="name" autofocus outlined :label="$t('bookmark.name')" :placeholder="defaultName" maxlength="120" />
          <q-input v-if="!bookmark.id" v-model.number="seconds" outlined type="number" :label="$t('bookmark.seconds')" min="0" max="2147483647" step="1" :rules="[validSeconds]" hide-bottom-space />
          <div v-else class="text-body2">{{ $t('bookmark.position', { time: defaultName }) }}</div>
          <q-input v-model="note" outlined type="textarea" :label="$t('bookmark.note')" maxlength="500" :rows="3" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('bookmark.cancel')" class="app-dialog-cancel" :disable="saving" v-close-popup />
          <q-btn flat color="primary" :label="$t('bookmark.save')" type="submit" :loading="saving" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script>
import { formatSeconds } from '../utils'
import NotifyMixin from '../mixins/Notification.js'

export default {
  name: 'BookmarkEditor',
  mixins: [NotifyMixin],
  props: { bookmark: { type: Object, required: true } },
  emits: ['saved', 'close'],
  data () {
    return {
      seconds: this.bookmark.seconds,
      name: this.bookmark.name || formatSeconds(this.bookmark.seconds),
      note: this.bookmark.note || '',
      saving: false,
    }
  },
  computed: {
    defaultName () { return formatSeconds(Number.isInteger(this.seconds) && this.seconds >= 0 ? this.seconds : 0) },
  },
  watch: {
    defaultName (value, previous) {
      if (!this.name.trim() || this.name === previous) this.name = value
    },
  },
  methods: {
    validSeconds (value) {
      return (Number.isInteger(value) && value >= 0 && value <= 2147483647) || this.$t('bookmark.invalidSeconds')
    },
    async saveBookmark () {
      if (this.saving || this.validSeconds(this.seconds) !== true) return
      this.saving = true
      const saved = { ...this.bookmark, seconds: this.seconds, name: this.name.trim() || this.defaultName, note: this.note.trim() }
      try {
        if (saved.id) {
          await this.$axios.patch(`/api/bookmarks/${saved.id}`, { name: saved.name, note: saved.note })
        } else {
          const { data } = await this.$axios.post('/api/bookmarks', {
            workId: saved.work_id, relativePath: saved.relative_path, seconds: saved.seconds, name: saved.name, note: saved.note,
          })
          saved.id = data.id
        }
        this.showSuccNotif(this.$t('bookmark.saved'))
        this.$emit('saved', saved)
        this.$emit('close')
      } catch (error) {
        this.showErrNotif(error.response
          ? error.response.data.error || `${error.response.status} ${error.response.statusText}`
          : error.message || String(error))
      } finally { this.saving = false }
    },
  },
}
</script>

<style scoped>
.bookmark-editor { width: 440px; max-width: 92vw; max-height: 85dvh; border-radius: 8px; }
.bookmark-file { overflow-wrap: anywhere; }
</style>
