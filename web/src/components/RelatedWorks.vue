<template>
  <div v-if="relatedWorks.length > 1" class="q-mt-sm q-px-sm">
    <q-list bordered separator>
      <q-item-label header>{{ $t('relatedWorks.title') }}</q-item-label>
      <q-item
        v-for="work in relatedWorks"
        :key="work.id"
        :to="`/work/${work.id}`"
        :disable="work.id === metadata.id"
      >
        <q-item-section>
          <q-item-label>{{ displayCode(work.id) }}</q-item-label>
          <q-item-label caption>{{ work.name }}</q-item-label>
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
