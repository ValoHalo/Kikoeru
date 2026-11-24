<template>
  <q-card class="app-form-dialog edit-meta-card">
    <q-card-section class="kikoeru-dialog-header">
      <div class="kikoeru-dialog-title-group">
        <span class="kikoeru-dialog-icon">
          <q-icon name="edit" size="18px" />
        </span>
        <div class="kikoeru-dialog-title-text">
          <div class="kikoeru-dialog-title">{{ $t('editMeta.title') }}</div>
        </div>
      </div>
      <q-btn flat round dense icon="close" class="kikoeru-dialog-close" :disable="saving" :aria-label="$t('common.close')" v-close-popup />
    </q-card-section>

    <q-card-section class="kikoeru-dialog-body edit-meta-body scroll">
      <div class="edit-meta-section">
        <div class="kikoeru-dialog-field-label">{{ $t('editMeta.editTitle') }}</div>
        <q-input
          v-model="editTitle"
          outlined
          autogrow
          type="textarea"
          :rows="2"
          :disable="saving"
        />
      </div>

      <div class="edit-meta-section">
        <div class="kikoeru-dialog-field-label">
          <span>{{ $t('common.circles') }}</span>
          <q-btn
            flat
            dense
            no-caps
            size="sm"
            color="primary"
            icon="swap_horiz"
            :label="$t('editMeta.replaceCircle')"
            class="edit-meta-inline-btn"
            :disable="saving"
            @click="openCandidateDialog('circles')"
          />
        </div>
        <div class="edit-meta-chip-box">
          <q-chip size="md" icon="album" class="edit-meta-chip edit-meta-chip--accent">
            {{ editCircle.name }}
          </q-chip>
        </div>
      </div>

      <div class="edit-meta-section">
        <div class="kikoeru-dialog-field-label">
          <span>{{ $t('common.voiceActors') }} ({{ editVas.length }})</span>
          <q-btn
            flat
            dense
            no-caps
            size="sm"
            color="primary"
            icon="add"
            :label="$t('editMeta.addVoiceActor')"
            class="edit-meta-inline-btn"
            :disable="saving"
            @click="openCandidateDialog('vas')"
          />
        </div>
        <div class="edit-meta-chip-box">
          <q-chip
            v-for="(va, index) in editVas"
            :key="`${va.id}-${va.name}`"
            removable
            size="md"
            icon="mic"
            class="edit-meta-chip edit-meta-chip--accent"
            :disable="saving"
            @remove="removeVaAt(index)"
          >
            {{ va.name }}
          </q-chip>
        </div>
      </div>

      <div class="edit-meta-section">
        <div class="kikoeru-dialog-field-label">
          <span>{{ $t('common.tags') }} ({{ editTags.length }})</span>
          <q-btn
            flat
            dense
            no-caps
            size="sm"
            color="primary"
            icon="add"
            :label="$t('editMeta.addTag')"
            class="edit-meta-inline-btn"
            :disable="saving"
            @click="openCandidateDialog('tags')"
          />
        </div>
        <div class="edit-meta-chip-box">
          <q-chip
            v-for="(tag, index) in editTags"
            :key="`${tag.id}-${tag.name}`"
            removable
            size="md"
            class="edit-meta-chip"
            :disable="saving"
            @remove="removeTagAt(index)"
          >
            {{ tag.name }}
          </q-chip>
        </div>
      </div>
    </q-card-section>

    <q-card-actions class="kikoeru-dialog-footer">
      <q-btn class="app-dialog-cancel" flat no-caps :label="$t('common.cancel')" :disable="saving" v-close-popup />
      <q-btn unelevated no-caps :label="$t('common.save')" color="primary" :loading="saving" @click="confirmChange" />
    </q-card-actions>

    <q-dialog v-model="showCandidateDialog">
      <q-card class="app-form-dialog edit-meta-candidate-card">
        <q-card-section class="kikoeru-dialog-header">
          <div class="kikoeru-dialog-title-group">
            <span class="kikoeru-dialog-icon">
              <q-icon name="search" size="18px" />
            </span>
            <div class="kikoeru-dialog-title-text">
              <div class="kikoeru-dialog-title">{{ searchTitle }}</div>
            </div>
          </div>
          <q-btn flat round dense icon="close" class="kikoeru-dialog-close" :aria-label="$t('common.close')" v-close-popup />
        </q-card-section>

        <q-card-section class="kikoeru-dialog-body edit-meta-candidate-body">
          <q-input v-model="searchCandidate" outlined dense :placeholder="$t('common.search')" autofocus clearable>
            <template #prepend>
              <q-icon name="search" size="18px" />
            </template>
            <template #append>
              <q-btn
                v-if="canAddCustomCandidate"
                unelevated
                dense
                no-caps
                size="sm"
                color="primary"
                :label="$t('editMeta.addCustom')"
                @click="chooseCandidate({ id: 0, name: normalizedSearchCandidate })"
              />
            </template>
          </q-input>

          <q-scroll-area class="edit-meta-candidate-scroll">
            <q-list dense separator class="edit-meta-candidate-list">
              <q-item
                v-for="candidate in filteredCandidates"
                :key="`${candidate.id}-${candidate.name}`"
                clickable
                v-ripple
                class="edit-meta-candidate-item"
                @click="chooseCandidate(candidate)"
              >
                <q-item-section>{{ candidate.name }}</q-item-section>
                <q-item-section side>
                  <span class="edit-meta-candidate-count">{{ candidate.count }}</span>
                </q-item-section>
              </q-item>
            </q-list>
          </q-scroll-area>
        </q-card-section>

        <q-card-actions class="kikoeru-dialog-footer">
          <q-btn class="app-dialog-cancel" flat no-caps :label="$t('common.cancel')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script>
import { t } from '../i18n'
import NotifyMixin from '../mixins/Notification.js'
import { ServerApi } from 'src/utils'

const DEFAULT_VA = { id: 0, name: 'N/A' }

function cloneList (list) {
  return (list || []).filter(item => item.name != null).map(item => ({ id: item.id, name: item.name }))
}

export default {
  name: 'EditMeta',

  mixins: [NotifyMixin],

  props: {
    workid: {
      type: Number,
      required: true
    },
    metadata: {
      type: Object,
      required: true
    }
  },

  data () {
    return {
      saving: false,
      showCandidateDialog: false,
      editTitle: '',
      editTags: [],
      editVas: [],
      editCircle: { id: 0, name: '' },
      candidates: {
        tags: [],
        vas: [],
        circles: []
      },
      showCandidateType: 'tags',
      searchCandidate: ''
    }
  },

  computed: {
    searchTitle () {
      return this.showCandidateType === 'circles' ? t('editMeta.replaceCircle') : t('editMeta.addCandidate', { value: this.candidateLabel(this.showCandidateType) })
    },
    normalizedSearchCandidate () {
      return (this.searchCandidate || '').trim()
    },

    filteredCandidates () {
      const keyword = this.normalizedSearchCandidate.toLocaleLowerCase()
      const candidates = this.candidates[this.showCandidateType] || []
      if (!keyword) return candidates
      return candidates.filter(candidate => candidate.name.toLocaleLowerCase().includes(keyword))
    },

    canAddCustomCandidate () {
      return this.normalizedSearchCandidate.length > 0 && this.filteredCandidates.length === 0
    }
  },

  created () {
    this.resetForm()
    this.loadCandidates()
  },

  methods: {
    resetForm () {
      this.editTitle = this.metadata.title || ''
      this.editTags = cloneList(this.metadata.tags)
      this.editVas = cloneList(this.metadata.vas)
      if (this.editVas.length === 0) this.editVas = [{ ...DEFAULT_VA }]
      this.editCircle = this.metadata.circle
        ? { id: this.metadata.circle.id, name: this.metadata.circle.name }
        : { id: 0, name: '' }
    },

    async loadCandidates () {
      const types = ['circle', 'va', 'tag']
      const results = await Promise.all(types.map(type => ServerApi.getCandidates(type)
        .then(value => ({ value }))
        .catch(error => ({ error }))))
      results.forEach((result, index) => {
        const key = `${types[index]}s`
        if (!result.error) {
          this.candidates[key] = result.value
        } else {
          this.showErrNotif(t('editMeta.loadCandidatesFailed', { value: this.candidateLabel(key) }))
        }
      })
    },

    candidateLabel (type) {
      return {
        circles: t('common.circles'),
        tags: t('common.tags'),
        vas: t('common.voiceActors')
      }[type] || t('common.metadata')
    },

    openCandidateDialog (type) {
      this.showCandidateType = type
      this.searchCandidate = ''
      this.showCandidateDialog = true
    },

    removeVaAt (index) {
      if (this.editVas.length <= 1) {
        this.showErrNotif(t('editMeta.voiceActorRequired'))
        return
      }
      this.editVas.splice(index, 1)
    },

    removeTagAt (index) {
      this.editTags.splice(index, 1)
    },

    chooseCandidate (candidate) {
      const item = { id: candidate.id, name: candidate.name }
      if (this.showCandidateType === 'circles') {
        this.editCircle = item
      } else {
        const target = this.showCandidateType === 'vas' ? this.editVas : this.editTags
        if (target.some(existing => existing.name === item.name)) {
          this.showErrNotif(t('editMeta.alreadyExists'))
          return
        }
        target.push(item)
      }
      this.showCandidateDialog = false
    },

    async confirmChange () {
      const title = this.editTitle.trim()
      if (!title) {
        this.showErrNotif(t('editMeta.titleRequired'))
        return
      }
      if (!this.editCircle.name) {
        this.showErrNotif(t('editMeta.circleRequired'))
        return
      }

      this.saving = true
      try {
        const result = await ServerApi.saveEditMeta(this.workid, {
          title,
          tags: cloneList(this.editTags),
          vas: cloneList(this.editVas),
          circle: { ...this.editCircle }
        })
        if (!result.success) throw new Error(result.message || t('editMeta.saveUnconfirmed'))
        this.showSuccNotif(t('editMeta.saved'))
        this.$emit('saved')
      } catch (error) {
        const message = error.response && error.response.data
          ? error.response.data.error || error.response.data.message
          : error.message
        this.showErrNotif(t('editMeta.saveFailed', { value: message || error }))
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.edit-meta-card {
  width: min(640px, calc(100vw - 28px));
  max-height: 86dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.edit-meta-body {
  min-height: 0;
  gap: 16px !important;
}

.edit-meta-section {
  min-width: 0;
}

.edit-meta-inline-btn {
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(var(--kikoeru-accent-rgb), 0.1);
  font-size: 12px;
  font-weight: 500;
}

.edit-meta-inline-btn:hover {
  background: rgba(var(--kikoeru-accent-rgb), 0.18);
}

.edit-meta-chip-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 8px 10px;
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
}

.edit-meta-chip {
  margin: 0;
  background: var(--kikoeru-surface);
  color: var(--kikoeru-text);
  border: 1px solid var(--kikoeru-border);
  border-radius: 6px;
  font-size: 13px;
}

.edit-meta-chip--accent {
  background: rgba(var(--kikoeru-accent-rgb), 0.12);
  color: var(--kikoeru-accent-text);
  border-color: rgba(var(--kikoeru-accent-rgb), 0.24);
}

.edit-meta-candidate-card {
  width: min(520px, calc(100vw - 28px));
  max-height: 82dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.edit-meta-candidate-body {
  min-height: 0;
  gap: 12px !important;
}

.edit-meta-candidate-scroll {
  height: 38vh;
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
}

.edit-meta-candidate-item {
  min-height: 42px;
}

.edit-meta-candidate-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--kikoeru-surface);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-muted);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}
</style>
