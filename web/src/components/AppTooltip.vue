<template>
  <q-tooltip ref="tooltip" v-bind="$attrs" no-parent-event>
    <slot />
  </q-tooltip>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { bindTooltipTrigger } from '../utils/tooltipTrigger.mjs'

defineOptions({ inheritAttrs: false })

const tooltip = ref(null)
let dispose

onMounted(() => {
  let anchor = tooltip.value.$el.parentElement
  while (anchor?.classList.contains('q-anchor--skip')) anchor = anchor.parentElement
  if (anchor) {
    dispose = bindTooltipTrigger(anchor, {
      show: event => tooltip.value.show(event),
      hide: () => tooltip.value.hide()
    })
  }
})

onBeforeUnmount(() => dispose?.())
</script>
