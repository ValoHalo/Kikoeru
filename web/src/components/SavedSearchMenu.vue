<template>
  <q-btn flat round dense icon="manage_search" :aria-label="$t('savedSearch.title')">
    <AppTooltip>{{ $t('savedSearch.title') }}</AppTooltip>
    <q-menu @before-show="load"><q-list class="saved-search-menu">
      <q-item clickable v-close-popup @click="edit(null)"><q-item-section avatar><q-icon name="bookmark_add" /></q-item-section><q-item-section>{{ $t('savedSearch.save') }}</q-item-section></q-item>
      <q-separator />
      <q-item v-if="loading"><q-item-section><q-spinner /></q-item-section></q-item>
      <q-item v-for="item in searches" :key="item.id" clickable v-close-popup @click="$emit('apply', item.query)"><q-item-section class="saved-search-name">{{ $privateText(item.name) }}</q-item-section><q-item-section side><div class="row no-wrap"><q-btn flat round dense icon="edit" :aria-label="$t('common.rename')" @click.stop="edit(item)" /><q-btn flat round dense icon="delete_outline" :aria-label="$t('common.delete')" @click.stop="remove(item)" /></div></q-item-section></q-item>
      <q-item v-if="!loading && !searches.length"><q-item-section>{{ $t('savedSearch.empty') }}</q-item-section></q-item>
    </q-list></q-menu>
  </q-btn>
  <q-dialog v-model="editing"><q-card class="saved-search-dialog app-form-dialog"><q-form @submit.prevent="save"><q-card-section class="text-h6">{{ target ? $t('common.rename') : $t('savedSearch.save') }}</q-card-section><q-card-section><q-input v-model.trim="name" outlined autofocus maxlength="80" :label="$t('savedSearch.name')" :rules="[value => Boolean(value) || $t('common.nameRequired')]" /></q-card-section><q-card-actions align="right"><q-btn v-close-popup flat :label="$t('common.cancel')" /><q-btn flat color="primary" type="submit" :loading="saving" :label="$t('common.save')" /></q-card-actions></q-form></q-card></q-dialog>
</template>
<script>
import { appDialog } from '../utils/appDialog'
export default {
  props: { search: { type: Object, required: true } },
  emits: ['apply'],
  data () { return { searches: [], loading: false, editing: false, name: '', target: null, saving: false } },
  methods: {
    async load () {
      this.loading = true
      try { this.searches = (await this.$axios.get('/api/saved-searches')).data.searches }
      catch (error) { this.report(error) }
      finally { this.loading = false }
    },
    edit (target) { this.target = target; this.name = target?.name || ''; this.editing = true },
    async save () {
      this.saving = true
      try {
        if (this.target) await this.$axios.patch(`/api/saved-searches/${this.target.id}`, { name: this.name })
        else await this.$axios.post('/api/saved-searches', { name: this.name, search: this.search })
        this.editing = false
        await this.load()
      } catch (error) { this.report(error) }
      finally { this.saving = false }
    },
    remove (item) {
      appDialog(this.$q, { title: this.$t('common.delete'), message: this.$t('savedSearch.deleteNamed', { name: item.name }), cancel: this.$t('common.cancel'), ok: this.$t('common.delete') }).onOk(async () => {
        try { await this.$axios.delete(`/api/saved-searches/${item.id}`); await this.load() }
        catch (error) { this.report(error) }
      })
    },
    report (error) { this.$q.notify({ type: 'negative', message: error.response?.data?.error || this.$t('savedSearch.failed') }) }
  }
}
</script>
<style scoped>
.saved-search-menu { width: 360px; max-width: calc(100vw - 24px); }
.saved-search-name { overflow-wrap: anywhere; }
.saved-search-dialog { width: 400px; max-width: calc(100vw - 32px); }
</style>
