<template>
  <q-page class="admin-page admin-page--with-fixed-actions default-preferences-page">
    <q-form @submit="onSubmit">
      <header class="settings-heading">
        <div class="text-h5">默认设置</div>
        <div class="text-caption text-grey-7">为尚未在浏览器中修改过选项的设备设置初始值；已有个人设置保持不变。</div>
      </header>

      <section class="settings-section" aria-labelledby="default-appearance-title">
        <div class="settings-section__heading">
          <q-icon name="palette" size="22px" />
          <div>
            <div id="default-appearance-title" class="text-subtitle1 text-weight-medium">外观与浏览</div>
            <div class="text-caption text-grey-7">设置媒体库在新设备上的初始显示方式。</div>
          </div>
        </div>
        <q-list bordered separator class="settings-list">
          <q-item class="settings-row">
            <q-item-section><q-item-label>颜色模式</q-item-label><q-item-label caption>默认跟随系统，也可固定为浅色或深色。</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--wide"><q-btn-toggle v-model="config.colorScheme" dense unelevated no-caps toggle-color="primary" :options="colorSchemeOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>强调色</q-item-label><q-item-label caption>用于尚未设置个人强调色的设备。</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--color">
              <div class="accent-color-control">
                <q-btn
                  class="accent-color-picker-button"
                  unelevated
                  icon="colorize"
                  aria-label="选择默认强调色"
                  :style="{ backgroundColor: accentColorPreview }"
                >
                  <q-tooltip>选择颜色</q-tooltip>
                  <q-popup-proxy transition-show="scale" transition-hide="scale">
                    <q-color
                      :model-value="accentColorPreview"
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
                  v-model="config.accentColor"
                  dense
                  outlined
                  hide-bottom-space
                  maxlength="7"
                  input-class="accent-color-input"
                  aria-label="默认强调色 RGB HEX"
                  :error="accentColorInvalid"
                  @blur="normalizeAccentColorInput"
                  @keyup.enter="$event.target.blur()"
                >
                  <template v-slot:prepend>
                    <span class="accent-color-input-swatch" :style="{ backgroundColor: accentColorPreview }" aria-hidden="true" />
                  </template>
                </q-input>
                <q-btn
                  class="accent-color-reset-button"
                  flat
                  dense
                  icon="restart_alt"
                  aria-label="恢复默认强调色"
                  :disable="normalizeAccentColor(config.accentColor) === defaultAccentColor"
                  @click="setAccentColor(defaultAccentColor)"
                >
                  <q-tooltip>恢复默认</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>作品加载方式</q-item-label><q-item-label caption>瀑布流连续加载；分页便于记住当前位置。</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-btn-toggle v-model="config.workListMode" dense unelevated no-caps toggle-color="primary" :options="workListModeOptions" /></q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>显示最近播放</q-item-label><q-item-label caption>在媒体库首页顶部显示最近播放的作品。</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-toggle v-model="config.enableShowRecent" color="primary" /></q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>完整作品卡片</q-item-label><q-item-label caption>在卡片中直接显示标题、社团和完整标签信息。</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-toggle v-model="config.oldWorkCardUIStyle" color="primary" /></q-item-section>
          </q-item>
          <SmartPathSettings
            v-model:enabled="config.smartPathEnabled"
            v-model:prefer-effect="config.smartPathPreferEffect"
            v-model:audio-types="config.smartPathAudioTypes"
          />
        </q-list>
      </section>

      <section class="settings-section" aria-labelledby="default-playback-title">
        <div class="settings-section__heading">
          <q-icon name="headphones" size="22px" />
          <div>
            <div id="default-playback-title" class="text-subtitle1 text-weight-medium">播放控制</div>
            <div class="text-caption text-grey-7">设置播放器按钮和睡眠定时的初始行为。</div>
          </div>
        </div>
        <q-list bordered separator class="settings-list">
          <q-item class="settings-row">
            <q-item-section><q-item-label>后退跳跃秒数</q-item-label><q-item-label caption>播放器后退按钮使用的默认间隔。</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-btn-toggle v-model="config.rewindSeekTime" dense unelevated no-caps toggle-color="primary" :options="seekOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>前进跳跃秒数</q-item-label><q-item-label caption>播放器前进按钮使用的默认间隔。</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-btn-toggle v-model="config.forwardSeekTime" dense unelevated no-caps toggle-color="primary" :options="seekOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>睡眠定时方式</q-item-label><q-item-label caption>选择分钟倒计时或指定停止时刻。</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--wide"><q-btn-toggle v-model="config.oldSleepTimerUIStyle" dense unelevated no-caps toggle-color="primary" :options="sleepTimerOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>默认字幕语言</q-item-label><q-item-label caption>新设备自动加载本地字幕时优先使用的语言。</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--select">
              <q-select v-model="config.defaultSubtitleLanguage" :options="subtitleLanguageOptions" emit-value map-options dense outlined options-dense />
            </q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>底栏显示快进与后退</q-item-label><q-item-label caption>用跳跃按钮替换上一曲和下一曲按钮。</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-toggle v-model="config.swapSeekButton" color="primary" /></q-item-section>
          </q-item>
        </q-list>
      </section>

      <section class="settings-section" aria-labelledby="default-media-title">
        <div class="settings-section__heading">
          <q-icon name="graphic_eq" size="22px" />
          <div>
            <div id="default-media-title" class="text-subtitle1 text-weight-medium">媒体兼容</div>
            <div class="text-caption text-grey-7">设置新设备初次播放时使用的音频策略。</div>
          </div>
        </div>
        <q-list bordered separator class="settings-list">
          <q-item class="settings-row">
            <q-item-section><q-item-label>音频转码</q-item-label><q-item-label caption>按需生成浏览器兼容的 AAC，不会改动原始文件。</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--wide"><q-btn-toggle v-model="config.transcodeOption" dense unelevated no-caps toggle-color="primary" :options="transcodeOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>需要转码的扩展名</q-item-label><q-item-label caption>全部取消时等同于关闭转码。</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--types">
              <q-checkbox v-for="type in transcodeFileTypes" :key="type" :model-value="isTranscodeTypeEnabled(type)" :label="type" dense color="primary" @update:model-value="setTranscodeType(type, $event)" />
            </q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>高级音频模式</q-item-label><q-item-label caption>启用音频可视化与声道控制；iOS 设备可能出现播放问题。</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-toggle v-model="config.enableVisualizer" color="primary" /></q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>使用视频源播放</q-item-label><q-item-label caption>播放 MP4 音频时允许在大图模式中显示视频画面。</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-toggle v-model="config.enableVideoSource" color="primary" /></q-item-section>
          </q-item>
        </q-list>
      </section>

      <div class="settings-actions admin-page-actions row justify-end">
        <q-btn
          class="settings-save-button"
          :class="{ 'settings-save-button--active': hasUnsavedChanges }"
          :loading="loading"
          :disable="accentColorInvalid"
          round
          unelevated
          icon="save"
          type="submit"
          aria-label="保存默认设置"
        >
          <q-tooltip>{{ hasUnsavedChanges ? '保存修改' : '保存默认设置' }}</q-tooltip>
        </q-btn>
      </div>
    </q-form>
  </q-page>
</template>

<script>
import NotifyMixin from '../../mixins/Notification.js'
import { colorSchemeOptions, seekOptions, sleepTimerOptions, subtitleLanguageOptions, transcodeOptions, workListModeOptions } from '../../preferenceOptions'
import { TRANSCODE_FILE_TYPES } from '../../store/module-AudioPlayer/state'
import { DEFAULT_ACCENT_COLOR, normalizeAccentColor } from '../../themeColor'
import SmartPathSettings from '../../components/SmartPathSettings.vue'

export default {
  name: 'DefaultPreferences',

  components: { SmartPathSettings },

  mixins: [NotifyMixin],

  data () {
    return {
      config: {},
      savedConfigSnapshot: '',
      loading: false,
      defaultAccentColor: DEFAULT_ACCENT_COLOR,
      colorSchemeOptions,
      workListModeOptions,
      seekOptions,
      sleepTimerOptions,
      subtitleLanguageOptions,
      transcodeOptions,
      transcodeFileTypes: TRANSCODE_FILE_TYPES,
    }
  },

  computed: {
    accentColorPreview () {
      return normalizeAccentColor(this.config.accentColor) || DEFAULT_ACCENT_COLOR
    },
    accentColorInvalid () {
      return Object.prototype.hasOwnProperty.call(this.config, 'accentColor') && normalizeAccentColor(this.config.accentColor) === null
    },
    hasUnsavedChanges () {
      return this.savedConfigSnapshot !== '' && JSON.stringify(this.config) !== this.savedConfigSnapshot
    },
  },

  methods: {
    normalizeAccentColor,
    setAccentColor (value) {
      const normalized = normalizeAccentColor(value)
      if (normalized) this.config.accentColor = normalized
    },
    normalizeAccentColorInput () {
      const normalized = normalizeAccentColor(this.config.accentColor)
      if (normalized) this.config.accentColor = normalized
    },
    isTranscodeTypeEnabled (type) {
      return typeof this.config.transcodeFromTypes === 'string' && this.config.transcodeFromTypes.split(',').includes(type)
    },

    setTranscodeType (type, enabled) {
      const selected = typeof this.config.transcodeFromTypes === 'string' && this.config.transcodeFromTypes
        ? this.config.transcodeFromTypes.split(',')
        : []
      const next = enabled
        ? selected.concat(type).filter((value, index, values) => values.indexOf(value) === index)
        : selected.filter(value => value !== type)
      this.config.transcodeFromTypes = next.join(',')
    },

    requestConfig () {
      this.$axios.get('/api/config/admin')
        .then((response) => {
          this.config = response.data.config
          if (!normalizeAccentColor(this.config.accentColor)) this.config.accentColor = DEFAULT_ACCENT_COLOR
          this.savedConfigSnapshot = JSON.stringify(this.config)
        })
        .catch((error) => {
          if (error.response) {
            if (error.response.status !== 401) this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    onSubmit () {
      const accentColor = normalizeAccentColor(this.config.accentColor)
      if (!accentColor) return
      this.config.accentColor = accentColor
      this.loading = true
      this.$axios.put('/api/config/admin', { config: this.config })
        .then((response) => {
          this.savedConfigSnapshot = JSON.stringify(this.config)
          this.showSuccNotif(response.data.message)
        })
        .catch((error) => {
          if (error.response) {
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
        .finally(() => { this.loading = false })
    },
  },

  created () {
    this.requestConfig()
  },
}
</script>

<style lang="scss" scoped>
.default-preferences-page { max-width: 920px; margin: 0 auto; padding: 16px 16px 112px; }
.settings-heading { margin: 8px 0 28px; }
.settings-heading .text-caption { max-width: 100%; overflow-wrap: anywhere; white-space: normal; }
.settings-section { margin-bottom: 30px; }
.settings-section__heading { display: flex; align-items: center; gap: 12px; margin: 0 4px 10px; }
.settings-section__heading .q-icon { color: var(--q-color-primary); }
.settings-list { overflow: hidden; border-radius: 6px; }
.settings-list .q-item { min-height: 76px; }
.settings-list .q-item__section--side { padding-left: 24px; }
.settings-control--types { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px 12px; }
.settings-control--color { width: 246px; align-items: stretch; }
.settings-control--select { width: 180px; align-items: stretch; }
.accent-color-control { display: grid; grid-template-columns: 34px minmax(0, 1fr) 34px; align-items: center; gap: 8px; }
.accent-color-picker-button { width: 34px; height: 34px; min-height: 34px !important; border-radius: 5px !important; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .22); color: #fff !important; }
.accent-color-picker-button :deep(.q-icon) { font-size: 18px; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .46)); }
.accent-color-reset-button { width: 34px; height: 34px; min-height: 34px !important; border: 1px solid rgba(0, 0, 0, .12); border-radius: 5px !important; background: rgba(0, 0, 0, .045); }
.accent-color-reset-button :deep(.q-icon) { font-size: 20px; }
.accent-color-input-swatch { display: block; width: 18px; height: 18px; border: 1px solid rgba(0, 0, 0, .16); border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .22); }
.accent-color-control :deep(.q-field__control) { height: 38px; min-height: 38px; }
.accent-color-control :deep(.q-field__prepend) { height: 38px; }
.accent-color-control :deep(.q-field__native) { padding: 0 10px; font-family: Consolas, "SFMono-Regular", monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 0; }
.body--dark .accent-color-input-swatch { border-color: rgba(255, 255, 255, .24); }
.body--dark .accent-color-reset-button { border-color: rgba(255, 255, 255, .18); background: rgba(255, 255, 255, .08); }
.settings-control .q-btn-toggle { gap: 4px; padding: 2px; border: 1px solid rgba(0, 0, 0, .12); border-radius: 5px; background: rgba(0, 0, 0, .045); }
.settings-control :deep(.q-btn) { min-height: 34px; padding: 4px 12px; border-radius: 3px !important; color: rgba(0, 0, 0, .68); font-size: 14px; line-height: 1.25; }
.settings-control :deep(.q-icon) { font-size: 18px; }
.settings-control .q-btn--active { box-shadow: 0 1px 3px rgba(0, 0, 0, .22); color: #fff; }
.body--dark .settings-control .q-btn-toggle { border-color: rgba(255, 255, 255, .18); background: rgba(255, 255, 255, .08); }
.body--dark .settings-control :deep(.q-btn) { color: rgba(255, 255, 255, .72); }
.body--dark .settings-control :deep(.q-btn--active) { color: #fff; }
.settings-actions.admin-page-actions { padding: 0; border: 0; background: transparent; box-shadow: none; backdrop-filter: none; }
.settings-actions.admin-page-actions .settings-save-button { width: 56px; height: 56px; min-width: 56px; min-height: 56px; color: rgba(0, 0, 0, .52); background: #fff; box-shadow: 0 6px 18px rgba(22, 32, 44, .2); transition: color .18s ease, background-color .18s ease, box-shadow .18s ease, transform .18s ease; }
.settings-actions.admin-page-actions .settings-save-button--active { color: #fff; background: var(--q-primary); box-shadow: 0 8px 22px rgba(var(--kikoeru-accent-rgb), .34); }
.settings-actions.admin-page-actions .settings-save-button--active:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(var(--kikoeru-accent-rgb), .4); }
.settings-save-button :deep(.q-icon) { font-size: 28px; }
.body--dark .settings-actions.admin-page-actions { border: 0; background: transparent; box-shadow: none; }
.body--dark .settings-actions.admin-page-actions .settings-save-button { color: rgba(255, 255, 255, .6); background: #2b2b2b; box-shadow: 0 6px 18px rgba(0, 0, 0, .42); }
.body--dark .settings-actions.admin-page-actions .settings-save-button--active { color: #fff; background: var(--q-primary); box-shadow: 0 8px 22px rgba(var(--kikoeru-accent-rgb), .38); }

@media (max-width: 699px) {
  .default-preferences-page { padding-right: 12px; padding-left: 12px; }
  .settings-list .q-item { height: auto !important; min-height: 72px; align-items: flex-start; flex-wrap: wrap; gap: 12px; padding-top: 14px; padding-bottom: 14px; }
  .settings-list .q-item__section--side { width: 100%; min-width: 0; align-items: flex-start; padding-left: 0; }
  .settings-list .settings-control--types { align-items: center; justify-content: flex-start; }
  .settings-control--color { flex-basis: 100%; width: 100%; max-width: 100%; align-items: stretch; }
  .settings-control--select { width: 100%; align-items: stretch; }
  .settings-control--wide .q-btn-toggle { width: 100%; }
  .settings-control--wide :deep(.q-btn) { min-width: 0; flex: 1 1 auto; }
  .settings-actions.admin-page-actions { left: auto; }
  .settings-actions.admin-page-actions .settings-save-button { width: 56px; }
}
</style>
