<template>
  <div v-if="relatedWorks.length > 1" class="related-works">
    <q-list bordered separator class="related-works-list">
      <q-item-label header class="related-works-header">{{ $t('relatedWorks.title') }}</q-item-label>
      <q-item
        v-for="work in relatedWorks"
        :key="work.id"
        clickable
        :to="`/work/${work.id}`"
        :active="work.id === metadata.id"
        active-class="kikoeru-active-item"
      >
        <q-item-section>
          <q-item-label class="related-works-code">{{ displayCode(work.id) }}</q-item-label>
          <q-item-label caption>{{ $privateText(work.name) }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script>
import { idNumberToCode } from 'src/utils'

export default {
  name: 'RelatedWorks',

  props: {
    metadata: {
      type: Object,
      required: true
    }
  },

  computed: {
    relatedWorks () {
      return Array.isArray(this.metadata.relatedWorks) ? this.metadata.relatedWorks : []
    }
  },

  methods: {
    displayCode (id) {
      try {
        return idNumberToCode(id)
      } catch (_) {
        return String(id)
      }
    }
  }
}
</script>

<style scoped>
.related-works {
  margin-top: 16px;
}

.related-works-list {
  background: var(--kikoeru-surface);
  border-color: var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  overflow: hidden;
}

.related-works-header {
  font-size: 13px;
  font-weight: 500;
  color: var(--kikoeru-muted);
  padding: 10px 16px;
}

.related-works-code {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
</style>
