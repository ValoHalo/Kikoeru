<template>
  <div class="batch-toolbar">
    <span class="text-weight-medium">{{ $t('batchWorks.selected', { count: selected.length }) }}</span>
    <q-btn flat round dense icon="select_all" :disable="busy" :aria-label="$t('batchWorks.selectLoaded')" @click="$emit('select-all')"><AppTooltip>{{ $t('batchWorks.selectLoaded') }}</AppTooltip></q-btn>
    <q-btn flat round dense icon="deselect" :disable="busy || !selected.length" :aria-label="$t('batchWorks.clear')" @click="$emit('clear')"><AppTooltip>{{ $t('batchWorks.clear') }}</AppTooltip></q-btn>
    <q-space />
    <q-btn flat no-caps icon="create_new_folder" :label="$t('batchWorks.collection')" :disable="busy || !selected.length" @click="openCollections" />
    <q-btn flat no-caps icon="checklist" :label="$t('batchWorks.progress')" :disable="busy || !selected.length"><q-menu><q-list><q-item v-for="value in progressValues" :key="String(value)" clickable v-close-popup @click="confirm('progress', { progress: value })"><q-item-section>{{ $t(`batchWorks.${value || 'unset'}`) }}</q-item-section></q-item></q-list></q-menu></q-btn>
    <q-btn flat no-caps icon="archive" :label="$t('batchWorks.archive')" :loading="busy" :disable="!selected.length" @click="confirm('archive')" />
    <q-btn flat round dense icon="close" :disable="busy" :aria-label="$t('batchWorks.exit')" @click="$emit('exit')"><AppTooltip>{{ $t('batchWorks.exit') }}</AppTooltip></q-btn>
    <q-dialog v-model="showCollections"><q-card class="batch-dialog app-form-dialog"><q-card-section class="text-h6">{{ $t('batchWorks.collection') }}</q-card-section><q-card-section><q-select v-model="collectionId" outlined emit-value map-options :options="collections.map(item => ({ label: item.name, value: item.id }))" :label="$t('batchWorks.collection')" /></q-card-section><q-card-actions align="right"><q-btn v-close-popup flat :label="$t('common.cancel')" /><q-btn flat color="primary" :disable="!collectionId" :label="$t('common.ok')" @click="showCollections = false; confirm('collection', { collectionId })" /></q-card-actions></q-card></q-dialog>
  </div>
</template>
<script>
import { appDialog } from '../utils/appDialog'
export default {
  props: { selected: { type: Array, required: true } },
  emits: ['select-all', 'clear', 'exit', 'completed'],
  data () { return { busy: false, collections: [], collectionId: null, showCollections: false, progressValues: ['marked', 'listening', 'listened', 'replay', 'postponed', null] } },
  methods: {
    async openCollections () {
      try { this.collections = (await this.$axios.get('/api/library/collections')).data.collections; this.showCollections = true }
      catch (error) { this.report(error) }
    },
    confirm (action, values = {}) {
      const workIds = [...this.selected]
      appDialog(this.$q, { title: this.$t('batchWorks.confirm'), message: this.$t('batchWorks.confirmCount', { count: workIds.length }), cancel: this.$t('common.cancel'), ok: this.$t('common.ok') }).onOk(() => this.apply(action, values, workIds))
    },
    async apply (action, values, workIds) {
      if (this.busy) return
      this.busy = true
      try {
        const { data } = await this.$axios.post('/api/library/batch', { action, workIds, ...values }, { params: { nsfw: this.$store.getters['AudioPlayer/sfwOnly'] ? 1 : 0 } })
        this.$q.notify({ type: 'positive', message: this.$t('batchWorks.result', { changed: data.changed.length, unchanged: data.unchanged.length, missing: data.missing.length }) })
        this.$emit('completed', data)
      } catch (error) { this.report(error) }
      finally { this.busy = false }
    },
    report (error) { this.$q.notify({ type: 'negative', message: error.response?.data?.error || this.$t('batchWorks.failed') }) }
  }
}
</script>
<style scoped>
.batch-toolbar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-height: 48px; }
.batch-dialog { width: 400px; max-width: calc(100vw - 32px); }
</style>
