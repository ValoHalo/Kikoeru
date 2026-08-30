<template>
  <q-page class="preferences-page q-pa-md">
    <header class="preferences-heading">
      <div class="text-h5">设置</div>
      <div class="text-caption text-grey-7">这些选项只影响当前浏览器，不会修改服务器配置。</div>
    </header>

    <section class="preferences-section" aria-labelledby="appearance-settings-title">
      <div class="preferences-section__heading">
        <q-icon name="palette" size="22px" />
        <div>
          <div id="appearance-settings-title" class="text-subtitle1 text-weight-medium">一般设置</div>
          <div class="text-caption text-grey-7">控制界面主题与作品库在这台设备上的显示方式。</div>
        </div>
      </div>
      <q-list bordered separator class="preferences-list">
        <q-item class="preference-row">
          <q-item-section>
            <q-item-label>颜色模式</q-item-label>
            <q-item-label caption>可固定为浅色或深色，也可跟随系统。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control preference-control--wide">
            <q-btn-toggle v-model="colorScheme" dense unelevated no-caps toggle-color="primary" :options="colorSchemeOptions" />
          </q-item-section>
        </q-item>

        <q-item class="preference-row accent-color-row">
          <q-item-section>
            <q-item-label>强调色</q-item-label>
            <q-item-label caption>统一用于按钮、选择状态与界面高亮。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control preference-control--color">
            <div class="accent-color-control">
              <q-btn
                class="accent-color-picker-button"
                unelevated
                icon="colorize"
                aria-label="选择强调色"
                :style="{ backgroundColor: appliedAccentColor }"
              >
                <q-tooltip>选择颜色</q-tooltip>
                <q-popup-proxy transition-show="scale" transition-hide="scale">
                  <q-color
                    :model-value="appliedAccentColor"
                    format-model="hex"
                    default-view="spectrum"
                    no-header
                    no-footer
                    :dark="$q.dark.isActive"
                    @update:model-value="setAccentColor"
                  />
                </q-popup-proxy>
              </q-btn>
              <q-input
                v-model="accentColorInput"
                dense
                outlined
                hide-bottom-space
                maxlength="7"
                input-class="accent-color-input"
                aria-label="强调色 RGB HEX"
                :error="accentColorInvalid"
                @update:model-value="previewAccentColor"
                @blur="normalizeAccentColorInput"
                @keyup.enter="$event.target.blur()"
              >
                <template v-slot:prepend>
                  <span class="accent-color-input-swatch" :style="{ backgroundColor: appliedAccentColor }" aria-hidden="true" />
                </template>
              </q-input>
              <q-btn
                class="accent-color-reset-button"
                flat
                dense
                icon="restart_alt"
                aria-label="恢复默认强调色"
                :disable="appliedAccentColor === defaultAccentColor"
                @click="resetAccentColor"
              >
                <q-tooltip>恢复默认</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>

        <q-item class="preference-row">
          <q-item-section>
            <q-item-label>作品加载方式</q-item-label>
            <q-item-label caption>瀑布流连续加载；分页便于记住当前位置。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control">
            <q-btn-toggle v-model="workListMode" dense unelevated no-caps toggle-color="primary" :options="workListModeOptions" />
          </q-item-section>
        </q-item>

        <q-item tag="label" class="preference-row">
          <q-item-section>
            <q-item-label>显示最近播放</q-item-label>
            <q-item-label caption>在媒体库首页顶部显示最近播放的作品。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control"><q-toggle v-model="enableShowRecent" color="primary" /></q-item-section>
        </q-item>

        <q-item tag="label" class="preference-row">
          <q-item-section>
            <q-item-label>完整作品卡片</q-item-label>
            <q-item-label caption>在卡片中直接显示标题、社团和完整标签信息。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control"><q-toggle v-model="oldWorkCardUIStyle" color="primary" /></q-item-section>
        </q-item>

        <SmartPathSettings
          v-model:enabled="smartPathEnabled"
          v-model:prefer-effect="smartPathPreferEffect"
          v-model:audio-types="smartPathAudioTypes"
        />
      </q-list>
    </section>

    <section class="preferences-section" aria-labelledby="playback-settings-title">
      <div class="preferences-section__heading">
        <q-icon name="headphones" size="22px" />
        <div>
          <div id="playback-settings-title" class="text-subtitle1 text-weight-medium">播放控制</div>
          <div class="text-caption text-grey-7">调整播放器按钮与睡眠定时的操作方式。</div>
        </div>
      </div>
      <q-list bordered separator class="preferences-list">
        <q-item class="preference-row">
          <q-item-section>
            <q-item-label>后退跳跃秒数</q-item-label>
            <q-item-label caption>播放器后退按钮使用的间隔。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control"><q-btn-toggle v-model="rewindSeekTime" dense unelevated no-caps toggle-color="primary" :options="seekOptions" /></q-item-section>
        </q-item>

        <q-item class="preference-row">
          <q-item-section>
            <q-item-label>前进跳跃秒数</q-item-label>
            <q-item-label caption>播放器前进按钮使用的间隔。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control"><q-btn-toggle v-model="forwardSeekTime" dense unelevated no-caps toggle-color="primary" :options="seekOptions" /></q-item-section>
        </q-item>

        <q-item class="preference-row">
          <q-item-section>
            <q-item-label>睡眠定时方式</q-item-label>
            <q-item-label caption>切换方式时会取消正在运行的睡眠定时。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control preference-control--wide">
            <q-btn-toggle :model-value="oldSleepTimerUIStyle" dense unelevated no-caps toggle-color="primary" :options="sleepTimerOptions" @update:model-value="setSleepTimerStyle" />
          </q-item-section>
        </q-item>

        <q-item class="preference-row">
          <q-item-section>
            <q-item-label>播放速度</q-item-label>
            <q-item-label caption>刷新页面后继续使用所选速度。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control preference-control--wide"><q-btn-toggle v-model="playbackRate" dense unelevated no-caps toggle-color="primary" :options="playbackRateOptions" /></q-item-section>
        </q-item>

        <q-item tag="label" class="preference-row">
          <q-item-section>
            <q-item-label>启动时恢复上次队列</q-item-label>
            <q-item-label caption>恢复曲目顺序和播放位置，并保持暂停。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control"><q-toggle v-model="restoreLastQueue" color="primary" /></q-item-section>
        </q-item>

        <q-item tag="label" class="preference-row">
          <q-item-section>
            <q-item-label>底栏显示快进与后退</q-item-label>
            <q-item-label caption>用跳跃按钮替换上一曲和下一曲按钮。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control"><q-toggle v-model="swapSeekButton" color="primary" /></q-item-section>
        </q-item>
      </q-list>
    </section>

    <section class="preferences-section" aria-labelledby="media-settings-title">
      <div class="preferences-section__heading">
        <q-icon name="graphic_eq" size="22px" />
        <div>
          <div id="media-settings-title" class="text-subtitle1 text-weight-medium">媒体兼容</div>
          <div class="text-caption text-grey-7">按当前浏览器能力选择播放和转码策略。</div>
        </div>
      </div>
      <q-list bordered separator class="preferences-list">
        <q-item class="preference-row">
          <q-item-section>
            <q-item-label>音频转码</q-item-label>
            <q-item-label caption>按需生成浏览器兼容的 AAC，不会改动原始文件。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control preference-control--wide"><q-btn-toggle v-model="transcodeOption" dense unelevated no-caps toggle-color="primary" :options="transcodeOptions" /></q-item-section>
        </q-item>

        <q-item class="preference-row">
          <q-item-section>
            <q-item-label>需要转码的扩展名</q-item-label>
            <q-item-label caption>全部取消时等同于关闭转码。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control preference-control--types">
            <q-checkbox v-for="type in transcodeFileTypes" :key="type" :model-value="isTranscodeTypeEnabled(type)" :label="type" dense color="primary" @update:model-value="setTranscodeType(type, $event)" />
          </q-item-section>
        </q-item>

        <q-item tag="label" class="preference-row">
          <q-item-section>
            <q-item-label>高级音频模式</q-item-label>
            <q-item-label caption>启用音频可视化与声道控制；iOS 设备可能出现播放问题。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control"><q-toggle v-model="enableVisualizer" color="primary" /></q-item-section>
        </q-item>

        <q-item tag="label" class="preference-row">
          <q-item-section>
            <q-item-label>使用视频源播放</q-item-label>
            <q-item-label caption>播放 MP4 音频时允许在大图模式中显示视频画面。</q-item-label>
          </q-item-section>
          <q-item-section side class="preference-control"><q-toggle v-model="enableVideoSource" color="primary" /></q-item-section>
        </q-item>
      </q-list>
    </section>
  </q-page>
</template>

<script>
import { mapState, mapMutations } from 'vuex'
import { applyColorScheme, COLOR_SCHEMES, COLOR_SCHEME_EVENT, readColorScheme } from '../colorScheme'
import { colorSchemeOptions, playbackRateOptions, seekOptions, sleepTimerOptions, transcodeOptions, workListModeOptions } from '../preferenceOptions'
import { TRANSCODE_FILE_TYPES } from '../store/module-AudioPlayer/state'
import { ACCENT_COLOR_EVENT, applyAccentColor, DEFAULT_ACCENT_COLOR, normalizeAccentColor, readAccentColor } from '../themeColor'
import SmartPathSettings from '../components/SmartPathSettings.vue'

export default {
  name: 'Preferences',

  components: { SmartPathSettings },

  data () {
    return {
      selectedColorScheme: readColorScheme(),
      accentColorInput: readAccentColor(),
      appliedAccentColor: readAccentColor(),
      defaultAccentColor: DEFAULT_ACCENT_COLOR,
      colorSchemeOptions,
      workListModeOptions,
      seekOptions,
      playbackRateOptions,
      sleepTimerOptions,
      transcodeOptions,
      transcodeFileTypes: TRANSCODE_FILE_TYPES,
    }
  },

  computed: {
    ...mapState('AudioPlayer', [
      'oldSleepTimerUIStyle',
      'sleepMode',
      'transcodeFromTypes',
    ]),
    colorScheme: {
      get () { return this.selectedColorScheme },
      set (value) { this.selectedColorScheme = applyColorScheme(value) },
    },
    accentColorInvalid () {
      return normalizeAccentColor(this.accentColorInput) === null
    },
    workListMode: {
      get () { return this.$store.state.AudioPlayer.workListMode },
      set (value) { this.SET_WORK_LIST_MODE(value) },
    },
    enableShowRecent: {
      get () { return this.$store.state.AudioPlayer.enableShowRecent },
      set (value) { this.SET_ENABLE_SHOW_RECENT(value) },
    },
    oldWorkCardUIStyle: {
      get () { return this.$store.state.AudioPlayer.oldWorkCardUIStyle },
      set (value) { this.SET_OLD_WORK_CARD_UI_STYLE(value) },
    },
    smartPathEnabled: {
      get () { return this.$store.state.AudioPlayer.smartPathEnabled },
      set (value) { this.SET_SMART_PATH_ENABLED(value) },
    },
    smartPathPreferEffect: {
      get () { return this.$store.state.AudioPlayer.smartPathPreferEffect },
      set (value) { this.SET_SMART_PATH_PREFER_EFFECT(value) },
    },
    smartPathAudioTypes: {
      get () { return this.$store.state.AudioPlayer.smartPathAudioTypes },
      set (value) { this.SET_SMART_PATH_AUDIO_TYPES(value) },
    },
    rewindSeekTime: {
      get () { return this.$store.state.AudioPlayer.rewindSeekTime },
      set (value) { this.SET_REWIND_SEEK_TIME(value) },
    },
    forwardSeekTime: {
      get () { return this.$store.state.AudioPlayer.forwardSeekTime },
      set (value) { this.SET_FORWARD_SEEK_TIME(value) },
    },
    playbackRate: {
      get () { return this.$store.state.AudioPlayer.playbackRate },
      set (value) { this.SET_PLAYBACK_RATE(value) },
    },
    restoreLastQueue: {
      get () { return this.$store.state.AudioPlayer.restoreLastQueue },
      set (value) { this.SET_RESTORE_LAST_QUEUE(value) },
    },
    swapSeekButton: {
      get () { return this.$store.state.AudioPlayer.swapSeekButton },
      set (value) {
        if (value !== this.$store.state.AudioPlayer.swapSeekButton) this.TOGGLE_SWAP_SEEK_BUTTON()
      },
    },
    transcodeOption: {
      get () { return this.$store.state.AudioPlayer.transcodeOption },
      set (value) { this.SET_TRANSCODE_OPTION(value) },
    },
    enableVisualizer: {
      get () { return this.$store.state.AudioPlayer.enableVisualizer },
      set (value) { this.SET_ENABLE_VISUALIZER(value) },
    },
    enableVideoSource: {
      get () { return this.$store.state.AudioPlayer.enableVideoSource },
      set (value) { this.SET_ENABLE_VIDEO_SOURCE(value) },
    },
  },

  mounted () {
    window.addEventListener(COLOR_SCHEME_EVENT, this.onColorSchemeChange)
    window.addEventListener(ACCENT_COLOR_EVENT, this.onAccentColorChange)
  },

  beforeUnmount () {
    window.removeEventListener(COLOR_SCHEME_EVENT, this.onColorSchemeChange)
    window.removeEventListener(ACCENT_COLOR_EVENT, this.onAccentColorChange)
  },

  methods: {
    ...mapMutations('AudioPlayer', [
      'CLEAR_SLEEP_MODE',
      'SET_ENABLE_SHOW_RECENT',
      'SET_ENABLE_VIDEO_SOURCE',
      'SET_ENABLE_VISUALIZER',
      'SET_FORWARD_SEEK_TIME',
      'SET_PLAYBACK_RATE',
      'SET_RESTORE_LAST_QUEUE',
      'SET_OLD_SLEEP_TIMER_UI_STYLE',
      'SET_OLD_WORK_CARD_UI_STYLE',
      'SET_REWIND_SEEK_TIME',
      'SET_TRANSCODE_FROM_TYPES',
      'SET_TRANSCODE_OPTION',
      'SET_SMART_PATH_ENABLED',
      'SET_SMART_PATH_PREFER_EFFECT',
      'SET_SMART_PATH_AUDIO_TYPES',
      'SET_WORK_LIST_MODE',
      'TOGGLE_SWAP_SEEK_BUTTON',
    ]),
    onColorSchemeChange (event) {
      if (event.detail && Object.values(COLOR_SCHEMES).includes(event.detail.scheme)) {
        this.selectedColorScheme = event.detail.scheme
      }
    },
    onAccentColorChange (event) {
      if (event.detail && event.detail.persist === false && normalizeAccentColor(event.detail.color)) {
        this.accentColorInput = event.detail.color
        this.appliedAccentColor = event.detail.color
      }
    },
    previewAccentColor (value) {
      const normalized = normalizeAccentColor(value)
      if (normalized) this.appliedAccentColor = applyAccentColor(normalized)
    },
    setAccentColor (value) {
      const normalized = normalizeAccentColor(value)
      if (!normalized) return
      this.accentColorInput = normalized
      this.appliedAccentColor = applyAccentColor(normalized)
    },
    normalizeAccentColorInput () {
      const normalized = normalizeAccentColor(this.accentColorInput)
      if (normalized) this.accentColorInput = normalized
    },
    resetAccentColor () {
      this.setAccentColor(DEFAULT_ACCENT_COLOR)
    },
    isTranscodeTypeEnabled (type) {
      return this.transcodeFromTypes.split(',').includes(type)
    },
    setTranscodeType (type, enabled) {
      const selected = this.transcodeFromTypes ? this.transcodeFromTypes.split(',') : []
      const next = enabled
        ? selected.concat(type).filter((value, index, values) => values.indexOf(value) === index)
        : selected.filter(value => value !== type)
      this.SET_TRANSCODE_FROM_TYPES(next.join(','))
    },
    setSleepTimerStyle (value) {
      if (value === this.oldSleepTimerUIStyle) return
      if (this.sleepMode) {
        this.CLEAR_SLEEP_MODE()
        this.$q.sessionStorage.set('sleepTime', null)
        this.$q.sessionStorage.set('sleepMode', false)
        this.$q.notify({ message: '已取消当前睡眠定时', color: 'primary', icon: 'bedtime', timeout: 2000 })
      }
      this.SET_OLD_SLEEP_TIMER_UI_STYLE(value)
    },
  },
}
</script>

<style lang="scss" scoped>
.preferences-page { max-width: 920px; margin: 0 auto; padding-bottom: 112px; }
.preferences-heading { margin: 8px 0 28px; }
.preferences-section { margin-bottom: 30px; }
.preferences-section__heading { display: flex; align-items: center; gap: 12px; margin: 0 4px 10px; }
.preferences-section__heading .q-icon { color: var(--q-color-primary); }
.preferences-list { overflow: hidden; border-radius: 6px; }
.preference-row { min-height: 76px; }
.preference-control { padding-left: 24px; }
.preference-control--types { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px 12px; }
.preference-control--color { width: 246px; align-items: stretch; }
.accent-color-control { display: grid; grid-template-columns: 34px minmax(0, 1fr) 34px; align-items: center; gap: 8px; }
.accent-color-picker-button { width: 34px; height: 34px; min-height: 34px !important; border-radius: 5px !important; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .22); color: #fff !important; }
.accent-color-picker-button :deep(.q-btn__wrapper) { min-height: 34px; padding: 0; }
.accent-color-picker-button :deep(.q-icon) { font-size: 18px; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .46)); }
.accent-color-reset-button { width: 34px; height: 34px; min-height: 34px !important; border: 1px solid rgba(0, 0, 0, .12); border-radius: 5px !important; background: rgba(0, 0, 0, .045); }
.accent-color-reset-button :deep(.q-btn__wrapper) { min-height: 34px; padding: 0; }
.accent-color-reset-button :deep(.q-icon) { font-size: 20px; }
.accent-color-input-swatch { display: block; width: 18px; height: 18px; border: 1px solid rgba(0, 0, 0, .16); border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .22); }
.accent-color-control :deep(.q-field__control) { height: 38px; min-height: 38px; }
.accent-color-control :deep(.q-field__prepend) { height: 38px; }
.accent-color-control :deep(.q-field__native) { padding: 0 10px; font-family: Consolas, "SFMono-Regular", monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 0; }
.body--dark .accent-color-input-swatch { border-color: rgba(255, 255, 255, .24); }
.body--dark .accent-color-reset-button { border-color: rgba(255, 255, 255, .18); background: rgba(255, 255, 255, .08); }
.preference-control .q-btn-toggle { gap: 4px; padding: 2px; border: 1px solid rgba(0, 0, 0, .12); border-radius: 5px; background: rgba(0, 0, 0, .045); }
.preference-control :deep(.q-btn) { min-height: 34px; padding: 4px 12px; border-radius: 3px !important; color: rgba(0, 0, 0, .68); font-size: 14px; line-height: 1.25; }
.preference-control :deep(.q-icon) { font-size: 18px; }
.preference-control .q-btn--active { box-shadow: 0 1px 3px rgba(0, 0, 0, .22); color: #fff; }
.body--dark .preference-control .q-btn-toggle { border-color: rgba(255, 255, 255, .18); background: rgba(255, 255, 255, .08); }
.body--dark .preference-control :deep(.q-btn) { color: rgba(255, 255, 255, .72); }
.body--dark .preference-control :deep(.q-btn--active) { color: #fff; }

@media (max-width: 699px) {
  .preferences-page { padding-right: 12px; padding-left: 12px; }
  .preference-row { align-items: flex-start; flex-wrap: wrap; gap: 12px; padding-top: 14px; padding-bottom: 14px; }
  .preference-control { width: 100%; align-items: flex-start; padding-left: 0; }
  .preference-control--types { align-items: center; justify-content: flex-start; }
  .preference-control--color { flex-basis: 100%; width: 100%; max-width: 100%; align-items: stretch; }
  .preference-control--wide .q-btn-toggle { width: 100%; }
  .preference-control--wide :deep(.q-btn) { min-width: 0; flex: 1 1 auto; }
}
</style>
