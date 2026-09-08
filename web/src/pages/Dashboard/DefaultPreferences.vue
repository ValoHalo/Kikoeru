<template>
  <q-page class="admin-page admin-page--with-fixed-actions default-preferences-page">
    <q-form @submit="onSubmit">
      <header class="settings-heading">
        <div>
          <h1>{{ $t('defaultPreferences.title') }}</h1>
          <div class="text-caption text-grey-7">{{ $t('defaultPreferences.description') }}</div>
        </div>
      </header>

      <section class="settings-section" aria-labelledby="default-appearance-title">
        <div class="settings-section__heading">
          <q-icon name="palette" size="22px" />
          <div>
            <h2 id="default-appearance-title">{{ $t('preferences.general') }}</h2>
            <div class="text-caption text-grey-7">{{ $t('defaultPreferences.appearanceHint') }}</div>
          </div>
        </div>
        <q-list bordered separator class="settings-list">
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('common.interfaceLanguage') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--select">
              <q-select v-model="config.interfaceLanguage" :options="interfaceLanguageOptions" emit-value map-options dense outlined options-dense :aria-label="$t('common.interfaceLanguage')" />
            </q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.colorScheme') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.colorSchemeHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--wide"><q-btn-toggle v-model="config.colorScheme" dense unelevated no-caps toggle-color="primary" :options="colorSchemeOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.accentColor') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.accentColorHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--color">
              <div class="accent-color-control">
                <q-btn
                  class="accent-color-picker-button"
                  unelevated
                  icon="colorize"
                  :aria-label="$t('defaultPreferences.chooseAccent')"
                  :style="{ backgroundColor: accentColorPreview }"
                >
                  <q-tooltip>{{ $t('defaultPreferences.chooseColor') }}</q-tooltip>
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
                  :aria-label="$t('defaultPreferences.accentHex')"
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
                  :aria-label="$t('defaultPreferences.resetAccent')"
                  :disable="normalizeAccentColor(config.accentColor) === defaultAccentColor"
                  @click="setAccentColor(defaultAccentColor)"
                >
                  <q-tooltip>{{ $t('common.reset') }}</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.workListMode') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.workListModeHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-btn-toggle v-model="config.workListMode" dense unelevated no-caps toggle-color="primary" :options="workListModeOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('preferences.contentDisplay') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--select settings-control--content">
              <q-select v-model="config.contentDisplayMode" :options="contentDisplayOptions" emit-value map-options dense outlined options-dense :aria-label="$t('preferences.contentDisplay')" />
            </q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>{{ $t('preferences.hideSubtitleFiles') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-toggle v-model="config.hideSubtitleFiles" color="primary" :aria-label="$t('preferences.hideSubtitleFiles')" /></q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.showRecent') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.showRecentHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-toggle v-model="config.enableShowRecent" color="primary" /></q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.fullCards') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.fullCardsHint') }}</q-item-label></q-item-section>
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
            <h2 id="default-playback-title">{{ $t('defaultPreferences.playback') }}</h2>
            <div class="text-caption text-grey-7">{{ $t('defaultPreferences.playbackHint') }}</div>
          </div>
        </div>
        <q-list bordered separator class="settings-list">
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.rewind') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.rewindHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-btn-toggle v-model="config.rewindSeekTime" dense unelevated no-caps toggle-color="primary" :options="seekOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.forward') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.forwardHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-btn-toggle v-model="config.forwardSeekTime" dense unelevated no-caps toggle-color="primary" :options="seekOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.sleepTimer') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.sleepTimerHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--wide"><q-btn-toggle v-model="config.oldSleepTimerUIStyle" dense unelevated no-caps toggle-color="primary" :options="sleepTimerOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('preferences.playbackRate') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--wide"><q-btn-toggle v-model="config.playbackRate" dense unelevated no-caps toggle-color="primary" :options="playbackRateOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.subtitleLanguage') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.subtitleLanguageHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--select">
              <q-select v-model="config.defaultSubtitleLanguage" :options="subtitleLanguageOptions" emit-value map-options dense outlined options-dense />
            </q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>{{ $t('preferences.restoreQueue') }}</q-item-label><q-item-label caption>{{ $t('preferences.restoreQueueHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-toggle v-model="config.restoreLastQueue" color="primary" /></q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.seekButtons') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.seekButtonsHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-toggle v-model="config.swapSeekButton" color="primary" /></q-item-section>
          </q-item>
        </q-list>
      </section>

      <section class="settings-section" aria-labelledby="default-media-title">
        <div class="settings-section__heading">
          <q-icon name="graphic_eq" size="22px" />
          <div>
            <h2 id="default-media-title">{{ $t('defaultPreferences.compatibility') }}</h2>
            <div class="text-caption text-grey-7">{{ $t('defaultPreferences.compatibilityHint') }}</div>
          </div>
        </div>
        <q-list bordered separator class="settings-list">
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.transcode') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.transcodeHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--wide"><q-btn-toggle v-model="config.transcodeOption" dense unelevated no-caps toggle-color="primary" :options="transcodeOptions" /></q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.transcodeTypes') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.transcodeTypesHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--types">
              <q-checkbox v-for="type in transcodeFileTypes" :key="type" :model-value="isTranscodeTypeEnabled(type)" :label="type" dense color="primary" @update:model-value="setTranscodeType(type, $event)" />
            </q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.visualizer') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.visualizerHint') }}</q-item-label></q-item-section>
            <q-item-section side class="settings-control"><q-toggle v-model="config.enableVisualizer" color="primary" /></q-item-section>
          </q-item>
          <q-item tag="label" class="settings-row">
            <q-item-section><q-item-label>{{ $t('defaultPreferences.videoSource') }}</q-item-label><q-item-label caption>{{ $t('defaultPreferences.videoSourceHint') }}</q-item-label></q-item-section>
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
          :aria-label="$t('defaultPreferences.saveDefaults')"
        >
          <q-tooltip>{{ hasUnsavedChanges ? $t('defaultPreferences.saveChanges') : $t('defaultPreferences.saveDefaults') }}</q-tooltip>
        </q-btn>
      </div>
    </q-form>
  </q-page>
</template>

<script>
import NotifyMixin from '../../mixins/Notification.js'
import { colorSchemeOptions, contentDisplayOptions, interfaceLanguageOptions, playbackRateOptions, seekOptions, sleepTimerOptions, subtitleLanguageOptions, transcodeOptions, workListModeOptions } from '../../preferenceOptions'
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

      transcodeFileTypes: TRANSCODE_FILE_TYPES,
      playbackRateOptions,
    }
  },

  computed: {
    interfaceLanguageOptions () { return interfaceLanguageOptions() },
    contentDisplayOptions () { return contentDisplayOptions() },
    colorSchemeOptions () { return colorSchemeOptions() },
    workListModeOptions () { return workListModeOptions() },
    seekOptions () { return seekOptions() },
    sleepTimerOptions () { return sleepTimerOptions() },
    subtitleLanguageOptions () { return subtitleLanguageOptions() },
    transcodeOptions () { return transcodeOptions() },
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
.settings-control--content { width: 230px; }
@media (max-width: 699px) {
  .settings-control--content { width: 100%; }
}
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
</style>
