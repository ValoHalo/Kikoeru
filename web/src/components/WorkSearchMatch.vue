<template>
  <div v-if="match" class="work-search-match">
    <q-icon :name="match.type === 'directory' ? 'folder_open' : 'audio_file'" size="16px" aria-hidden="true" />
    <span class="ellipsis-2-lines">{{ label }}<AppTooltip>{{ label }}</AppTooltip></span>
  </div>
</template>

<script>
export default {
  name: 'WorkSearchMatch',
  props: {
    match: { type: Object, default: null }
  },
  computed: {
    label () {
      return this.match ? this.$t(this.match.type === 'directory' ? 'works.matchedDirectory' : 'works.matchedTrack', { name: this.match.name }) : ''
    }
  }
}
</script>

<style scoped>
.work-search-match { display: flex; align-items: flex-start; gap: 6px; min-width: 0; color: var(--kikoeru-accent-text); font-size: 12px; line-height: 18px; }
.work-search-match .q-icon { flex-shrink: 0; margin-top: 1px; }
.work-search-match span { min-width: 0; overflow-wrap: anywhere; }
</style>
