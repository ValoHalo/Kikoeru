<template>
    <div
      v-if="currentLyric !== '' && !$store.state.AudioPlayer.privacyMode"
      class="lyric-container"
      :class="{ 'lyric-container--player-open': isDesktopPlayerOpen }"
      ref="draggable"
    >
        <div class="fontSizeBar" :class="showSizeBar ? 'showSizeBarStyle' : 'hideSizeBarStyle'">
          <q-slider
            v-model="fontSize"
            :min="0.9"
            :max="2.6"
            :step="0.02"
            color="primary"
            thumb-size="18px"
            @update:model-value="showTempSizeBar"
            @change="onFontSizeChange"
          />
        </div>
        <div
          id="lyricsBar"
          class="text-center text-bold absolute-bottom non-selectable"
          @mousedown="onCursorDown"
          @touchstart="onCursorDown">
          <div class="lyricBackground" :class="$q.dark.isActive ? 'lyricBackgroundDarkMode' : 'lyricBackgroundLightMode'">
            <span id="lyric"
              :style="{'--lyric-font-size': `${fontSize}rem`}">
              {{currentLyric}}
            </span>
          </div>
        </div>
      </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'

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
      return Boolean(!this.hide && this.currentPlayingFile && this.currentPlayingFile.hash)
    },
  },

  data () {
    return {
      beTouched: false,

      // 鼠标按下时的位置
      startX: 0,
      startY: 0,

      fontSize: 0, // rem
      
      showSizeBar: false,
      laterTimer: 0,
    }
  },

  watch: {
    fontSize(newv, oldv) {
      if (oldv > 0) this.showTempSizeBar()
    }
  },

  methods: {
    showTempSizeBar() {
      // return // debug only
      clearTimeout(this.laterTimer);
      this.showSizeBar = true;
      this.laterTimer = setTimeout(() => {
        this.showSizeBar = false;
      }, 3 * 1000); // 延迟关闭滑块
    },

    /**
     * @param {TouchEvent|MouseEvent} ev
     */
    getTouch(ev) {
      return ev.touches ? ev.touches[0] : ev;
    },

    onCursorDown(ev) {
      this.showTempSizeBar()
      ev.preventDefault()
      this.beTouched = true

      // 移动端使用 ev.touches[0]
      const touch = this.getTouch(ev)
      this.startX = touch.clientX - this.$refs.draggable.offsetLeft
      this.startY = touch.clientY - this.$refs.draggable.offsetTop
    },

    onCursorUp(ev) {
      if (!this.beTouched) return
      ev.preventDefault()
      this.beTouched = false
    },

    onCursorMove(ev) {
      if (!this.beTouched || !this.$refs.draggable) { return }
      // ev.preventDefault()
      const touch = this.getTouch(ev)
      const rect = this.$refs.draggable.getBoundingClientRect()
      const maxX = Math.max(8, window.innerWidth - rect.width - 8)
      const maxY = Math.max(60, window.innerHeight - rect.height - 8)

      // 计算 element 新位置坐标并限制在可视区域内
      const eleX = Math.min(maxX, Math.max(8, touch.clientX - this.startX))
      const eleY = Math.min(maxY, Math.max(60, touch.clientY - this.startY))

      this.$refs.draggable.style.left = eleX + 'px'
      this.$refs.draggable.style.bottom = 'auto'
      this.$refs.draggable.style.top = eleY + 'px'
      this.$refs.draggable.style.transform = 'none'
    },

    // 用户松开滑块之后才会触发此方法
    onFontSizeChange(v) {
      console.warn("fontSize change to: ", v)
      localStorage.lyricFontSize = v;
    }
    
  },

  mounted() {
    const saved = parseFloat(localStorage.lyricFontSize || "1.5")
    this.fontSize = Number.isFinite(saved) ? Math.min(2.6, Math.max(0.9, saved)) : 1.5
    // addEventListener('mousemove', onCursorMove(this), false)
    // addEventListener('touchmove', onCursorMove(this), false)
    addEventListener('mousemove', this.onCursorMove)
    addEventListener('touchmove', this.onCursorMove)

    addEventListener('mouseup', this.onCursorUp)
    addEventListener('touchend', this.onCursorUp)
    addEventListener('touchcancel', this.onCursorUp)
  },

  beforeUnmount() {
    removeEventListener('mousemove', this.onCursorMove)
    removeEventListener('touchmove', this.onCursorMove)

    removeEventListener('mouseup', this.onCursorUp)
    removeEventListener('touchend', this.onCursorUp)
    removeEventListener('touchcancel', this.onCursorUp)
  }
  
}
</script>

<style lang="scss" scoped>
  .lyric-container {
    position: fixed;

    /* 水平位置置于中间 */
    left: 50vw;
    width: max-content;
    max-width: min(720px, 90vw);
    transform: translateX(-50%);

    /* 默认停靠在迷你播放条上方，避免压住正文与播放器时间信息；拖动后使用用户选择的位置。 */
    bottom: calc(96px + env(safe-area-inset-bottom, 0px));
    
    display: flex;
    flex-direction: column;
    align-self: center;
    transition: left 0.25s ease;
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
    bottom: -4px;
    padding: 4px 12px;
    border-radius: var(--kikoeru-radius-sm);
    background: var(--kikoeru-surface-elevated);
    border: 1px solid var(--kikoeru-border);
    box-shadow: var(--kikoeru-shadow-float);

    transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s ease;
  }

  .showSizeBarStyle {
    opacity: 1;
    transform: translateX(-50%) translateY(100%);
  }
  .hideSizeBarStyle {
    opacity: 0;
    transform: translateX(-50%) translateY(80%);
    visibility: hidden;
  }
  @media (max-width: 599px) {
    .lyric-container {
      max-width: calc(100vw - 24px);
      bottom: calc(92px + env(safe-area-inset-bottom, 0px));
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
