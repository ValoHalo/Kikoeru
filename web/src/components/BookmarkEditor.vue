<template>
  <q-dialog :model-value="true" :persistent="saving" @update:model-value="$emit('close')">
    <q-card class="bookmark-editor app-form-dialog">
      <q-form v-if="!$store.state.AudioPlayer.privacyMode" @submit.prevent="saveBookmark">
        <q-card-section class="kikoeru-dialog-header">
          <div class="kikoeru-dialog-title-group">
            <span class="kikoeru-dialog-icon">
              <q-icon :name="bookmark.id ? 'edit' : 'bookmark_add'" size="18px" />
            </span>
            <div class="kikoeru-dialog-title-text">
              <div class="kikoeru-dialog-title">{{ $t(bookmark.id ? 'bookmark.edit' : 'bookmark.add') }}</div>
              <div class="kikoeru-dialog-subtitle bookmark-file">{{ bookmark.relative_path }}</div>
            </div>
          </div>
          <q-btn flat round dense icon="close" class="kikoeru-dialog-close" :disable="saving" :aria-label="$t('common.close')" v-close-popup />
        </q-card-section>

        <q-card-section class="kikoeru-dialog-body">
          <div>
            <div class="kikoeru-dialog-field-label">{{ $t('bookmark.name') }}</div>
            <q-input v-model="name" autofocus outlined dense :placeholder="defaultName" maxlength="120" />
          </div>

          <div v-if="!bookmark.id">
            <div class="kikoeru-dialog-field-label">{{ $t('bookmark.seconds') }}</div>
            <q-input
              v-model.number="seconds"
              outlined
              dense
              type="number"
              min="0"
              max="2147483647"
              step="1"
              :rules="[validSeconds]"
              hide-bottom-space
            />
          </div>
          <div v-else class="bookmark-position-row">
            <q-icon name="schedule" size="16px" />
            <span>{{ $t('bookmark.position', { time: defaultName }) }}</span>
          </div>

          <div>
            <div class="kikoeru-dialog-field-label">{{ $t('bookmark.note') }}</div>
            <q-input v-model="note" outlined type="textarea" maxlength="500" :rows="3" />
          </div>
        </q-card-section>

        <q-card-actions class="kikoeru-dialog-footer">
          <q-btn flat no-caps :label="$t('bookmark.cancel')" class="app-dialog-cancel" :disable="saving" v-close-popup />
          <q-btn unelevated no-caps color="primary" :label="$t('bookmark.save')" type="submit" :loading="saving" />
        </q-card-actions>
      </q-form>
      <q-card-section v-else class="kikoeru-dialog-header">
        <span>{{ $t('privacy.hidden') }}</span>
        <q-btn v-close-popup flat round dense icon="close" :aria-label="$t('common.close')" />
      </q-card-section>
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
.bookmark-editor {
  width: min(450px, calc(100vw - 28px));
  max-height: 85dvh;
  overflow: hidden;
}

.bookmark-file {
  overflow-wrap: anywhere;
}

.bookmark-position-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
</style>
