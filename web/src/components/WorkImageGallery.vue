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
        :aria-label="item.title"
        @click="$emit('preview', item)"
      >
        <img
          v-if="!failed[item.hash]"
          :src="item.mediaStreamUrl || `/api/media/stream/${item.hash}`"
          :alt="item.title"
          loading="lazy"
          decoding="async"
          @load="onLoad(item, $event)"
          @error="failed[item.hash] = true"
        />
        <span v-else class="work-image-fallback">
          <q-icon name="broken_image" size="32px" />
          <span>{{ item.title }}</span>
        </span>
        <q-menu touch-position context-menu auto-close>
          <q-list separator>
            <q-item v-if="canEdit" clickable @click="$emit('edit', item)">
              <q-item-section>{{ $t('workTree.editCover') }}</q-item-section>
            </q-item>
            <q-item clickable @click="$emit('download', item)">
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
  gap: 2px;
}

.work-image-row {
  display: flex;
  align-items: flex-start;
  gap: 2px;
}

.work-image-tile {
  position: relative;
  display: block;
  flex-basis: 0;
  min-width: 0;
  padding: 0;
  border: 0;
  background: rgba(127, 127, 127, 0.12);
  color: inherit;
  cursor: pointer;
}

.work-image-tile:focus-visible {
  outline: 3px solid var(--q-primary);
  outline-offset: -3px;
  z-index: 1;
}

.work-image-tile img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
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
}
</style>
