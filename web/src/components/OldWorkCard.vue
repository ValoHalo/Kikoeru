<template>
  <WorkCard :metadata="metadata" :thumbnail-mode="thumbnailMode" full-details />
</template>

<script>
import WorkCard from './WorkCard.vue'

export default {
  name: 'OldWorkCard',
  components: { WorkCard },
  props: {
    metadata: { type: Object, required: true },
    thumbnailMode: { type: Boolean, default: false }
  }
}
</script>
