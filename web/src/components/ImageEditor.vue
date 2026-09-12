<template>
  <q-card class="image-editor-card">
    <q-card-section>
      <div class="text-h6">{{ $t('imageEditor.title') }}</div>
    </q-card-section>

    <q-card-section class="canvas-container">
      <canvas ref="canvas" class="image-editor-canvas" />
    </q-card-section>

    <q-card-section class="row justify-end">
      <q-btn-toggle
        v-model="coverType"
        no-caps
        rounded
        unelevated
        toggle-color="primary"
        text-color="primary"
        :options="coverTypeOptions"
      />
    </q-card-section>

    <q-card-actions class="row items-center">
      <div class="col q-px-md">
        <span>{{ $t('imageEditor.crop') }}</span>
        <q-slider
          v-model="offset"
          :min="0"
          :max="maxOffset"
          :disable="maxOffset < 2"
        />
      </div>
      <div class="col-auto">
        <q-btn color="primary" :label="$t('common.confirm')" :loading="saving" @click="confirmCrop" />
        <q-btn class="app-dialog-cancel" color="negative" :label="$t('common.cancel')" :disable="saving" v-close-popup />
      </div>
    </q-card-actions>
  </q-card>
</template>

<script>
import { t } from '../i18n'
import NotifyMixin from '../mixins/Notification.js'
import { ServerApi } from 'src/utils'

const COVER_RATIOS = {
  main: 4 / 3,
  sam: 1
}

export default {
  name: 'ImageEditor',

  mixins: [NotifyMixin],

  props: {
    src: {
      type: String,
      required: true
    },
    workId: {
      type: Number,
      required: true
    }
  },

  computed: {
    coverTypeOptions () {
      return [
        { label: t('imageEditor.mainCover'), value: 'main' },
        { label: t('imageEditor.thumbnail'), value: 'sam' }
      ]
    },
  },
  data () {
    return {
      saving: false,
      offset: 0,
      maxOffset: 0,
      offsetDirection: 'width',
      destinationRatio: COVER_RATIOS.main,
      destinationHeight: 0,
      destinationWidth: 0,
      image: null,
      context: null,
      resizeObserver: null,
      coverType: 'main',
    }
  },

  watch: {
    offset () {
      this.drawCropPreview()
    },

    coverType () {
      this.destinationRatio = COVER_RATIOS[this.coverType]
      this.offset = 0
      this.updateCropDimensions()
      this.drawCropPreview()
    }
  },

  mounted () {
    const canvas = this.$refs.canvas
    this.context = canvas.getContext('2d')

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = this.src
    image.onload = () => {
      this.image = image
      this.updateCropDimensions()
      this.drawCropPreview()
    }
    image.onerror = () => this.showErrNotif(t('imageEditor.loadFailed'))

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.drawCropPreview())
      this.resizeObserver.observe(canvas)
    } else {
      window.addEventListener('resize', this.drawCropPreview)
    }
  },

  beforeUnmount () {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    } else {
      window.removeEventListener('resize', this.drawCropPreview)
    }
  },

  methods: {
    updateCropDimensions () {
      if (!this.image) return

      const sourceRatio = this.image.width / this.image.height
      if (sourceRatio > this.destinationRatio) {
        this.destinationHeight = this.image.height
        this.destinationWidth = this.image.height * this.destinationRatio
        this.offsetDirection = 'width'
        this.maxOffset = this.image.width - this.destinationWidth
      } else {
        this.destinationWidth = this.image.width
        this.destinationHeight = this.image.width / this.destinationRatio
        this.offsetDirection = 'height'
        this.maxOffset = this.image.height - this.destinationHeight
      }
      this.offset = Math.min(this.offset, this.maxOffset)
    },

    drawCropPreview () {
      const canvas = this.$refs.canvas
      if (!canvas || !this.image || !this.context) return

      const width = Math.max(1, Math.floor(canvas.clientWidth))
      const height = Math.max(1, Math.floor(canvas.clientHeight))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      this.context.clearRect(0, 0, width, height)
      const canvasRatio = width / height
      let targetX = 0
      let targetY = 0
      let targetWidth
      let targetHeight
      if (canvasRatio > this.destinationRatio) {
        targetHeight = height
        targetWidth = this.destinationRatio * targetHeight
        targetX = (width - targetWidth) / 2
      } else {
        targetWidth = width
        targetHeight = targetWidth / this.destinationRatio
        targetY = (height - targetHeight) / 2
      }

      const sourceX = this.offsetDirection === 'width' ? this.offset : 0
      const sourceY = this.offsetDirection === 'height' ? this.offset : 0
      this.context.drawImage(
        this.image,
        sourceX,
        sourceY,
        this.destinationWidth,
        this.destinationHeight,
        targetX,
        targetY,
        targetWidth,
        targetHeight
      )
    },

    async confirmCrop () {
      if (!this.image || this.destinationWidth <= 0 || this.destinationHeight <= 0) {
        this.showErrNotif(t('imageEditor.imageNotReady'))
        return
      }

      const output = document.createElement('canvas')
      if (this.coverType === 'sam') {
        output.width = 100
        output.height = 100
      } else {
        output.width = Math.round(this.destinationWidth)
        output.height = Math.round(this.destinationHeight)
      }

      const sourceX = this.offsetDirection === 'width' ? this.offset : 0
      const sourceY = this.offsetDirection === 'height' ? this.offset : 0
      output.getContext('2d').drawImage(
        this.image,
        sourceX,
        sourceY,
        this.destinationWidth,
        this.destinationHeight,
        0,
        0,
        output.width,
        output.height
      )

      this.saving = true
      try {
        const result = await ServerApi.saveEditImg(
          this.workId,
          output.toDataURL('image/jpeg', 1),
          this.coverType
        )
        if (!result.success) throw new Error(result.message || t('imageEditor.saveUnconfirmed'))
        this.showSuccNotif(t('imageEditor.saved'))
        this.$emit('saved')
      } catch (error) {
        const message = error.response && error.response.data
          ? error.response.data.error || error.response.data.message
          : error.message
        this.showErrNotif(t('imageEditor.saveFailed', { value: message || error }))
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.image-editor-card {
  width: 90vw;
  max-width: 900px;
  height: 80vh;
  max-height: 760px;
}

.canvas-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: calc(100% - 190px);
}

.image-editor-canvas {
  width: 100%;
  height: 100%;
}
</style>
