<template>
  <section v-if="relatedWorks.length > 1" class="related-works">
    <div class="related-works-header">
      <q-icon name="link" size="17px" class="related-works-icon" />
      <span class="related-works-title">{{ $t('relatedWorks.title') }}</span>
      <span class="related-works-count">{{ relatedWorks.length }}</span>
    </div>

    <div class="related-works-grid">
      <router-link
        v-for="work in relatedWorks"
        :key="work.id"
        :to="`/work/${work.id}`"
        class="related-work-card"
        :class="{ 'related-work-card--active': work.id === metadata.id }"
        :aria-current="work.id === metadata.id ? 'page' : undefined"
      >
        <div class="related-work-top">
          <span class="related-works-code">{{ displayCode(work.id) }}</span>
          <span v-if="work.id === metadata.id" class="related-work-current">
            {{ $t('workDetails.currentWork') }}
          </span>
        </div>
        <div class="related-work-name">{{ $privateText(work.name) }}</div>
      </router-link>
    </div>
  </section>
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
  padding: 14px 16px 16px;
  background: var(--kikoeru-surface);
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  box-shadow: var(--kikoeru-shadow-card);
}

.related-works-header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 12px;
}

.related-works-icon {
  color: var(--kikoeru-muted);
}

.related-works-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--kikoeru-text);
}

.related-works-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-muted);
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.related-works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.related-work-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border-radius: var(--kikoeru-radius-sm);
  border: 1px solid var(--kikoeru-border);
  background: var(--kikoeru-inset);
  color: var(--kikoeru-text);
  transition: border-color .15s ease, background-color .15s ease, transform .15s ease;
}

.related-work-card:hover {
  border-color: rgba(var(--kikoeru-accent-rgb), 0.45);
  background: rgba(var(--kikoeru-accent-rgb), 0.06);
  transform: translateY(-1px);
}

.related-work-card--active {
  border-color: rgba(var(--kikoeru-accent-rgb), 0.55);
  background: var(--kikoeru-active-bg);
}

.related-work-card--active:hover {
  transform: none;
}

.related-work-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.related-works-code {
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--kikoeru-muted);
}

.related-work-card--active .related-works-code {
  color: var(--kikoeru-accent-text);
}

.related-work-current {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(var(--kikoeru-accent-rgb), 0.16);
  color: var(--kikoeru-accent-text);
  font-size: 11px;
  font-weight: 600;
}

.related-work-name {
  font-size: 13px;
  line-height: 1.45;
  color: var(--kikoeru-text);
  overflow-wrap: anywhere;
}

@media (max-width: 699px) {
  .related-works {
    padding: 12px 14px 14px;
  }

  .related-works-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .related-work-card {
    transition: none;
  }

  .related-work-card:hover {
    transform: none;
  }
}
</style>
