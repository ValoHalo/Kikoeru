<template>
  <q-page padding class="favourites-page">
    <q-tabs :model-value="mode" dense outside-arrows mobile-arrows align="left" active-color="primary" indicator-color="primary" class="favourites-tabs" @update:model-value="changeMode">
      <q-tab name="histroy" icon="history" :label="$t('favourites.history')" />
      <q-tab name="review" icon="star" :label="$t('common.myRating')" />
      <q-tab name="progress" icon="headphones" :label="$t('favourites.progress')" />
      <q-tab name="archived" icon="archive" :label="$t('favourites.archived')" />
      <q-tab name="folder" icon="folder_special" :label="$t('common.collections')" />
    </q-tabs>

    <div v-if="!['histroy', 'folder', 'archived'].includes(mode)" class="row justify-end q-mt-md">
      <q-select dense outlined v-model="sortBy" :options="sortOptions" :display-value="sortOptions.find(option => option.order === sortBy.order)?.label" />
      <q-btn :disable="sortButtonDisabled" flat round dense class="q-ml-sm" :icon="direction ? 'arrow_downward' : 'arrow_upward'" :aria-label="$t('favourites.sortDirection')" @click="switchSortMode" />
    </div>

    <div v-if="mode === 'progress'" class="q-pt-md">
      <q-btn-toggle v-model="progressFilter" @update:model-value="changeProgressFilter" toggle-color="primary" unelevated no-caps :options="progressOptions" />
    </div>

    <div v-if="mode !== 'folder'" class="q-pt-md">
      <q-infinite-scroll ref="scroll" :offset="500" :disable="stopLoad" @load="onLoad">
        <div v-if="works.length === 0 && !loading" class="empty-state text-center text-grey q-pa-xl">
          <q-icon :name="mode === 'archived' ? 'archive' : 'library_music'" size="42px" class="q-mb-sm" />
          <div>{{ emptyMessage }}</div>
        </div>
        <q-list v-if="works.length" bordered separator>
          <FavListItem v-for="work in works" :key="work.id" :workid="Number(work.id)" :metadata="work" :mode="mode" @reset="reset" />
        </q-list>
        <template #loading><div class="row justify-center q-my-md"><q-spinner-dots color="primary" size="40px" /></div></template>
      </q-infinite-scroll>
    </div>

    <div v-else class="row q-col-gutter-md q-pt-md">
      <div v-if="!selectedCollection || $q.screen.gt.sm" class="col-12 col-md-4">
        <div class="row items-center q-mb-sm">
          <div class="text-subtitle1 text-weight-medium">{{ $t('common.collections') }}</div>
          <q-space />
          <q-btn flat round dense icon="add" :aria-label="$t('favourites.newCollection')" @click="openCreateDialog"><q-tooltip>{{ $t('favourites.createCollection') }}</q-tooltip></q-btn>
          <q-btn flat round dense icon="refresh" :aria-label="$t('favourites.refreshCollections')" :loading="collectionLoading" @click="loadCollections"><q-tooltip>{{ $t('common.refresh') }}</q-tooltip></q-btn>
        </div>
        <q-list v-if="collections.length" bordered separator>
          <q-item v-for="collection in collections" :key="collection.id" clickable v-ripple :active="selectedCollection && selectedCollection.id === collection.id" active-class="bg-primary text-white" @click="openCollection(collection.id)">
            <q-item-section avatar><q-icon name="folder" /></q-item-section>
            <q-item-section><q-item-label lines="1">{{ collection.name }}</q-item-label><q-item-label caption :class="{ 'text-white': selectedCollection && selectedCollection.id === collection.id }">{{ $t('favourites.workCount', { count: collection.item_count }) }}</q-item-label></q-item-section>
            <q-item-section side><q-icon name="chevron_right" :color="selectedCollection && selectedCollection.id === collection.id ? 'white' : undefined" /></q-item-section>
          </q-item>
        </q-list>
        <div v-else-if="!collectionLoading" class="empty-state text-center text-grey q-pa-xl"><q-icon name="folder_special" size="42px" class="q-mb-sm" /><div>{{ $t('favourites.noCollections') }}</div></div>
      </div>

      <div v-if="selectedCollection" class="col-12 col-md-8">
        <div class="row items-center no-wrap q-mb-sm">
          <q-btn v-if="$q.screen.lt.md" flat round dense icon="arrow_back" :aria-label="$t('favourites.backToCollections')" @click="closeCollection" />
          <div class="col text-subtitle1 text-weight-medium ellipsis q-ml-sm">{{ selectedCollection.name }}</div>
          <q-btn flat round dense icon="more_vert" :aria-label="$t('favourites.moreActions')">
            <q-menu><q-list dense style="min-width: 140px"><q-item clickable v-close-popup @click="openRenameDialog"><q-item-section avatar><q-icon name="edit" /></q-item-section><q-item-section>{{ $t('common.rename') }}</q-item-section></q-item><q-item clickable v-close-popup class="text-negative" @click="confirmDeleteCollection"><q-item-section avatar><q-icon name="delete" /></q-item-section><q-item-section>{{ $t('common.delete') }}</q-item-section></q-item></q-list></q-menu>
          </q-btn>
        </div>

        <q-list v-if="collectionWorks.length" bordered separator>
          <draggable v-model="collectionWorks" item-key="id" handle=".collection-handle" @change="saveCollectionOrder">
            <template #item="{ element: work }">
              <q-item>
                <q-item-section avatar><router-link :to="`/work/${work.id}`"><q-img :key="$store.getters['AudioPlayer/coverUrl'](work.id, '240x240')" :src="$store.getters['AudioPlayer/coverUrl'](work.id, '240x240')" ratio="1" class="collection-cover" /></router-link></q-item-section>
                <q-item-section>
                  <q-item-label lines="2"><router-link :to="`/work/${work.id}`" class="text-primary">{{ work.title }}</router-link></q-item-label>
                  <q-item-label caption>{{ work.circle && work.circle.name }}</q-item-label>
                  <q-badge v-if="work.archived_at" color="grey-7" :label="$t('favourites.archived')" class="collection-archive-badge" />
                </q-item-section>
                <q-item-section side class="collection-handle"><q-icon name="drag_handle" /><q-tooltip>{{ $t('favourites.reorder') }}</q-tooltip></q-item-section>
                <q-item-section side><q-btn flat round dense icon="close" color="negative" :aria-label="$t('favourites.removeFromCollection')" @click="removeCollectionItem(work.id)" /></q-item-section>
              </q-item>
            </template>
          </draggable>
        </q-list>
        <div v-else class="empty-state text-center text-grey q-pa-xl">{{ $t('favourites.emptyCollection') }}</div>
      </div>
      <div v-else-if="$q.screen.gt.sm" class="col-md-8 empty-state text-center text-grey q-pa-xl">{{ $t('favourites.selectCollection') }}</div>
    </div>

    <q-dialog v-model="showCreateDialog"><q-card class="collection-dialog"><q-form @submit.prevent="createCollection"><q-card-section><div class="text-h6">{{ $t('favourites.newCollection') }}</div></q-card-section><q-card-section class="q-pt-none"><q-input v-model.trim="collectionName" autofocus outlined maxlength="80" :label="$t('favourites.collectionName')" :rules="[value => Boolean(value) || $t('common.nameRequired')]" /></q-card-section><q-card-actions align="right"><q-btn flat :label="$t('common.cancel')" v-close-popup /><q-btn flat color="primary" :label="$t('common.create')" type="submit" /></q-card-actions></q-form></q-card></q-dialog>
    <q-dialog v-model="showRenameDialog"><q-card class="collection-dialog"><q-form @submit.prevent="renameCollection"><q-card-section><div class="text-h6">{{ $t('favourites.renameCollection') }}</div></q-card-section><q-card-section class="q-pt-none"><q-input v-model.trim="collectionName" autofocus outlined maxlength="80" :label="$t('favourites.collectionName')" :rules="[value => Boolean(value) || $t('common.nameRequired')]" /></q-card-section><q-card-actions align="right"><q-btn flat :label="$t('common.cancel')" v-close-popup /><q-btn flat color="primary" :label="$t('common.save')" type="submit" /></q-card-actions></q-form></q-card></q-dialog>
  </q-page>
</template>

<script>
import { t } from '../i18n'
import draggable from 'vuedraggable'
import FavListItem from 'components/FavListItem.vue'
import NotifyMixin from '../mixins/Notification.js'

export default {
  name: 'Favourites',
  mixins: [NotifyMixin],
  components: { FavListItem, draggable },
  props: {
    route: { type: String, default: 'review' },
    progress: { type: String, default: 'marked' }
  },
  data () {
    return {
      mode: 'histroy', progressFilter: 'marked', works: [], loading: false, stopLoad: false,
      pagination: { currentPage: 0, pageSize: 12, totalCount: 0 }, sortMode: 'desc',
      sortBy: { order: 'updated_at' },

      collections: [], selectedCollection: null, collectionWorks: [], collectionLoading: false,
      showCreateDialog: false, showRenameDialog: false, collectionName: ''
    }
  },
  computed: {
    sortOptions () {
      return [
        { label: t('favourites.markedAt'), order: 'updated_at' }, { label: t('favourites.rating'), order: 'userRating' },
        { label: t('favourites.releasedAt'), order: 'release' }, { label: t('favourites.reviewCount'), order: 'review_count' },
        { label: t('favourites.sales'), order: 'dl_count' }, { label: t('favourites.newAllAges'), order: 'allage' },
        { label: t('favourites.newAdult'), order: 'nsfw' }
      ]
    },
    progressOptions () {
      return [
        { label: t('favourites.marked'), value: 'marked' }, { label: t('favourites.listening'), value: 'listening' },
        { label: t('favourites.listened'), value: 'listened' }, { label: t('favourites.replay'), value: 'replay' },
        { label: t('favourites.postponed'), value: 'postponed' }
      ]
    },
    direction () { return this.sortMode === 'desc' },
    sortButtonDisabled () { return this.sortBy.order === 'allage' || this.sortBy.order === 'nsfw' },
    emptyMessage () {
      if (this.mode === 'archived') return t('favourites.noArchived')
      if (this.mode === 'histroy') return t('favourites.noHistory')
      return t('favourites.noReviews')
    }
  },
  watch: {
    sortBy (value) { localStorage.sortByFavourites = JSON.stringify({ order: value.order }); this.reset() },
    sortMode () { this.reset() },
    route () { this.mode = this.route; this.reset() },
    progress () { this.progressFilter = this.progress; this.reset() }
  },
  created () { this.mode = this.route; this.progressFilter = this.progress },
  mounted () {
    if (localStorage.sortByFavourites) {
      try { this.sortBy = JSON.parse(localStorage.sortByFavourites) } catch (_) { localStorage.removeItem('sortByFavourites') }
    }
    if (this.mode === 'folder') this.loadCollections()
  },
  methods: {
    errorMessage (error, fallback) { return error.response && error.response.data && error.response.data.error ? error.response.data.error : fallback },
    changeMode (newMode) { this.$router.push(`/favourites/${newMode}`); this.mode = newMode; this.reset() },
    changeProgressFilter (newFilter) { this.$router.push(`/favourites/progress/${newFilter}`); this.reset() },
    switchSortMode () { this.sortMode = this.sortMode === 'desc' ? 'asc' : 'desc' },
    onLoad (_index, done) { this.requestWorksQueue().then(() => done()) },
    reset () {
      if (this.mode === 'folder') { this.loadCollections(); return }
      this.stopLoad = true
      this.works = []
      this.pagination = { currentPage: 0, pageSize: 12, totalCount: 0 }
      this.requestWorksQueue().then(() => { this.stopLoad = false })
    },
    async requestWorksQueue () {
      const params = { order: this.sortBy.order, sort: this.sortMode, page: this.pagination.currentPage + 1 || 1 }
      if (this.sortBy.order === 'allage') { params.order = 'nsfw'; params.sort = 'asc' }
      if (this.sortBy.order === 'nsfw') { params.order = 'nsfw'; params.sort = 'desc' }
      if (this.mode === 'progress') params.filter = this.progressFilter
      const requestUrl = this.mode === 'histroy' ? '/api/histroy' : this.mode === 'archived' ? '/api/library/archived' : '/api/review'
      this.loading = true
      try {
        const response = await this.$axios.get(requestUrl, { params })
        const pageWorks = response.data.works || []
        this.works = params.page === 1 ? pageWorks.concat() : this.works.concat(pageWorks)
        this.pagination = response.data.pagination
        if (this.works.length >= Number(this.pagination.totalCount)) this.stopLoad = true
      } catch (error) {
        this.showErrNotif(this.errorMessage(error, t('favourites.loadWorksFailed')))
        this.stopLoad = true
      } finally { this.loading = false }
    },
    async loadCollections () {
      this.collectionLoading = true
      try {
        const response = await this.$axios.get('/api/library/collections')
        this.collections = response.data.collections || []
        if (this.selectedCollection) {
          const stillExists = this.collections.some(item => item.id === this.selectedCollection.id)
          if (stillExists) await this.openCollection(this.selectedCollection.id)
          else this.closeCollection()
        }
      } catch (error) { this.showErrNotif(this.errorMessage(error, t('favourites.loadCollectionsFailed'))) }
      finally { this.collectionLoading = false }
    },
    async openCollection (id) {
      try {
        const response = await this.$axios.get(`/api/library/collections/${id}`)
        this.selectedCollection = response.data.collection
        this.collectionWorks = response.data.items || []
      } catch (error) { this.showErrNotif(this.errorMessage(error, t('favourites.loadCollectionsFailed'))) }
    },
    closeCollection () { this.selectedCollection = null; this.collectionWorks = [] },
    openCreateDialog () { this.collectionName = ''; this.showCreateDialog = true },
    openRenameDialog () { this.collectionName = this.selectedCollection.name; this.showRenameDialog = true },
    async createCollection () {
      if (!this.collectionName) return
      try {
        const response = await this.$axios.post('/api/library/collections', { name: this.collectionName })
        this.showCreateDialog = false
        await this.loadCollections()
        await this.openCollection(response.data.id)
      } catch (error) { this.showErrNotif(this.errorMessage(error, t('favourites.createFailed'))) }
    },
    async renameCollection () {
      if (!this.collectionName || !this.selectedCollection) return
      try {
        await this.$axios.patch(`/api/library/collections/${this.selectedCollection.id}`, { name: this.collectionName })
        this.showRenameDialog = false
        await this.loadCollections()
      } catch (error) { this.showErrNotif(this.errorMessage(error, t('favourites.renameFailed'))) }
    },
    confirmDeleteCollection () { this.$q.dialog({ title: t('favourites.deleteCollection'), message: t('favourites.deletePrompt', { name: this.selectedCollection.name }), cancel: t('common.cancel'), ok: { label: t('common.delete'), color: 'negative' } }).onOk(() => this.deleteCollection()) },
    async deleteCollection () {
      try { await this.$axios.delete(`/api/library/collections/${this.selectedCollection.id}`); this.closeCollection(); await this.loadCollections() }
      catch (error) { this.showErrNotif(this.errorMessage(error, t('favourites.deleteFailed'))) }
    },
    async removeCollectionItem (workId) {
      try {
        await this.$axios.delete(`/api/library/collections/${this.selectedCollection.id}/items/${workId}`)
        this.collectionWorks = this.collectionWorks.filter(item => Number(item.id) !== Number(workId))
        await this.loadCollections()
      } catch (error) { this.showErrNotif(this.errorMessage(error, t('favourites.removeFailed'))) }
    },
    async saveCollectionOrder () {
      try { await this.$axios.put(`/api/library/collections/${this.selectedCollection.id}/items/order`, { workIds: this.collectionWorks.map(item => Number(item.id)) }) }
      catch (error) { this.showErrNotif(this.errorMessage(error, t('favourites.reorderFailed'))); await this.openCollection(this.selectedCollection.id) }
    }
  }
}
</script>

<style scoped>
.favourites-page { max-width: 1120px; margin: 0 auto; }
.favourites-tabs { border-bottom: 1px solid rgba(127, 127, 127, .28); }
.empty-state { min-height: 180px; }
.collection-cover { width: 56px; height: 56px; border-radius: 4px; }
.collection-handle { cursor: grab; }
.collection-archive-badge { align-self: flex-start; margin-top: 4px; }
.collection-dialog { width: 420px; max-width: 92vw; border-radius: 6px; }
</style>
