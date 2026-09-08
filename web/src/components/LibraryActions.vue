<template>
  <span class="library-actions" @click.stop>
    <template v-if="inline">
      <q-btn
        dense
        :flat="flat"
        :round="compact"
        :class="{ 'shadow-4': !flat }"
        :color="compact ? undefined : (flat ? 'teal' : 'cyan')"
        icon="create_new_folder"
        :label="compact ? undefined : $t('libraryActions.addToCollection')"
        :aria-label="$t('libraryActions.addToCollection')"
        @click="openCollectionDialog"
      ><q-tooltip v-if="compact">{{ $t('libraryActions.addToCollection') }}</q-tooltip></q-btn>
      <q-btn
        dense
        :flat="flat"
        :round="compact"
        :class="{ 'shadow-4': !flat }"
        :color="compact ? undefined : (flat ? 'teal' : 'cyan')"
        :icon="archived ? 'unarchive' : 'archive'"
        :label="compact ? undefined : (archived ? $t('libraryActions.unarchive') : $t('libraryActions.archive'))"
        :aria-label="archived ? $t('libraryActions.unarchive') : $t('libraryActions.archive')"
        @click="toggleArchive"
      ><q-tooltip v-if="compact">{{ archived ? $t('libraryActions.unarchive') : $t('libraryActions.archive') }}</q-tooltip></q-btn>
    </template>
    <q-btn v-else flat round dense icon="more_vert" :aria-label="$t('libraryActions.organize')" @click="loadCollections">
      <q-tooltip>{{ $t('libraryActions.organize') }}</q-tooltip>
      <q-menu>
        <q-list dense style="min-width: 170px">
          <q-item clickable v-close-popup @click="toggleArchive">
            <q-item-section avatar><q-icon :name="archived ? 'unarchive' : 'archive'" /></q-item-section>
            <q-item-section>{{ archived ? $t('libraryActions.unarchive') : $t('libraryActions.archive') }}</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="showCollectionDialog = true">
            <q-item-section avatar><q-icon name="create_new_folder" /></q-item-section>
            <q-item-section>{{ $t('libraryActions.addToCollection') }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <q-dialog v-model="showCollectionDialog">
      <q-card class="library-dialog">
        <q-card-section><div class="text-h6">{{ $t('libraryActions.addToCollection') }}</div></q-card-section>
        <q-card-section class="q-pt-none">
          <q-select v-model="selectedCollectionId" outlined emit-value map-options :options="collectionOptions" :label="$t('libraryActions.selectCollection')" :loading="loading" />
          <div class="row q-col-gutter-sm q-mt-sm">
            <div class="col"><q-input v-model.trim="newCollectionName" outlined dense maxlength="80" :label="$t('libraryActions.newCollectionName')" @keyup.enter="createCollection" /></div>
            <div class="col-auto"><q-btn outline color="primary" icon="add" :aria-label="$t('libraryActions.newCollection')" :disable="!newCollectionName" @click="createCollection"><q-tooltip>{{ $t('libraryActions.newCollection') }}</q-tooltip></q-btn></div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('common.cancel')" v-close-popup />
          <q-btn flat color="primary" :label="$t('libraryActions.add')" :disable="!selectedCollectionId" :loading="saving" @click="addToCollection" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </span>
</template>

<script>
import { t } from '../i18n'
import NotifyMixin from '../mixins/Notification.js'

export default {
  name: 'LibraryActions',
  mixins: [NotifyMixin],
  props: {
    workId: { type: Number, required: true },
    archived: { type: Boolean, default: false },
    inline: { type: Boolean, default: false },
    flat: { type: Boolean, default: false },
    compact: { type: Boolean, default: false }
  },
  emits: ['changed'],
  data () {
    return {
      collections: [],
      loading: false,
      saving: false,
      showCollectionDialog: false,
      selectedCollectionId: null,
      newCollectionName: ''
    }
  },
  computed: {
    collectionOptions () {
      return this.collections.map(item => ({ label: `${item.name}（${item.item_count}）`, value: item.id }))
    }
  },
  methods: {
    errorMessage (error, fallback) {
      return error.response && error.response.data && error.response.data.error ? error.response.data.error : fallback
    },
    async loadCollections () {
      this.loading = true
      try {
        const response = await this.$axios.get('/api/library/collections')
        this.collections = response.data.collections || []
      } catch (error) {
        this.showErrNotif(this.errorMessage(error, t('libraryActions.loadFailed')))
      } finally {
        this.loading = false
      }
    },
    openCollectionDialog () {
      this.showCollectionDialog = true
      this.loadCollections()
    },
    async toggleArchive () {
      try {
        if (this.archived) await this.$axios.delete(`/api/library/works/${this.workId}/archive`)
        else await this.$axios.put(`/api/library/works/${this.workId}/archive`)
        this.showSuccNotif(this.archived ? t('libraryActions.unarchived') : t('libraryActions.archived'))
        this.$emit('changed', { type: 'archive', archived: !this.archived })
      } catch (error) {
        this.showErrNotif(this.errorMessage(error, t('libraryActions.archiveFailed')))
      }
    },
    async createCollection () {
      if (!this.newCollectionName) return
      try {
        const response = await this.$axios.post('/api/library/collections', { name: this.newCollectionName })
        await this.loadCollections()
        this.selectedCollectionId = response.data.id
        this.newCollectionName = ''
      } catch (error) {
        this.showErrNotif(this.errorMessage(error, t('libraryActions.createFailed')))
      }
    },
    async addToCollection () {
      if (!this.selectedCollectionId) return
      this.saving = true
      try {
        const response = await this.$axios.post(`/api/library/collections/${this.selectedCollectionId}/items`, { workIds: [this.workId] })
        this.showSuccNotif(response.data.message)
        this.showCollectionDialog = false
        this.$emit('changed', { type: 'collection' })
      } catch (error) {
        this.showErrNotif(this.errorMessage(error, t('libraryActions.addFailed')))
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.library-actions { display: inline-flex; }
.library-dialog { width: 440px; max-width: 92vw; border-radius: 6px; }
</style>
