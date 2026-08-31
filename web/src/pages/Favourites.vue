<template>
  <q-page padding class="favourites-page">
    <q-tabs :model-value="mode" dense outside-arrows mobile-arrows align="left" active-color="primary" indicator-color="primary" class="favourites-tabs" @update:model-value="changeMode">
      <q-tab name="histroy" icon="history" label="播放历史" />
      <q-tab name="review" icon="star" label="我的评价" />
      <q-tab name="progress" icon="headphones" label="我的进度" />
      <q-tab name="archived" icon="archive" label="已归档" />
      <q-tab name="folder" icon="folder_special" label="作品分组" />
    </q-tabs>

    <div v-if="!['histroy', 'folder', 'archived'].includes(mode)" class="row justify-end q-mt-md">
      <q-select dense outlined v-model="sortBy" :options="sortOptions" />
      <q-btn :disable="sortButtonDisabled" flat round dense class="q-ml-sm" :icon="direction ? 'arrow_downward' : 'arrow_upward'" aria-label="切换排序方向" @click="switchSortMode" />
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
          <div class="text-subtitle1 text-weight-medium">作品分组</div>
          <q-space />
          <q-btn flat round dense icon="add" aria-label="新建作品分组" @click="openCreateDialog"><q-tooltip>新建分组</q-tooltip></q-btn>
          <q-btn flat round dense icon="refresh" aria-label="刷新作品分组" :loading="collectionLoading" @click="loadCollections"><q-tooltip>刷新</q-tooltip></q-btn>
        </div>
        <q-list v-if="collections.length" bordered separator>
          <q-item v-for="collection in collections" :key="collection.id" clickable v-ripple :active="selectedCollection && selectedCollection.id === collection.id" active-class="bg-primary text-white" @click="openCollection(collection.id)">
            <q-item-section avatar><q-icon name="folder" /></q-item-section>
            <q-item-section><q-item-label lines="1">{{ collection.name }}</q-item-label><q-item-label caption :class="{ 'text-white': selectedCollection && selectedCollection.id === collection.id }">{{ collection.item_count }} 个作品</q-item-label></q-item-section>
            <q-item-section side><q-icon name="chevron_right" :color="selectedCollection && selectedCollection.id === collection.id ? 'white' : undefined" /></q-item-section>
          </q-item>
        </q-list>
        <div v-else-if="!collectionLoading" class="empty-state text-center text-grey q-pa-xl"><q-icon name="folder_special" size="42px" class="q-mb-sm" /><div>还没有作品分组</div></div>
      </div>

      <div v-if="selectedCollection" class="col-12 col-md-8">
        <div class="row items-center no-wrap q-mb-sm">
          <q-btn v-if="$q.screen.lt.md" flat round dense icon="arrow_back" aria-label="返回分组列表" @click="closeCollection" />
          <div class="col text-subtitle1 text-weight-medium ellipsis q-ml-sm">{{ selectedCollection.name }}</div>
          <q-btn flat round dense icon="more_vert" aria-label="更多分组操作">
            <q-menu><q-list dense style="min-width: 140px"><q-item clickable v-close-popup @click="openRenameDialog"><q-item-section avatar><q-icon name="edit" /></q-item-section><q-item-section>重命名</q-item-section></q-item><q-item clickable v-close-popup class="text-negative" @click="confirmDeleteCollection"><q-item-section avatar><q-icon name="delete" /></q-item-section><q-item-section>删除</q-item-section></q-item></q-list></q-menu>
          </q-btn>
        </div>

        <q-list v-if="collectionWorks.length" bordered separator>
          <draggable v-model="collectionWorks" item-key="id" handle=".collection-handle" @change="saveCollectionOrder">
            <template #item="{ element: work }">
              <q-item>
                <q-item-section avatar><router-link :to="`/work/${work.id}`"><q-img :src="`/api/cover/${work.id}?type=240x240`" ratio="1" class="collection-cover" /></router-link></q-item-section>
                <q-item-section>
                  <q-item-label lines="2"><router-link :to="`/work/${work.id}`" class="text-primary">{{ work.title }}</router-link></q-item-label>
                  <q-item-label caption>{{ work.circle && work.circle.name }}</q-item-label>
                  <q-badge v-if="work.archived_at" color="grey-7" label="已归档" class="collection-archive-badge" />
                </q-item-section>
                <q-item-section side class="collection-handle"><q-icon name="drag_handle" /><q-tooltip>拖动排序</q-tooltip></q-item-section>
                <q-item-section side><q-btn flat round dense icon="close" color="negative" aria-label="从分组移除" @click="removeCollectionItem(work.id)" /></q-item-section>
              </q-item>
            </template>
          </draggable>
        </q-list>
        <div v-else class="empty-state text-center text-grey q-pa-xl">此分组还没有作品</div>
      </div>
      <div v-else-if="$q.screen.gt.sm" class="col-md-8 empty-state text-center text-grey q-pa-xl">选择一个作品分组</div>
    </div>

    <q-dialog v-model="showCreateDialog"><q-card class="collection-dialog"><q-form @submit.prevent="createCollection"><q-card-section><div class="text-h6">新建作品分组</div></q-card-section><q-card-section class="q-pt-none"><q-input v-model.trim="collectionName" autofocus outlined maxlength="80" label="分组名称" :rules="[value => Boolean(value) || '请输入名称']" /></q-card-section><q-card-actions align="right"><q-btn flat label="取消" v-close-popup /><q-btn flat color="primary" label="创建" type="submit" /></q-card-actions></q-form></q-card></q-dialog>
    <q-dialog v-model="showRenameDialog"><q-card class="collection-dialog"><q-form @submit.prevent="renameCollection"><q-card-section><div class="text-h6">重命名作品分组</div></q-card-section><q-card-section class="q-pt-none"><q-input v-model.trim="collectionName" autofocus outlined maxlength="80" label="分组名称" :rules="[value => Boolean(value) || '请输入名称']" /></q-card-section><q-card-actions align="right"><q-btn flat label="取消" v-close-popup /><q-btn flat color="primary" label="保存" type="submit" /></q-card-actions></q-form></q-card></q-dialog>
  </q-page>
</template>

<script>
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
      sortBy: { label: '标记时间', order: 'updated_at' },
      sortOptions: [
        { label: '标记时间', order: 'updated_at' }, { label: '评价', order: 'userRating' },
        { label: '发布时间', order: 'release' }, { label: '评论数量', order: 'review_count' },
        { label: '售出数量', order: 'dl_count' }, { label: '全年龄新作', order: 'allage' },
        { label: '18禁新作', order: 'nsfw' }
      ],
      progressOptions: [
        { label: '想听', value: 'marked' }, { label: '在听', value: 'listening' },
        { label: '听过', value: 'listened' }, { label: '重听', value: 'replay' },
        { label: '搁置', value: 'postponed' }
      ],
      collections: [], selectedCollection: null, collectionWorks: [], collectionLoading: false,
      showCreateDialog: false, showRenameDialog: false, collectionName: ''
    }
  },
  computed: {
    direction () { return this.sortMode === 'desc' },
    sortButtonDisabled () { return this.sortBy.order === 'allage' || this.sortBy.order === 'nsfw' },
    emptyMessage () {
      if (this.mode === 'archived') return '还没有归档作品'
      if (this.mode === 'histroy') return '播放过的作品会出现在这里'
      return '在作品页面标星或标记进度后，作品会出现在这里'
    }
  },
  watch: {
    sortBy (value) { localStorage.sortByFavourites = JSON.stringify(value); this.reset() },
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
        this.showErrNotif(this.errorMessage(error, '读取作品失败'))
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
      } catch (error) { this.showErrNotif(this.errorMessage(error, '读取作品分组失败')) }
      finally { this.collectionLoading = false }
    },
    async openCollection (id) {
      try {
        const response = await this.$axios.get(`/api/library/collections/${id}`)
        this.selectedCollection = response.data.collection
        this.collectionWorks = response.data.items || []
      } catch (error) { this.showErrNotif(this.errorMessage(error, '读取作品分组失败')) }
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
      } catch (error) { this.showErrNotif(this.errorMessage(error, '创建作品分组失败')) }
    },
    async renameCollection () {
      if (!this.collectionName || !this.selectedCollection) return
      try {
        await this.$axios.patch(`/api/library/collections/${this.selectedCollection.id}`, { name: this.collectionName })
        this.showRenameDialog = false
        await this.loadCollections()
      } catch (error) { this.showErrNotif(this.errorMessage(error, '重命名作品分组失败')) }
    },
    confirmDeleteCollection () { this.$q.dialog({ title: '删除作品分组', message: `确定删除“${this.selectedCollection.name}”吗？作品本身不会被删除。`, cancel: '取消', ok: { label: '删除', color: 'negative' } }).onOk(() => this.deleteCollection()) },
    async deleteCollection () {
      try { await this.$axios.delete(`/api/library/collections/${this.selectedCollection.id}`); this.closeCollection(); await this.loadCollections() }
      catch (error) { this.showErrNotif(this.errorMessage(error, '删除作品分组失败')) }
    },
    async removeCollectionItem (workId) {
      try {
        await this.$axios.delete(`/api/library/collections/${this.selectedCollection.id}/items/${workId}`)
        this.collectionWorks = this.collectionWorks.filter(item => Number(item.id) !== Number(workId))
        await this.loadCollections()
      } catch (error) { this.showErrNotif(this.errorMessage(error, '从分组移除作品失败')) }
    },
    async saveCollectionOrder () {
      try { await this.$axios.put(`/api/library/collections/${this.selectedCollection.id}/items/order`, { workIds: this.collectionWorks.map(item => Number(item.id)) }) }
      catch (error) { this.showErrNotif(this.errorMessage(error, '保存作品顺序失败')); await this.openCollection(this.selectedCollection.id) }
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
