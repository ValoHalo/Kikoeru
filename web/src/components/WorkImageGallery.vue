<template>
  <div ref="gallery" class="work-image-gallery">
    <div
      v-for="row in rows"
      :key="row[0].hash"
      class="work-image-row"
      :style="{ width: `${row.length / columns * 100}%` }"
    >
      <button
        v-for="item in row"
        :key="item.hash"
        type="button"
        class="work-image-tile"
        :style="{ flexGrow: ratio(item) / totalRatio(row), aspectRatio: ratio(item) }"
        :aria-label="$privateText(item.title)"
        @click="$emit('preview', item)"
      >
        <img
          v-if="!failed[item.hash]"
          :src="$privateImage(item.mediaStreamUrl || `/api/media/stream/${item.hash}`)"
          :alt="$privateText(item.title)"
          loading="lazy"
          decoding="async"
          @load="onLoad(item, $event)"
          @error="failed[item.hash] = true"
        />
        <span v-else class="work-image-fallback">
          <q-icon name="broken_image" size="32px" />
          <span>{{ $privateText(item.title) }}</span>
        </span>
        <span v-if="!failed[item.hash]" class="work-image-overlay" aria-hidden="true">
          <span class="work-image-caption">{{ $privateText(item.title) }}</span>
        </span>
        <q-menu touch-position context-menu auto-close>
          <q-list dense style="min-width: 150px">
            <q-item v-if="canEdit" clickable @click="$emit('edit', item)">
              <q-item-section avatar><q-icon name="edit" /></q-item-section>
              <q-item-section>{{ $t('workTree.editCover') }}</q-item-section>
            </q-item>
            <q-item clickable @click="$emit('download', item)">
              <q-item-section avatar><q-icon name="download" /></q-item-section>
              <q-item-section>{{ $t('workTree.download') }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'WorkImageGallery',
  emits: ['preview', 'edit', 'download'],
  props: {
    images: { type: Array, required: true },
    canEdit: { type: Boolean, default: false }
  },
  data () {
    return { columns: 2, ratios: {}, failed: {} }
  },
  computed: {
    rows () {
      const rows = []
      for (let index = 0; index < this.images.length; index += this.columns) {
        rows.push(this.images.slice(index, index + this.columns))
      }
      return rows
    }
  },
  mounted () {
    this.resizeObserver = new ResizeObserver(([entry]) => {
      this.columns = entry.contentRect.width < 600 ? 2 : entry.contentRect.width < 1000 ? 3 : 4
    })
    this.resizeObserver.observe(this.$refs.gallery)
  },
  beforeUnmount () {
    this.resizeObserver.disconnect()
  },
  methods: {
    ratio (item) {
      return this.ratios[item.hash] || 1
    },
    totalRatio (row) {
      return row.reduce((total, item) => total + this.ratio(item), 0)
    },
    onLoad (item, event) {
      const { naturalWidth, naturalHeight } = event.target
      if (naturalWidth && naturalHeight) this.ratios[item.hash] = naturalWidth / naturalHeight
    }
  }
}
</script>

<style scoped>
.work-image-gallery {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.work-image-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.work-image-tile {
  position: relative;
  display: block;
  flex-basis: 0;
  min-width: 0;
  padding: 0;
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-sm);
  overflow: hidden;
  background: var(--kikoeru-inset);
  color: inherit;
  cursor: pointer;
}

.work-image-tile:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 1px;
  z-index: 1;
}

.work-image-tile img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform .22s ease;
}

.work-image-tile:hover img {
  transform: scale(1.03);
}

.work-image-overlay {
  position: absolute;
  inset: auto 0 0;
  padding: 20px 8px 6px;
  background: linear-gradient(to top, rgba(16, 18, 22, 0.78), transparent);
  opacity: 0;
  transition: opacity .18s ease;
  pointer-events: none;
}

.work-image-tile:hover .work-image-overlay,
.work-image-tile:focus-visible .work-image-overlay {
  opacity: 1;
}

.work-image-caption {
  display: block;
  color: #f4f5f7;
  font-size: 11.5px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.work-image-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  overflow: hidden;
  overflow-wrap: anywhere;
  color: var(--kikoeru-muted);
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .work-image-tile img,
  .work-image-overlay {
    transition: none;
  }

  .work-image-tile:hover img {
    transform: none;
  }
}
</style>
