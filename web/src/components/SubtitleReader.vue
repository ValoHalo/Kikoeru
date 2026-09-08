<template>
  <q-page class="subtitle-reader">
    <q-btn flat dense no-caps icon="arrow_back" :label="$t('common.back')" color="primary" @click="$emit('back')" />
    <div class="reader-document">
      <header class="reader-header">
        <h1>{{ $t('subtitleReader.title') }}</h1>
        <p class="reader-file">{{ file.title }}</p>
        <div class="reader-tools">
          <q-input v-model="query" outlined dense clearable :debounce="150" :placeholder="$t('subtitleReader.search')" :aria-label="$t('subtitleReader.search')" class="reader-search">
            <template #prepend><q-icon name="search" size="20px" /></template>
          </q-input>
          <div class="reader-size">
            <q-btn flat round icon="text_decrease" :disable="fontSize <= 14" :aria-label="$t('subtitleReader.smaller')" @click="fontSize -= 2"><q-tooltip>{{ $t('subtitleReader.smaller') }}</q-tooltip></q-btn>
            <q-btn flat round icon="text_increase" :disable="fontSize >= 26" :aria-label="$t('subtitleReader.larger')" @click="fontSize += 2"><q-tooltip>{{ $t('subtitleReader.larger') }}</q-tooltip></q-btn>
          </div>
        </div>
        <div class="reader-summary">
          <span class="reader-count" role="status">{{ loading || error ? '' : $t('subtitleReader.lineCount', { count: filteredLines.length, total: lines.length }) }}</span>
          <nav v-if="files.length > 1" class="reader-navigation" :aria-label="$t('subtitleReader.files')">
            <q-btn flat round dense icon="chevron_left" :disable="fileIndex <= 0" :aria-label="$t('workTree.previous')" @click="$emit('select', files[fileIndex - 1])"><q-tooltip>{{ $t('workTree.previous') }}</q-tooltip></q-btn>
            <span class="reader-position">{{ fileIndex + 1 }} / {{ files.length }}</span>
            <q-btn flat round dense icon="chevron_right" :disable="fileIndex < 0 || fileIndex >= files.length - 1" :aria-label="$t('workTree.next')" @click="$emit('select', files[fileIndex + 1])"><q-tooltip>{{ $t('workTree.next') }}</q-tooltip></q-btn>
          </nav>
        </div>
        <q-separator />
      </header>

      <section class="reader-content" :aria-label="$t('subtitleReader.title')" :aria-busy="loading" :style="{ '--reader-font-size': fontSize + 'px' }">
        <div v-if="loading" class="reader-state" role="status"><q-spinner size="36px" color="primary" /><p>{{ $t('subtitleReader.loading') }}</p></div>
        <div v-else-if="error" class="reader-state" role="alert"><q-icon name="cloud_off" size="40px" /><p>{{ $t('subtitleReader.failed') }}</p><q-btn outline color="primary" icon="refresh" :label="$t('subtitleReader.retry')" @click="load" /></div>
        <div v-else-if="!filteredLines.length" class="reader-state" role="status"><q-icon :name="searchTerm ? 'search_off' : 'subtitles_off'" size="40px" /><p>{{ $t(searchTerm ? 'subtitleReader.noMatches' : 'subtitleReader.empty') }}</p></div>
        <ol v-else class="reader-lines">
          <li v-for="line in filteredLines" :key="line.id" class="reader-line">
            <span class="reader-time">{{ formatSeconds(line.time / 1000) }}</span>
            <p><template v-for="(part, index) in highlight(line.text)" :key="index"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></p>
          </li>
        </ol>
      </section>
    </div>
  </q-page>
</template>

<script>
import { formatSeconds } from '../utils'

export default {
  name: 'SubtitleReader',
  props: {
    file: { type: Object, required: true },
    files: { type: Array, required: true }
  },
  emits: ['back', 'select'],
  data () {
    return { lines: [], query: '', fontSize: 18, loading: false, error: false, requestId: 0, controller: null }
  },
  computed: {
    fileIndex () { return this.files.findIndex(file => file.hash === this.file.hash) },
    searchTerm () { return (this.query || '').trim().toLocaleLowerCase() },
    filteredLines () { return this.lines.filter(line => !this.searchTerm || line.text.toLocaleLowerCase().includes(this.searchTerm)) }
  },
  watch: {
    'file.hash': { immediate: true, handler () { this.query = ''; this.load() } }
  },
  beforeUnmount () { this.requestId++; this.controller?.abort() },
  methods: {
    formatSeconds,
    highlight (text) {
      if (!this.searchTerm) return [{ text, match: false }]
      const parts = []
      const lower = text.toLocaleLowerCase()
      let start = 0
      let found
      while ((found = lower.indexOf(this.searchTerm, start)) !== -1) {
        parts.push({ text: text.slice(start, found), match: false }, { text: text.slice(found, found + this.searchTerm.length), match: true })
        start = found + this.searchTerm.length
      }
      parts.push({ text: text.slice(start), match: false })
      return parts
    },
    async load () {
      const requestId = ++this.requestId
      this.controller?.abort()
      this.controller = new AbortController()
      this.loading = true
      this.error = false
      this.lines = []
      try {
        const { data } = await this.$axios.get(`/api/media/fetch-lrc/${this.file.hash}`, { signal: this.controller.signal })
        if (requestId !== this.requestId) return
        if (!Array.isArray(data.lrc)) throw new Error('Invalid subtitle response')
        this.lines = data.lrc.filter(line => Number.isFinite(line.time) && typeof line.text === 'string' && line.text.trim()).map((line, id) => ({ ...line, id }))
      } catch (error) {
        if (requestId === this.requestId) this.error = true
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.subtitle-reader { padding: 8px 24px 32px; color: inherit; }
.reader-document { width: 100%; max-width: 960px; margin: 24px auto 0; }
.reader-header h1 { margin: 0; font-size: 26px; font-weight: 600; line-height: 1.4; letter-spacing: 0; }
.reader-file { margin: 10px 0 0; font-size: 14px; line-height: 1.7; opacity: .7; overflow-wrap: anywhere; }
.reader-tools { display: flex; align-items: center; gap: 16px; margin-top: 24px; }
.reader-search { flex: 1; min-width: 0; }
.reader-size { display: flex; flex-shrink: 0; }
.reader-summary { min-height: 52px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.reader-count, .reader-position { font-size: 12px; opacity: .7; font-variant-numeric: tabular-nums; }
.reader-navigation { display: flex; align-items: center; gap: 8px; }
.reader-content { padding-top: 12px; }
.reader-lines { list-style: none; padding: 0; margin: 0; }
.reader-line { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 20px; padding: 20px 8px; border-bottom: 1px solid rgba(0, 0, 0, .08); }
.reader-line:hover { background: rgba(0, 0, 0, .025); }
.reader-time { font-size: 13px; font-variant-numeric: tabular-nums; opacity: .6; padding-top: 5px; line-height: 1.85; }
.reader-line p { margin: 0; font-size: var(--reader-font-size); line-height: 1.85; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
.reader-line mark { background: color-mix(in srgb, var(--q-primary) 22%, transparent); color: inherit; border-radius: 3px; }
.reader-state { min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 0; text-align: center; }
.reader-state p { margin: 16px 0; opacity: .75; }
.body--dark .reader-line { border-color: rgba(255, 255, 255, .1); }
.body--dark .reader-line:hover { background: rgba(255, 255, 255, .035); }
@media (max-width: 599px) {
  .subtitle-reader { padding: 8px 16px 24px; }
  .reader-document { margin-top: 18px; }
  .reader-header h1 { font-size: 22px; }
  .reader-tools { gap: 4px; margin-top: 20px; }
  .reader-line { grid-template-columns: 60px minmax(0, 1fr); gap: 12px; padding: 18px 0; }
}
</style>
