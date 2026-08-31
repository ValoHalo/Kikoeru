<template>
  <span class="library-actions" @click.stop>
    <q-btn flat round dense icon="more_vert" aria-label="整理作品" @click="loadCollections">
      <q-tooltip>整理作品</q-tooltip>
      <q-menu>
        <q-list dense style="min-width: 170px">
          <q-item clickable v-close-popup @click="toggleArchive">
            <q-item-section avatar><q-icon :name="archived ? 'unarchive' : 'archive'" /></q-item-section>
            <q-item-section>{{ archived ? '移出归档' : '归档作品' }}</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="showCollectionDialog = true">
            <q-item-section avatar><q-icon name="create_new_folder" /></q-item-section>
            <q-item-section>加入作品分组</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <q-dialog v-model="showCollectionDialog">
      <q-card class="library-dialog">
        <q-card-section><div class="text-h6">加入作品分组</div></q-card-section>
        <q-card-section class="q-pt-none">
          <q-select v-model="selectedCollectionId" outlined emit-value map-options :options="collectionOptions" label="选择分组" :loading="loading" />
          <div class="row q-col-gutter-sm q-mt-sm">
            <div class="col"><q-input v-model.trim="newCollectionName" outlined dense maxlength="80" label="新分组名称" @keyup.enter="createCollection" /></div>
            <div class="col-auto"><q-btn outline color="primary" icon="add" aria-label="新建分组" :disable="!newCollectionName" @click="createCollection"><q-tooltip>新建分组</q-tooltip></q-btn></div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" v-close-popup />
          <q-btn flat color="primary" label="加入" :disable="!selectedCollectionId" :loading="saving" @click="addToCollection" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </span>
</template>

<script>
import NotifyMixin from '../mixins/Notification.js'

export default {
  name: 'LibraryActions',
  mixins: [NotifyMixin],
  props: {
    workId: { type: Number, required: true },
    archived: { type: Boolean, default: false }
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
        this.showErrNotif(this.errorMessage(error, '读取作品分组失败'))
      } finally {
        this.loading = false
      }
    },
    async toggleArchive () {
      try {
        if (this.archived) await this.$axios.delete(`/api/library/works/${this.workId}/archive`)
        else await this.$axios.put(`/api/library/works/${this.workId}/archive`)
        this.showSuccNotif(this.archived ? '作品已移出归档' : '作品已归档')
        this.$emit('changed', { type: 'archive', archived: !this.archived })
      } catch (error) {
        this.showErrNotif(this.errorMessage(error, '修改归档状态失败'))
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
        this.showErrNotif(this.errorMessage(error, '创建作品分组失败'))
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
        this.showErrNotif(this.errorMessage(error, '加入作品分组失败'))
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
