<template>
  <q-page class="admin-page data-page">
    <header class="settings-heading">
      <h1>{{ $t('dataTransfer.title') }}</h1>
      <q-btn outline no-caps color="primary" icon="download" class="settings-action-button" :label="$t('dataTransfer.export')" :loading="exporting" :disable="importing" @click="exportData" />
    </header>

    <p class="text-grey-7 data-scope">{{ $t('dataTransfer.scope') }}</p>
    <section class="settings-section" aria-labelledby="data-import-title">
      <div class="settings-section__heading">
        <q-icon name="upload_file" size="22px" />
        <h2 id="data-import-title">{{ $t('dataTransfer.import') }}</h2>
      </div>
      <div class="data-file-row">
        <q-file v-model="file" outlined clearable :disable="busy" :label="$t('dataTransfer.file')" accept=".json,.db,.sqlite,.sqlite3,application/json,application/vnd.sqlite3" :max-file-size="67108864" @update:model-value="resetPreview" @rejected="fileRejected">
          <template #prepend><q-icon name="attach_file" /></template>
        </q-file>
        <q-btn unelevated no-caps color="primary" icon="fact_check" :label="$t('dataTransfer.preview')" :loading="checking" :disable="!file || importing" @click="inspectFile" />
      </div>
      <p class="text-caption text-grey-7">{{ $t('dataTransfer.fileHint') }}</p>
      <q-banner v-if="error" class="data-notice data-notice--error" role="alert">
        <template #avatar><q-icon name="error_outline" /></template>
        {{ error }}
      </q-banner>
    </section>

    <template v-if="preview">
      <section class="settings-section" aria-labelledby="data-preview-title">
        <div class="settings-section__heading">
          <q-icon name="description" size="22px" />
          <div>
            <h2 id="data-preview-title">{{ $t(`dataTransfer.${preview.source}`) }}</h2>
            <div v-if="preview.exportedAt" class="text-caption text-grey-7">{{ $t('dataTransfer.exportedAt', { value: formatDate(preview.exportedAt) }) }}</div>
          </div>
        </div>
        <q-banner v-if="result" class="data-notice data-notice--success q-mb-md" role="status">
          <template #avatar><q-icon name="check_circle" /></template>
          {{ $t('dataTransfer.completed', { added: totalAdded, skipped: totalSkipped }) }}
        </q-banner>
        <q-markup-table flat bordered class="data-table">
          <thead><tr><th class="text-left">{{ $t('dataTransfer.category') }}</th><th class="text-right">{{ $t('dataTransfer.records') }}</th><th v-if="result" class="text-right">{{ $t('dataTransfer.added') }}</th><th v-if="result" class="text-right">{{ $t('dataTransfer.skipped') }}</th></tr></thead>
          <tbody>
            <tr v-for="row in countRows" :key="row.table">
              <td>{{ $t(`dataTransfer.tables.${row.table}`) }}</td><td class="text-right">{{ row.count }}</td>
              <td v-if="result" class="text-right">{{ result[row.table].added }}</td><td v-if="result" class="text-right">{{ result[row.table].skipped }}</td>
            </tr>
            <tr v-if="countRows.length === 0"><td colspan="4">{{ $t('dataTransfer.empty') }}</td></tr>
          </tbody>
        </q-markup-table>
        <p v-if="preview.ignoredTranslationTasks" class="text-caption text-grey-7">{{ $t('dataTransfer.translationTasks', { count: preview.ignoredTranslationTasks }) }}</p>
        <q-banner v-if="preview.unavailableTracks" class="data-notice q-mt-md">
          <template #avatar><q-icon name="info_outline" /></template>
          {{ $t('dataTransfer.unavailableTracks', { count: preview.unavailableTracks }) }}
        </q-banner>
      </section>

      <section v-if="preview.roots.length && !result" class="settings-section" aria-labelledby="data-roots-title">
        <div class="settings-section__heading"><q-icon name="folder_open" size="22px" /><h2 id="data-roots-title">{{ $t('dataTransfer.roots') }}</h2></div>
        <q-list bordered separator class="settings-list">
          <q-item v-for="root in preview.roots" :key="root">
            <q-item-section><q-item-label>{{ root || $t('dataTransfer.unnamed') }}</q-item-label></q-item-section>
            <q-item-section side class="data-mapping-control"><q-select v-model="rootTargets[root]" outlined dense :options="preview.targetRoots" :label="$t('dataTransfer.targetRoot')" :disable="importing" /></q-item-section>
          </q-item>
        </q-list>
        <q-btn v-if="!preview.targetRoots.length" flat no-caps color="primary" icon="folder" to="/admin" :label="$t('dataTransfer.manageFolders')" />
      </section>

      <section v-if="preview.users.length && !result" class="settings-section" aria-labelledby="data-users-title">
        <div class="settings-section__heading"><q-icon name="manage_accounts" size="22px" /><h2 id="data-users-title">{{ $t('dataTransfer.users') }}</h2></div>
        <q-list bordered separator class="settings-list">
          <q-item v-for="user in preview.users" :key="user">
            <q-item-section><q-item-label>{{ user }}</q-item-label></q-item-section>
            <q-item-section side class="data-mapping-control"><q-select v-model="userTargets[user]" outlined dense :options="userOptions" :label="$t('dataTransfer.targetUser')" :disable="importing" /></q-item-section>
          </q-item>
        </q-list>
        <p v-if="duplicateUsers" class="text-negative text-caption">{{ $t('dataTransfer.userCollision') }}</p>
        <q-btn flat no-caps color="primary" icon="person_add" to="/admin/usermanage" :disable="importing" :label="$t('dataTransfer.manageUsers')" />
      </section>

      <div v-if="!result" class="data-import-actions">
        <p class="text-caption text-grey-7">{{ $t('dataTransfer.mergeRule') }}</p>
        <q-btn unelevated no-caps color="primary" icon="file_upload" :label="$t('dataTransfer.confirmImport')" :disable="!canImport" :loading="importing" @click="confirmImport" />
      </div>
    </template>
  </q-page>
</template>

<script>
import { exportFile } from 'quasar'
import { appDialog } from '../../utils/appDialog'
import { t } from '../../i18n'

export default {
  name: 'DataManage',
  data () {
    return { file: null, preview: null, result: null, rootTargets: {}, userTargets: {}, checking: false, importing: false, exporting: false, error: '' }
  },
  computed: {
    busy () { return this.checking || this.importing },
    userOptions () { return [...this.preview.targetUsers.map(name => ({ label: name, value: name })), { label: t('dataTransfer.skipUser'), value: null }] },
    countRows () { return Object.entries(this.preview.counts).filter(([table, count]) => table !== 't_user' && count > 0).map(([table, count]) => ({ table, count })) },
    duplicateUsers () {
      const values = Object.values(this.userTargets).filter(value => value && value.value !== null).map(value => value.value)
      return new Set(values).size !== values.length
    },
    canImport () { return this.preview && !this.busy && !this.result && !this.duplicateUsers && this.countRows.length > 0 && this.preview.roots.every(root => this.preview.targetRoots.includes(this.rootTargets[root])) && this.preview.users.every(user => this.userTargets[user]) },
    totalAdded () { return Object.values(this.result).reduce((total, row) => total + row.added, 0) },
    totalSkipped () { return Object.values(this.result).reduce((total, row) => total + row.skipped, 0) }
  },
  beforeRouteLeave () { return !this.importing },
  methods: {
    resetPreview () { this.preview = null; this.result = null; this.error = ''; this.userTargets = {}; this.rootTargets = {} },
    fileRejected () { this.resetPreview(); this.error = t('dataTransfer.fileRejected') },
    formatDate (value) { return new Date(value).toLocaleString(this.$i18n.locale) },
    async showError (error) {
      let data = error.response && error.response.data
      if (data instanceof Blob) {
        try { data = JSON.parse(await data.text()) } catch { data = null }
      }
      this.error = data && data.error ? data.error : t('dataTransfer.failed')
    },
    uploadBody (options) {
      const body = new FormData()
      body.append('file', this.file)
      if (options) body.append('options', JSON.stringify(options))
      return body
    },
    async inspectFile () {
      this.resetPreview()
      this.checking = true
      try {
        const { data } = await this.$axios.post('/api/data/preview', this.uploadBody(), { headers: { 'Content-Type': 'multipart/form-data' } })
        this.preview = data
        this.rootTargets = Object.fromEntries(data.roots.map(root => [root, data.targetRoots.includes(root) ? root : null]))
        this.userTargets = Object.fromEntries(data.users.map(user => [user, data.targetUsers.includes(user) ? { label: user, value: user } : null]))
      } catch (error) { await this.showError(error) }
      finally { this.checking = false }
    },
    confirmImport () {
      appDialog(this.$q, { title: t('dataTransfer.confirmImport'), message: t('dataTransfer.mergeRule'), cancel: t('common.cancel'), ok: { label: t('dataTransfer.import'), color: 'primary' } }).onOk(() => this.importData())
    },
    async importData () {
      if (!this.canImport) return
      this.importing = true
      this.error = ''
      try {
        const options = { digest: this.preview.digest, roots: this.rootTargets, users: Object.fromEntries(Object.entries(this.userTargets).map(([user, target]) => [user, target.value])) }
        const { data } = await this.$axios.post('/api/data/import', this.uploadBody(options), { headers: { 'Content-Type': 'multipart/form-data' } })
        this.result = data.counts
      } catch (error) { await this.showError(error) }
      finally { this.importing = false }
    },
    async exportData () {
      this.exporting = true
      this.error = ''
      try {
        const response = await this.$axios.get('/api/data/export', { responseType: 'blob' })
        const filename = `kikoeru-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
        if (exportFile(filename, response.data, 'application/json') !== true) this.error = t('dataTransfer.downloadFailed')
      } catch (error) { await this.showError(error) }
      finally { this.exporting = false }
    }
  }
}
</script>

<style lang="scss" scoped>
.data-page {
  .data-scope { margin: -8px 0 24px; line-height: 1.7; overflow-wrap: anywhere; }
  .data-file-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; }
  .data-file-row > *, .data-mapping-control { min-width: 0; }
  .data-mapping-control { width: 340px; max-width: 60%; align-items: stretch; }
  .data-notice { border-radius: 6px; background: var(--admin-control-bg); overflow-wrap: anywhere; }
  .data-notice--error { border-left: 3px solid var(--q-negative); }
  .data-notice--success { border-left: 3px solid var(--q-positive); }
  .data-table { border-color: var(--admin-border); border-radius: 6px; background: var(--admin-surface); }
  .data-table table { width: 100%; table-layout: fixed; }
  .data-table th, .data-table td { white-space: normal; overflow-wrap: anywhere; padding: 10px 12px; }
  .data-table th:first-child, .data-table td:first-child { width: 44%; }
  .data-table th { color: var(--admin-muted); }
  .data-import-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
  .data-import-actions p { flex: 1 1 320px; margin: 0; }
  .data-import-actions > .q-btn { min-height: 44px; }
}
@media (max-width: 599px) {
  .data-page .data-file-row { grid-template-columns: minmax(0, 1fr); }
  .data-page .data-file-row > .q-btn { justify-self: end; min-height: 44px; }
  .data-page .data-import-actions > .q-btn { margin-left: auto; }
  .data-page .data-table th, .data-page .data-table td { padding: 8px; }
}
</style>
