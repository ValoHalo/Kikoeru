<template>
  <div
    v-if="currentLyric !== '' && !$store.state.AudioPlayer.privacyMode"
    class="lyric-container"
    :class="{
      'lyric-container--player-open': isDesktopPlayerOpen && !customPosition,
      'lyric-container--custom': Boolean(customPosition),
      'lyric-container--dragging': isDragging,
    }"
    :style="containerStyle"
    ref="draggable"
  >
    <div
      class="fontSizeBar"
      :class="[
        showSizeBar ? 'showSizeBarStyle' : 'hideSizeBarStyle',
        sizeBarAbove ? 'fontSizeBar--above' : 'fontSizeBar--below',
      ]"
      @pointerdown.stop
    >
      <q-slider
        v-model="fontSize"
        :min="0.9"
        :max="2.6"
        :step="0.02"
        color="primary"
        thumb-size="16px"
        class="col"
        @change="onFontSizeChange"
      />
      <q-btn
        v-if="customPosition"
        flat
        round
        dense
        size="sm"
        icon="restart_alt"
        class="lyric-reset-btn"
        :aria-label="$t('common.reset')"
        @click="resetPosition"
      >
        <AppTooltip>{{ $t('common.reset') }}</AppTooltip>
      </q-btn>
    </div>
    <div
      id="lyricsBar"
      class="text-center text-bold non-selectable"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @lostpointercapture="onLostPointerCapture"
      @dragstart.prevent
    >
      <div class="lyricBackground" :class="$q.dark.isActive ? 'lyricBackgroundDarkMode' : 'lyricBackgroundLightMode'">
        <span
          id="lyric"
          :style="{ '--lyric-font-size': `${fontSize}rem` }"
        >
          {{ currentLyric }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'

const POSITION_STORAGE_KEY = 'lyricBarPosition'
const VIEWPORT_MARGIN = 8
const DRAG_THRESHOLD_PX = 5

function readSavedPosition () {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Number.isFinite(parsed?.centerX) && Number.isFinite(parsed?.top)) {
      return { centerX: parsed.centerX, top: parsed.top }
    }
  } catch {
    // Ignore storage errors.
  }
  return null
}

function savePosition (pos) {
  try {
    if (pos) {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({
        centerX: Math.round(pos.centerX),
        top: Math.round(pos.top),
      }))
    } else {
      localStorage.removeItem(POSITION_STORAGE_KEY)
    }
  } catch {
    // Ignore storage errors.
  }
}

export default {
  name: 'LyricsBar',

  computed: {
    ...mapState('AudioPlayer', [
      'currentLyric',
      'hide'
    ]),
    ...mapGetters('AudioPlayer', [
      'currentPlayingFile'
    ]),
    isDesktopPlayerOpen () {
      return Boolean(!this.hide && this.currentPlayingFile.hash)
    },
    containerStyle () {
      if (!this.customPosition) return null
      return {
        left: `${this.customPosition.centerX}px`,
        top: `${this.customPosition.top}px`,
        bottom: 'auto',
      }
    },
    sizeBarAbove () {
      if (!this.customPosition) return false
      const height = this.$refs.draggable ? this.$refs.draggable.offsetHeight : 56
      const spaceBelow = window.innerHeight - (this.customPosition.top + height)
      const isMiniPlayerVisible = Boolean(this.hide && this.currentPlayingFile.hash)
      const requiredSpace = isMiniPlayerVisible ? 128 : 56
      return spaceBelow < requiredSpace
    },
  },

  data () {
    return {
      isPointerDown: false,
      isDragging: false,
      activePointerId: null,
      pointerDownX: 0,
      pointerDownY: 0,
      dragOffsetX: 0,
      dragOffsetY: 0,
      customPosition: null,

      fontSize: 1.5, // rem

      showSizeBar: false,
    }
  },

  watch: {
    fontSize () {
      this.$nextTick(() => this.clampCustomPosition())
    },
    currentLyric () {
      this.$nextTick(() => this.clampCustomPosition())
    },
  },

  methods: {
    clampCoordinates (centerX, top) {
      const el = this.$refs.draggable
      if (!el) return { centerX, top }
      const rect = el.getBoundingClientRect()
      const halfWidth = rect.width / 2
      const minCenterX = Math.min(window.innerWidth / 2, halfWidth + VIEWPORT_MARGIN)
      const maxCenterX = Math.max(window.innerWidth / 2, window.innerWidth - halfWidth - VIEWPORT_MARGIN)
      const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN)

      return {
        centerX: Math.min(maxCenterX, Math.max(minCenterX, centerX)),
        top: Math.min(maxTop, Math.max(VIEWPORT_MARGIN, top)),
      }
    },

    clampCustomPosition () {
      if (!this.customPosition || !this.$refs.draggable) return
      const clamped = this.clampCoordinates(this.customPosition.centerX, this.customPosition.top)
      if (clamped.centerX !== this.customPosition.centerX || clamped.top !== this.customPosition.top) {
        this.customPosition = clamped
      }
    },

    onPointerDown (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return
      const el = this.$refs.draggable
      if (!el) return

      ev.preventDefault()

      const rect = el.getBoundingClientRect()
      const currentCenterX = rect.left + rect.width / 2
      const currentTop = rect.top

      this.pointerDownX = ev.clientX
      this.pointerDownY = ev.clientY
      this.dragOffsetX = ev.clientX - currentCenterX
      this.dragOffsetY = ev.clientY - currentTop
      this.activePointerId = ev.pointerId
      this.isPointerDown = true
      this.isDragging = false

      if (typeof ev.currentTarget.setPointerCapture === 'function') {
        try {
          ev.currentTarget.setPointerCapture(ev.pointerId)
        } catch {
          // Ignore capture failure on synthetic events.
        }
      }
    },

    onPointerMove (ev) {
      if (!this.isPointerDown || ev.pointerId !== this.activePointerId || !this.$refs.draggable) return
      ev.preventDefault()

      if (!this.isDragging) {
        const moved = Math.hypot(ev.clientX - this.pointerDownX, ev.clientY - this.pointerDownY)
        if (moved < DRAG_THRESHOLD_PX) return
        this.isDragging = true
      }

      const nextCenterX = ev.clientX - this.dragOffsetX
      const nextTop = ev.clientY - this.dragOffsetY
      this.customPosition = this.clampCoordinates(nextCenterX, nextTop)
    },

    finishDrag (target, cancelled = false) {
      if (!this.isPointerDown) return
      const wasDragging = this.isDragging
      if (target && this.activePointerId !== null && typeof target.hasPointerCapture === 'function' && target.hasPointerCapture(this.activePointerId)) {
        try {
          target.releasePointerCapture(this.activePointerId)
        } catch {
          // Ignore release failure.
        }
      }
      this.isPointerDown = false
      this.isDragging = false
      this.activePointerId = null

      if (wasDragging) {
        if (this.customPosition) savePosition(this.customPosition)
      } else if (!cancelled) {
        this.showSizeBar = !this.showSizeBar
      }
    },

    onPointerUp (ev) {
      if (ev.pointerId !== this.activePointerId) return
      this.finishDrag(ev.currentTarget, ev.type === 'pointercancel')
    },

    onLostPointerCapture () {
      this.finishDrag(null, true)
    },

    onDocumentPointerDown (ev) {
      if (!this.showSizeBar || !this.$refs.draggable) return
      if (!this.$refs.draggable.contains(ev.target)) {
        this.showSizeBar = false
      }
    },

    resetPosition () {
      this.customPosition = null
      savePosition(null)
    },

    onWindowResize () {
      this.clampCustomPosition()
    },

    // 用户松开滑块之后才会触发此方法
    onFontSizeChange (v) {
      localStorage.lyricFontSize = v
    },
  },

  mounted () {
    const saved = parseFloat(localStorage.lyricFontSize || '1.5')
    this.fontSize = Number.isFinite(saved) ? Math.min(2.6, Math.max(0.9, saved)) : 1.5
    this.customPosition = readSavedPosition()
    this.$nextTick(() => this.clampCustomPosition())
    window.addEventListener('resize', this.onWindowResize)
    document.addEventListener('pointerdown', this.onDocumentPointerDown)
  },

  beforeUnmount () {
    window.removeEventListener('resize', this.onWindowResize)
    document.removeEventListener('pointerdown', this.onDocumentPointerDown)
  },
}
</script>

<style lang="scss" scoped>
  .lyric-container {
    position: fixed;

    /* 水平位置置于中间，拖动后也保持中心锚点，避免不同长度歌词切换时跳动 */
    left: 50vw;
    width: max-content;
    max-width: min(720px, 90vw);
    transform: translateX(-50%);

    /* 默认停靠在迷你播放条上方，留出下方字号条空间避免遮挡迷你播放器；拖动后使用用户选择的位置。 */
    bottom: calc(132px + env(safe-area-inset-bottom, 0px));

    display: flex;
    flex-direction: column;
    align-self: center;
    transition: left 0.25s ease;
  }
  .lyric-container--custom,
  .lyric-container--dragging {
    transition: none !important;
  }
  @media (min-width: 760px) {
    .lyric-container--player-open {
      left: calc(56px + (100vw - 56px - 360px) / 2);
      max-width: min(640px, calc(100vw - 440px));
    }
  }
  #lyricsBar {
    position: relative;
    min-width: 1vw;
    max-width: 100%;
    cursor: grab;
    touch-action: none;
  }
  #lyricsBar:active {
    cursor: grabbing;
  }
  #lyric {
    font-size: var(--lyric-font-size, 1.35rem);
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .lyricBackground {
    border-radius: var(--kikoeru-radius-md);
    padding: 8px 16px;
    transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    box-shadow: var(--kikoeru-shadow-float);
  }
  .lyricBackgroundDarkMode {
    background-color: rgba(24, 24, 28, 0.88);
    color: #f4f5f7;
    border: 1px solid rgba(255, 255, 255, 0.14);
  }
  .lyricBackgroundLightMode {
    background-color: rgba(255, 255, 255, 0.92);
    color: #1f2329;
    border: 1px solid rgba(0, 0, 0, 0.12);
  }
  .fontSizeBar {
    width: 260px;
    max-width: 80vw;
    position: absolute;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    border-radius: var(--kikoeru-radius-sm);
    background: var(--kikoeru-surface-elevated);
    border: 1px solid var(--kikoeru-border);
    box-shadow: var(--kikoeru-shadow-float);

    transition: opacity 0.22s ease, transform 0.22s ease, visibility 0.22s ease;
  }
  .fontSizeBar--below {
    bottom: -6px;
  }
  .fontSizeBar--above {
    top: -6px;
  }
  .lyric-reset-btn {
    color: var(--kikoeru-muted);
    flex-shrink: 0;
  }
  .lyric-reset-btn:hover {
    color: var(--kikoeru-text);
  }

  .fontSizeBar--below.showSizeBarStyle {
    opacity: 1;
    transform: translateX(-50%) translateY(100%);
  }
  .fontSizeBar--below.hideSizeBarStyle {
    opacity: 0;
    transform: translateX(-50%) translateY(80%);
    visibility: hidden;
    pointer-events: none;
  }
  .fontSizeBar--above.showSizeBarStyle {
    opacity: 1;
    transform: translateX(-50%) translateY(-100%);
  }
  .fontSizeBar--above.hideSizeBarStyle {
    opacity: 0;
    transform: translateX(-50%) translateY(-80%);
    visibility: hidden;
    pointer-events: none;
  }
  @media (max-width: 599px) {
    .lyric-container {
      max-width: calc(100vw - 24px);
      bottom: calc(126px + env(safe-area-inset-bottom, 0px));
    }
    .lyricBackground {
      padding: 6px 12px;
    }
    #lyric {
      font-size: clamp(0.875rem, calc(var(--lyric-font-size, 1.5rem) * 0.8), 1.75rem);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .lyric-container { transition: none; }
  }
</style>
