<template>
  <div class="work-selection" :class="{ 'work-selection--enabled': enabled, 'work-selection--checked': selected, 'work-selection--list': list }" @click.capture="select">
    <q-checkbox v-if="enabled" class="work-selection-check" :model-value="selected" :aria-label="$t('batchWorks.selectNamed', { name: label })" @update:model-value="$emit('select', { shiftKey: false })" />
    <div class="work-selection-content" :inert="enabled ? '' : null"><slot /></div>
  </div>
</template>
<script>
export default {
  props: { enabled: Boolean, selected: Boolean, list: Boolean, label: { type: String, default: '' } },
  emits: ['select'],
  methods: {
    select (event) {
      if (!this.enabled) return
      event.preventDefault()
      event.stopPropagation()
      this.$emit('select', { shiftKey: event.shiftKey })
    }
  }
}
</script>
<style scoped>
.work-selection { position: relative; height: 100%; min-width: 0; }
.work-selection-content { height: 100%; }
.work-selection--checked { outline: 2px solid var(--q-primary); outline-offset: -2px; border-radius: 4px; }
.work-selection-check { position: absolute; left: 6px; top: 6px; z-index: 2; border-radius: 4px; background: white; }
.body--dark .work-selection-check { background: #242424; }
.work-selection--list.work-selection--enabled { padding-left: 44px; }
.work-selection--list .work-selection-check { top: 50%; left: 2px; transform: translateY(-50%); }
.work-selection--enabled:not(.work-selection--list) :deep(.q-img .absolute-top-left) { left: 48px; }
</style>
