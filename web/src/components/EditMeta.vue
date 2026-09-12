<template>
  <q-card style="width: 70vw; max-width: 760px; min-width: 320px">
    <q-card-section class="q-pb-sm">
      <div class="text-h6">{{ $t('editMeta.title') }}</div>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <q-input
        v-model="editTitle"
        filled
        :label="$t('editMeta.editTitle')"
        :disable="saving"
      />
    </q-card-section>

    <q-card-section class="q-pt-none">
      <div class="text-caption text-grey q-mb-xs">{{ $t('common.circles') }}</div>
      <q-chip size="md" color="primary" text-color="white" class="shadow-4">
        {{ editCircle.name }}
      </q-chip>
      <q-btn
        round
        color="deep-orange"
        icon="swap_horiz"
        size="sm"
        class="q-ml-sm"
        :aria-label="$t('editMeta.replaceCircle')"
        :disable="saving"
        @click="openCandidateDialog('circles')"
      />
    </q-card-section>

    <q-card-section class="q-pt-none">
      <div class="text-caption text-grey q-mb-xs">{{ $t('common.tags') }}</div>
      <q-chip
        v-for="(tag, index) in editTags"
        :key="`${tag.id}-${tag.name}`"
        removable
        size="md"
        color="secondary"
        text-color="white"
        class="shadow-4"
        :disable="saving"
        @remove="removeTagAt(index)"
      >
        {{ tag.name }}
      </q-chip>
      <q-btn
        round
        color="deep-orange"
        icon="add"
        size="sm"
        class="q-ml-sm"
        :aria-label="$t('editMeta.addTag')"
        :disable="saving"
        @click="openCandidateDialog('tags')"
      />
    </q-card-section>

    <q-card-section class="q-pt-none">
      <div class="text-caption text-grey q-mb-xs">{{ $t('common.voiceActors') }}</div>
      <q-chip
        v-for="(va, index) in editVas"
        :key="`${va.id}-${va.name}`"
        removable
        square
        size="md"
        color="primary"
        text-color="white"
        icon="mic"
        class="shadow-4"
        :disable="saving"
        @remove="removeVaAt(index)"
      >
        {{ va.name }}
      </q-chip>
      <q-btn
        round
        color="deep-orange"
        icon="add"
        size="sm"
        class="q-ml-sm"
        :aria-label="$t('editMeta.addVoiceActor')"
        :disable="saving"
        @click="openCandidateDialog('vas')"
      />
    </q-card-section>

    <q-card-actions align="right">
      <q-btn class="app-dialog-cancel" flat :label="$t('common.cancel')" color="grey" :disable="saving" v-close-popup />
      <q-btn :label="$t('common.ok')" color="primary" :loading="saving" @click="confirmChange" />
    </q-card-actions>

    <q-dialog v-model="showCandidateDialog">
      <q-card style="width: 70vw; max-width: 680px">
        <q-card-section>
          <div class="text-h6">{{ searchTitle }}</div>
          <q-input v-model="searchCandidate" :label="$t('common.search')" autofocus clearable>
            <template v-slot:append>
              <q-btn
                v-if="canAddCustomCandidate"
                flat
                dense
                :label="$t('editMeta.addCustom')"
                @click="chooseCandidate({ id: 0, name: normalizedSearchCandidate })"
              />
            </template>
          </q-input>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-scroll-area style="height: 40vh">
            <q-list dense bordered separator class="rounded-borders">
              <q-item
                v-for="candidate in filteredCandidates"
                :key="`${candidate.id}-${candidate.name}`"
                clickable
                v-ripple
                @click="chooseCandidate(candidate)"
              >
                <q-item-section>{{ candidate.name }}</q-item-section>
                <q-item-section side>{{ candidate.count }}</q-item-section>
              </q-item>
            </q-list>
          </q-scroll-area>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn class="app-dialog-cancel" flat :label="$t('common.cancel')" color="negative" v-close-popup />
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

function cloneList(list) {
  return Array.isArray(list)
    ? list.filter(item => item && item.name !== null).map(item => ({ id: item.id, name: item.name }))
    : []
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
      return String(this.searchCandidate || '').trim()
    },

    filteredCandidates () {
      const keyword = this.normalizedSearchCandidate.toLocaleLowerCase()
      const candidates = this.candidates[this.showCandidateType] || []
      if (!keyword) return candidates
      return candidates.filter(candidate => String(candidate.name).toLocaleLowerCase().includes(keyword))
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
