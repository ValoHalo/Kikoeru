<template>
  <q-item clickable :to="`/work/${metadata.id}`" class="work-list-item">
    <q-item-section avatar class="work-list-item__avatar">
      <q-img :key="samCoverUrl" transition="fade" :src="samCoverUrl" ratio="1" class="work-list-item__cover" />
    </q-item-section>

    <q-item-section class="work-list-item__main">
      <q-item-label lines="2" class="work-list-item__title">
        {{ $privateText(metadata.title) }}
      </q-item-label>

      <WorkSearchMatch v-if="metadata.searchMatch" :match="metadata.searchMatch" class="q-mt-xs" />

      <div class="work-list-item__meta">
        <router-link :to="`/works?circleId=${metadata.circle.id}`" class="work-list-item__circle" @click.stop>
          {{ $privateText(metadata.circle.name) }}
        </router-link>

        <span v-if="metadata.release" class="work-list-item__release">{{ metadata.release }}</span>

        <span v-if="metadata.rate_average_2dp" class="work-list-item__rating">
          <q-icon name="star" size="14px" />
          {{ metadata.rate_average_2dp }}
        </span>

        <router-link
          v-for="(va, index) in metadata.vas"
          :to="`/works?vaId=${va.id}`"
          :key="index"
          class="work-list-item__va"
          @click.stop
        >
          <q-icon name="mic_none" size="14px" />
          <span>{{ $privateText(va.name) }}</span>
        </router-link>
      </div>

      <div v-if="showLabel && $q.screen.width > 700 && visibleTags.length" class="work-list-item__tags">
        <router-link
          v-for="(tag, index) in visibleTags"
          :to="`/works?tagId=${tag.id}`"
          :key="index"
          class="work-list-item__tag"
          @click.stop
        >
          {{ $privateText(tag.name) }}
        </router-link>
      </div>
    </q-item-section>
  </q-item>
</template>

<script>
import WorkSearchMatch from './WorkSearchMatch.vue'

export default {
  name: 'WorkListItem',
  components: { WorkSearchMatch },

  props: {
    metadata: {
      type: Object,
      required: true
    },
    showLabel: {
      type: Boolean,
      default: true
    },
  },

  computed: {
    samCoverUrl () {
      return this.$store.getters['AudioPlayer/coverUrl'](this.metadata.id, 'sam')
    },
    visibleTags () {
      return (this.metadata.tags || []).filter(tag => tag && tag.id != null && tag.name)
    },
  }
}
</script>

<style scoped>
.work-list-item {
  align-items: flex-start;
  padding: 12px 16px;
  gap: 14px;
  color: var(--kikoeru-text);
  transition: background-color .15s ease;
}

.work-list-item:hover {
  background: var(--kikoeru-inset);
}

.work-list-item__avatar {
  min-width: 68px;
  padding-right: 0;
}

.work-list-item__cover {
  width: 68px;
  height: 68px;
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
}

.work-list-item__main {
  min-width: 0;
  gap: 6px;
}

.work-list-item__title {
  color: var(--kikoeru-text);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.work-list-item:hover .work-list-item__title {
  color: var(--kikoeru-accent-text);
}

.work-list-item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--kikoeru-muted);
}

.work-list-item__circle {
  color: var(--kikoeru-muted);
}

.work-list-item__circle:hover,
.work-list-item__va:hover {
  color: var(--kikoeru-accent-text);
  text-decoration: underline;
}

.work-list-item__release {
  font-variant-numeric: tabular-nums;
}

.work-list-item__rating {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--kikoeru-star);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.work-list-item__va {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--kikoeru-accent-text);
}

.work-list-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.work-list-item__tag {
  padding: 1px 7px;
  border: 1px solid var(--kikoeru-border);
  border-radius: 4px;
  background: var(--kikoeru-inset);
  color: var(--kikoeru-muted);
  font-size: 12px;
  line-height: 18px;
}

.work-list-item__tag:hover {
  color: var(--kikoeru-accent-text);
  border-color: currentColor;
}
</style>
