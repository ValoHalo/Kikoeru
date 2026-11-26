<template>
  <q-card v-if="!$store.state.AudioPlayer.privacyMode" class="lyric-selection">
    <q-card-section class="row no-wrap items-center lyric-header">
      <div class="col lyric-header-copy">
        <div class="lyric-header-title">{{ $t('lyricSelection.managerTitle') }}</div>
        <div class="lyric-header-track ellipsis">{{ $privateText(currentPlayingFile.title || $t('lyricSelection.noTrack')) }}</div>
      </div>
      <q-btn v-close-popup flat round dense class="col-auto lyric-close-btn" icon="close" :aria-label="$t('lyricSelection.close')" />
    </q-card-section>

    <div class="lyric-tabs-wrap">
      <div class="lyric-segmented-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="lyric-seg-tab"
          :class="{ 'is-active': activeTab === 'lines' }"
          :aria-selected="activeTab === 'lines'"
          @click="activeTab = 'lines'"
        >
          <q-icon name="format_align_left" size="16px" />
          <span>{{ $t('lyricSelection.tabLines') }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="lyric-seg-tab"
          :class="{ 'is-active': activeTab === 'files' }"
          :aria-selected="activeTab === 'files'"
          @click="activeTab = 'files'"
        >
          <q-icon name="folder_open" size="16px" />
          <span>{{ $t('lyricSelection.tabFiles') }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="lyric-seg-tab"
          :class="{ 'is-active': activeTab === 'sync' }"
          :aria-selected="activeTab === 'sync'"
          @click="activeTab = 'sync'"
        >
          <q-icon name="schedule" size="16px" />
          <span>{{ $t('lyricSelection.tabSync') }}</span>
        </button>
      </div>
    </div>

    <!-- Tab 1: 歌词列表（普通用户纯浏览；管理员可直接开启编辑模式并保存到服务器） -->
    <template v-if="activeTab === 'lines'">
      <div v-if="isAdministrator && isEditingLyrics" class="lyric-scope-bar lyric-scope-bar--admin">
        <q-icon name="admin_panel_settings" size="16px" />
        <span class="col">{{ $t('lyricSelection.adminScopeHint') }}</span>
      </div>

      <div class="lyric-subbar lyric-subbar--wrap">
        <q-toggle
          v-if="!isEditingLyrics"
          v-model="autoTrackCurrentLine"
          dense
          size="sm"
          class="lyric-auto-track"
          :label="$t('lyricSelection.autoFollow')"
        />
        <div class="lyric-subbar-actions">
          <q-btn
            v-if="!isEditingLyrics"
            flat
            dense
            no-caps
            icon="my_location"
            :label="$t('lyricSelection.currentLine')"
            :disable="lyricLines.length === 0"
            class="lyric-neutral-btn"
            @click="showCurrentLyric"
          />
          <q-btn
            v-if="isAdministrator"
            flat
            dense
            no-caps
            :icon="isEditingLyrics ? 'edit_off' : 'edit'"
            :label="isEditingLyrics ? $t('lyricSelection.exitEdit') : $t('lyricSelection.edit')"
            :disable="lyricLines.length === 0 && !isEditingLyrics"
            class="lyric-neutral-btn"
            :class="{ 'lyric-neutral-btn--active': isEditingLyrics }"
            @click="toggleEditMode"
          />
          <q-btn
            v-if="isAdministrator && isEditingLyrics"
            unelevated
            dense
            no-caps
            color="primary"
            icon="save"
            :label="$t('lyricSelection.save')"
            :disable="lyricLines.length === 0"
            :loading="saving"
            class="lyric-primary-btn"
            @click="saveLyrics()"
          />
        </div>
      </div>

      <div class="lyric-body">
        <div v-if="lyricLines.length === 0" class="lyric-empty">
          <q-icon name="subtitles_off" size="32px" />
          <p>{{ $t('lyricSelection.noLyricsSwitchHint') }}</p>
          <q-btn
            flat
            no-caps
            icon="folder_open"
            class="lyric-neutral-btn"
            :label="$t('lyricSelection.tabFiles')"
            @click="activeTab = 'files'"
          />
        </div>
        <q-list v-else class="scroll lyric-list">
          <template v-for="(line, index) in lyricLines" :key="index">
            <q-item
              :id="'lyric_line_' + index"
              clickable
              v-ripple
              :active="index === currentLyricLineNumber"
              active-class="lyric-row--active"
              class="lyric-row"
              @click="seekToLine(line)"
            >
              <q-item-section side class="lyric-time-col">
                <span class="lyric-time-start">
                  {{ formatSeconds(line.time / 1000, true) }}
                </span>
                <span v-if="hasExplicitEnd(line)" class="lyric-time-end">
                  {{ formatSeconds(line.timeEnd / 1000, true) }}
                </span>
              </q-item-section>

              <q-item-section>
                <q-item-label class="lyric-line-text" :class="{ 'lyric-line-deleted': line.deleted }">
                  {{ line.text }}
                </q-item-label>
              </q-item-section>

              <q-item-section v-if="isAdministrator && isEditingLyrics" side>
                <div class="row no-wrap q-gutter-xs">
                  <q-btn
                    flat
                    round
                    dense
                    :icon="editingIndex === index ? 'expand_less' : 'edit'"
                    color="primary"
                    :aria-label="$t('lyricSelection.editLine')"
                    @click.stop="toggleInlineEditor(index)"
                  >
                    <AppTooltip>{{ $t('lyricSelection.editLine') }}</AppTooltip>
                  </q-btn>
                  <q-btn
                    v-if="!line.deleted"
                    flat
                    round
                    dense
                    icon="delete"
                    color="negative"
                    :aria-label="$t('lyricSelection.deleteLine')"
                    @click.stop="deleteLyricLine(index)"
                  >
                    <AppTooltip>{{ $t('lyricSelection.deleteLine') }}</AppTooltip>
                  </q-btn>
                  <q-btn
                    v-else
                    flat
                    round
                    dense
                    icon="restore"
                    color="positive"
                    :aria-label="$t('lyricSelection.restoreLine')"
                    @click.stop="recoverDeletedLyricLine(index)"
                  >
                    <AppTooltip>{{ $t('lyricSelection.restoreLine') }}</AppTooltip>
                  </q-btn>
                </div>
              </q-item-section>
            </q-item>

            <!-- 管理员行内编辑器 -->
            <div v-if="isAdministrator && isEditingLyrics && editingIndex === index" class="lyric-inline-editor">
              <div class="lyric-field">
                <label class="lyric-field-label" :for="`lyric-edit-text-${index}`">{{ $t('lyricSelection.text') }}</label>
                <q-input
                  :for="`lyric-edit-text-${index}`"
                  v-model="editLyricText"
                  dense
                  outlined
                  autogrow
                  class="lyric-clean-input"
                />
              </div>
              <div class="lyric-inline-times">
                <div class="lyric-field">
                  <label class="lyric-field-label" :for="`lyric-edit-start-${index}`">{{ $t('lyricSelection.startTime') }}</label>
                  <q-input
                    :for="`lyric-edit-start-${index}`"
                    v-model.number="editStartSeconds"
                    dense
                    outlined
                    type="number"
                    step="0.001"
                    min="0"
                    class="lyric-clean-input"
                  />
                </div>
                <div class="lyric-field">
                  <label class="lyric-field-label" :for="`lyric-edit-end-${index}`">{{ $t('lyricSelection.endTime') }}</label>
                  <q-input
                    :for="`lyric-edit-end-${index}`"
                    v-model.number="editEndSeconds"
                    dense
                    outlined
                    type="number"
                    step="0.001"
                    min="0"
                    clearable
                    :hint="$t('lyricSelection.endTimeHint')"
                    class="lyric-clean-input"
                  />
                </div>
              </div>
              <div class="lyric-inline-actions">
                <q-btn flat dense no-caps class="lyric-neutral-btn" :label="$t('common.cancel')" @click="editingIndex = -1" />
                <q-btn unelevated dense no-caps color="primary" class="lyric-primary-btn" :label="$t('lyricSelection.apply')" @click="confirmLyricChange" />
              </div>
            </div>
          </template>
        </q-list>
      </div>
    </template>

    <!-- Tab 2: 切换字幕文件（普通用户仅本机生效；管理员修改全局默认） -->
    <template v-else-if="activeTab === 'files'">
      <div class="lyric-scope-bar" :class="{ 'lyric-scope-bar--admin': isAdministrator }">
        <q-icon :name="isAdministrator ? 'admin_panel_settings' : 'devices'" size="16px" />
        <span class="col">{{ $t(isAdministrator ? 'lyricSelection.adminFilesHint' : 'lyricSelection.localScopeHint') }}</span>
      </div>

      <div class="lyric-subbar lyric-subbar--wrap">
        <q-btn
          flat
          dense
          no-caps
          icon="refresh"
          :label="$t('lyricSelection.refreshCandidates')"
          :disable="!currentPlayingFile.hash"
          :loading="loadingOptions"
          class="lyric-neutral-btn"
          @click="fetchOtherLyricFiles(true)"
        />
        <q-btn
          flat
          dense
          no-caps
          class="kikoeru-danger-text lyric-danger-btn"
          icon="subtitles_off"
          :label="$t('lyricSelection.disable')"
          :disable="!hasLyric && !activeDisabled"
          :loading="updatingSelection"
          @click="closeLyric"
        />
      </div>

      <div class="lyric-body">
        <div v-if="loadingOptions" class="lyric-empty">
          <q-spinner-dots color="primary" size="36px" />
        </div>
        <div v-else-if="lyricOptionList.length === 0" class="lyric-empty">
          <q-icon name="search_off" size="32px" />
          <p>{{ $t('lyricSelection.noCandidates') }}</p>
        </div>
        <q-list v-else class="scroll lyric-list">
          <q-item
            v-for="(option, index) in lyricOptionList"
            :key="option.hash || index"
            clickable
            v-ripple
            :disable="updatingSelection"
            :active="activeSelectedHash === option.hash"
            active-class="lyric-row--active"
            class="lyric-row lyric-option-item"
            @click="selectLyricOption(option)"
          >
            <q-item-section>
              <q-item-label class="lyric-option-title">{{ $privateText(option.title) }}</q-item-label>
              <q-item-label caption lines="2">{{ $privateText(option.subtitle || $t('lyricSelection.workRoot')) }}</q-item-label>
              <div class="lyric-option-badges">
                <span class="lyric-option-badge lyric-option-badge--accent">{{ subtitleLanguageLabel(option.language) }}</span>
                <span v-if="matchLabel(option.matchLevel)" class="lyric-option-badge">{{ matchLabel(option.matchLevel) }}</span>
              </div>
            </q-item-section>
            <q-item-section v-if="activeSelectedHash === option.hash" side>
              <q-icon name="check" color="primary" size="20px" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </template>

    <!-- Tab 3: 时间校准（普通用户仅本次播放生效；管理员可直接写入服务器字幕全局生效） -->
    <template v-else-if="activeTab === 'sync'">
      <div class="lyric-scope-bar" :class="{ 'lyric-scope-bar--admin': isAdministrator }">
        <q-icon :name="isAdministrator ? 'admin_panel_settings' : 'person_outline'" size="16px" />
        <span class="col">{{ $t(isAdministrator ? 'lyricSelection.adminSyncHint' : 'lyricSelection.sessionOffsetHint') }}</span>
      </div>

      <div class="lyric-body scroll lyric-sync-body">
        <section class="lyric-panel-card">
          <div class="lyric-panel-title">{{ $t('audioPlayer.lyricOffset') }}</div>
          <div class="lyric-stepper">
            <q-btn
              outline
              dense
              no-caps
              class="lyric-stepper-btn"
              label="-0.5s"
              :disable="!hasLyric"
              @click="lyricOffsetChange(lyricOffsetSeconds - 0.5)"
            />
            <q-btn
              outline
              dense
              no-caps
              class="lyric-stepper-btn"
              label="-0.1s"
              :disable="!hasLyric"
              @click="lyricOffsetChange(lyricOffsetSeconds - 0.1)"
            />
            <button
              type="button"
              class="lyric-stepper-value"
              :class="{ 'is-nonzero': lyricOffsetSeconds !== 0 }"
              :disabled="!hasLyric || lyricOffsetSeconds === 0"
              :aria-label="$t('lyricSelection.resetOffset')"
              @click="lyricOffsetChange(0)"
            >
              <span>{{ formattedOffset }}</span>
              <AppTooltip v-if="lyricOffsetSeconds !== 0">{{ $t('lyricSelection.resetOffset') }}</AppTooltip>
            </button>
            <q-btn
              outline
              dense
              no-caps
              class="lyric-stepper-btn"
              label="+0.1s"
              :disable="!hasLyric"
              @click="lyricOffsetChange(lyricOffsetSeconds + 0.1)"
            />
            <q-btn
              outline
              dense
              no-caps
              class="lyric-stepper-btn"
              label="+0.5s"
              :disable="!hasLyric"
              @click="lyricOffsetChange(lyricOffsetSeconds + 0.5)"
            />
          </div>

          <div v-if="isAdministrator && lyricOffsetSeconds !== 0 && lyricLines.length > 0" class="lyric-global-offset-action">
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="save"
              class="full-width"
              :loading="saving"
              :label="$t('lyricSelection.saveOffsetGlobally', { value: formattedOffsetNumber })"
              @click="saveOffsetGlobally"
            />
          </div>
        </section>

        <section class="lyric-panel-card">
          <div class="lyric-panel-title">{{ $t('audioPlayer.syncTool') }}</div>
          <p class="lyric-sync-instructions">{{ $t('audioPlayer.syncInstructions') }}</p>

          <div v-if="fixState === 'ready'" class="lyric-sync-actions">
            <q-btn outline no-caps color="primary" :disable="!hasLyric" @click="startFixLyricSync('lyric')">
              {{ $t('audioPlayer.lyricsFirst') }}
            </q-btn>
            <q-btn outline no-caps color="primary" :disable="!hasLyric" @click="startFixLyricSync('audio')">
              {{ $t('audioPlayer.audioFirst') }}
            </q-btn>
          </div>

          <div v-else-if="fixState === 'measure'" class="lyric-sync-actions lyric-sync-actions--single">
            <q-btn unelevated no-caps color="primary" @click="stopFixLyricSync">
              {{ fixWhoStartFirst === 'audio' ? $t('audioPlayer.lyricsNow') : $t('audioPlayer.audioNow') }}
            </q-btn>
            <q-btn flat no-caps class="lyric-muted-btn" @click="fixState = 'ready'">
              {{ $t('common.cancel') }}
            </q-btn>
          </div>

          <div v-else class="lyric-sync-actions">
            <q-btn outline no-caps color="primary" @click="fixState = 'ready'">
              {{ $t('audioPlayer.measureAgain') }}
            </q-btn>
            <q-btn unelevated no-caps color="primary" @click="fixApply">
              {{ $t('audioPlayer.applyOffset', { showDeltaSeconds }) }}
            </q-btn>
          </div>
        </section>
      </div>
    </template>

    <!-- 底部微型播放控制条：带顶部细进度条，无需关闭弹窗即可播控并实时对轨 -->
    <template v-if="currentPlayingFile.hash">
      <div class="lyric-player-footer">
        <div class="lyric-player-progress" aria-hidden="true">
          <div class="lyric-player-progress__fill" :style="{ width: `${playbackProgressPercent}%` }" />
        </div>
        <div class="lyric-player-controls">
          <q-btn
            flat
            round
            dense
            :icon="rewindIcon"
            class="lyric-player-btn"
            :aria-label="$t('audioPlayer.rewind')"
            @click="rewind(true)"
          >
            <AppTooltip>{{ $t('audioPlayer.rewind') }}</AppTooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            :icon="playing ? 'pause' : 'play_arrow'"
            class="lyric-player-btn lyric-player-btn--main"
            :aria-label="$t('audioPlayer.playPause')"
            @click="togglePlaying()"
          >
            <AppTooltip>{{ $t('audioPlayer.playPause') }}</AppTooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            :icon="forwardIcon"
            class="lyric-player-btn"
            :aria-label="$t('audioPlayer.fastForward')"
            @click="forward(true)"
          >
            <AppTooltip>{{ $t('audioPlayer.fastForward') }}</AppTooltip>
          </q-btn>
        </div>
        <div class="lyric-player-live ellipsis">
          {{ currentLyric || $privateText(currentPlayingFile.title) }}
        </div>
        <div class="lyric-player-time">
          {{ formatSeconds(currentTime) }} / {{ formatSeconds(duration) }}
        </div>
      </div>
    </template>
  </q-card>
  <q-card v-else class="q-pa-md row items-center justify-between">
    <span><q-icon name="visibility_off" class="q-mr-sm" />{{ $t('privacy.hidden') }}</span>
    <q-btn v-close-popup flat round dense icon="close" :aria-label="$t('common.close')" />
  </q-card>
</template>

<script>
import { appDialog } from '../utils/appDialog'
import { t } from '../i18n'
import { mapGetters, mapMutations, mapState } from 'vuex'
import { formatSeconds, ServerApi } from 'src/utils'
import NotifyMixin from '../mixins/Notification.js'
import { subtitleLanguageLabel } from '../preferenceOptions'

export default {
  name: 'LyricSelection',

  mixins: [NotifyMixin],

  data () {
    return {
      activeTab: 'lines',
      autoTrackCurrentLine: true,

      // 候选文件列表
      lyricOptionList: [],
      globalSelectedHash: null,
      globalDisabled: false,
      optionsLoadedKey: '',
      loadingOptions: false,
      updatingSelection: false,

      // 同步测速工具
      fixState: 'ready', // ready | measure | done
      fixWhoStartFirst: '', // 'audio' | 'lyric'
      fixStartMills: 0,
      fixStopMills: 0,

      // 管理员编辑模式（内嵌在歌词列表 Tab）
      isEditingLyrics: false,
      editingIndex: -1,
      editLyricText: '',
      editStartSeconds: 0,
      editEndSeconds: null,
      saving: false,
    }
  },

  computed: {
    ...mapState('AudioPlayer', [
      'playing',
      'currentTime',
      'duration',
      'rewindSeekTime',
      'forwardSeekTime',
      'currentLyric',
      'currentLyricLineNumber',
      'hasLyric',
      'lyricLines',
      'lyricRequestId',
      'lyricOffsetSeconds',
      'playWorkId',
      'defaultSubtitleLanguage',
    ]),

    ...mapGetters('AudioPlayer', [
      'currentPlayingFile',
      'lyricSelectionKey',
    ]),

    isAdministrator () {
      return this.$store.state.User.canManage === true
    },

    localSelectedValue () {
      return this.lyricSelectionKey ? this.$q.localStorage.getItem(this.lyricSelectionKey) : null
    },

    activeSelectedHash () {
      if (this.isAdministrator) return this.globalSelectedHash
      return this.localSelectedValue && this.localSelectedValue !== '__disabled__' ? this.localSelectedValue : this.globalSelectedHash
    },

    activeDisabled () {
      if (this.isAdministrator) return this.globalDisabled
      return this.localSelectedValue === '__disabled__' || this.globalDisabled
    },

    formattedOffsetNumber () {
      const value = Math.round((Number(this.lyricOffsetSeconds) || 0) * 100) / 100
      return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
    },

    formattedOffset () {
      return `${this.formattedOffsetNumber}s`
    },

    fixDeltaMills () {
      const sign = this.fixWhoStartFirst === 'audio' ? 1 : -1
      return sign * (this.fixStopMills - this.fixStartMills)
    },

    showDeltaSeconds () {
      if (Math.abs(this.fixDeltaMills) < 1) return ''
      return `${this.fixDeltaMills > 0 ? '+' : ''}${(this.fixDeltaMills / 1000).toFixed(2)}s`
    },

    rewindIcon () {
      switch (this.rewindSeekTime) {
        case 10: return 'replay_10'
        case 30: return 'replay_30'
        default: return 'replay_5'
      }
    },

    forwardIcon () {
      switch (this.forwardSeekTime) {
        case 10: return 'forward_10'
        case 30: return 'forward_30'
        default: return 'forward_5'
      }
    },

    playbackProgressPercent () {
      if (!this.duration || this.duration <= 0) return 0
      return Math.min(100, Math.max(0, (this.currentTime / this.duration) * 100))
    },
  },

  watch: {
    activeTab (tab) {
      if (tab === 'files' && this.currentPlayingFile.hash && this.optionsLoadedKey !== this.lyricSelectionKey) {
        this.fetchOtherLyricFiles(false)
      }
      if (tab === 'lines' && this.autoTrackCurrentLine && !this.isEditingLyrics) {
        this.$nextTick(this.showCurrentLyric)
      }
      if (tab !== 'lines') {
        this.editingIndex = -1
      }
      if (tab !== 'sync') {
        this.fixState = 'ready'
      }
    },

    isAdministrator (allowed) {
      if (!allowed) {
        this.isEditingLyrics = false
        this.editingIndex = -1
      }
    },

    currentLyricLineNumber () {
      if (this.activeTab === 'lines' && this.autoTrackCurrentLine && !this.isEditingLyrics) {
        this.showCurrentLyric()
      }
    },

    lyricLines () {
      if (this.activeTab === 'lines' && this.autoTrackCurrentLine && !this.isEditingLyrics) {
        this.$nextTick(this.showCurrentLyric)
      }
    },

    lyricSelectionKey () {
      this.lyricOptionList = []
      this.globalSelectedHash = null
      this.globalDisabled = false
      this.optionsLoadedKey = ''
      this.isEditingLyrics = false
      this.editingIndex = -1
      this.fixState = 'ready'
      if (this.activeTab === 'files' && this.currentPlayingFile.hash) {
        this.fetchOtherLyricFiles(true)
      } else if (this.activeTab === 'lines') {
        this.$nextTick(this.showCurrentLyric)
      }
    },
  },

  methods: {
    formatSeconds,
    subtitleLanguageLabel,

    ...mapMutations('AudioPlayer', {
      togglePlaying: 'TOGGLE_PLAYING',
      rewind: 'SET_REWIND_SEEK_MODE',
      forward: 'SET_FORWARD_SEEK_MODE',
    }),

    ...mapMutations('AudioPlayer', [
      'SET_CURRENT_LYRIC',
      'SET_CURRENT_LYRIC_LINE_NUMBER',
      'SET_HAS_LYRIC',
      'SET_LYRIC_LINES',
      'SET_LYRIC_OFFSET_SECONDS',
      'INVALIDATE_LYRIC_REQUESTS',
      'REQUEST_MANUAL_SEEK',
    ]),

    cloneLyricLines () {
      return this.lyricLines.map(line => ({ ...line }))
    },

    hasExplicitEnd (line) {
      return line.timeEnd != null && line.timeEnd >= 0
    },

    matchLabel (value) {
      const level = Number(value)
      if (!Number.isFinite(level) || level < 0) return ''
      if (level < 1) return t('lyricSelection.exactMatch')
      if (level < 2) return t('lyricSelection.highMatch')
      return t('lyricSelection.nearMatch')
    },

    showCurrentLyric () {
      const element = document.getElementById('lyric_line_' + this.currentLyricLineNumber)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }
    },

    seekToLine (line) {
      this.REQUEST_MANUAL_SEEK({ seconds: Math.max(0, Number(line.time) || 0) / 1000 })
    },

    toggleEditMode () {
      this.isEditingLyrics = !this.isEditingLyrics
      if (!this.isEditingLyrics) {
        this.editingIndex = -1
      }
    },

    lyricOffsetChange (seconds) {
      if (seconds == null || !Number.isFinite(Number(seconds))) seconds = 0
      const rounded = Math.round(Number(seconds) * 10000) / 10000
      this.SET_LYRIC_OFFSET_SECONDS(rounded)
    },

    startFixLyricSync (whoStartFirst) {
      this.fixState = 'measure'
      this.fixWhoStartFirst = whoStartFirst
      this.fixStartMills = this.fixStopMills = performance.now()
    },

    stopFixLyricSync () {
      this.fixState = 'done'
      this.fixStopMills = performance.now()
    },

    fixApply () {
      const deltaSeconds = Math.round((this.fixDeltaMills / 1000) * 100) / 100
      this.lyricOffsetChange(deltaSeconds)
      this.fixState = 'ready'
      this.$q.notify({ message: t('audioPlayer.offsetApplied', { value: deltaSeconds }), timeout: 1200 })
    },

    buildOffsetBakedLines () {
      const offsetMs = Math.round((Number(this.lyricOffsetSeconds) || 0) * 1000)
      if (!offsetMs) return this.cloneLyricLines()
      const lines = this.cloneLyricLines().map(line => {
        const next = { ...line, time: Math.max(0, (Number(line.time) || 0) - offsetMs) }
        if (this.hasExplicitEnd(next)) {
          next.timeEnd = Math.max(next.time, Number(next.timeEnd) - offsetMs)
        }
        return next
      })
      lines.sort((left, right) => left.time - right.time)
      return lines
    },

    saveOffsetGlobally () {
      if (!this.isAdministrator || !this.lyricOffsetSeconds || this.lyricLines.length === 0) return
      const shiftedLines = this.buildOffsetBakedLines()
      this.saveLyrics(shiftedLines, { resetOffset: true })
    },

    toggleInlineEditor (index) {
      if (this.editingIndex === index) {
        this.editingIndex = -1
        return
      }
      const line = this.lyricLines[index]
      if (!line) return
      this.editingIndex = index
      this.editLyricText = String(line.text || '')
      this.editStartSeconds = Math.max(0, Number(line.time) || 0) / 1000
      this.editEndSeconds = this.hasExplicitEnd(line) ? Number(line.timeEnd) / 1000 : null
    },

    confirmLyricChange () {
      const startSeconds = Number(this.editStartSeconds)
      const endSeconds = this.editEndSeconds === null || this.editEndSeconds === ''
        ? null
        : Number(this.editEndSeconds)
      if (!Number.isFinite(startSeconds) || startSeconds < 0) {
        this.showErrNotif(t('lyricSelection.invalidStart'))
        return
      }
      if (endSeconds !== null && (!Number.isFinite(endSeconds) || endSeconds < startSeconds)) {
        this.showErrNotif(t('lyricSelection.invalidEnd'))
        return
      }

      const lines = this.cloneLyricLines()
      const line = lines[this.editingIndex]
      if (!line) return
      line.text = this.editLyricText
      line.time = Math.round(startSeconds * 1000)
      if (endSeconds === null) {
        delete line.timeEnd
      } else {
        line.timeEnd = Math.round(endSeconds * 1000)
      }
      lines.sort((left, right) => left.time - right.time)
      this.SET_LYRIC_LINES(lines)
      this.editingIndex = -1
    },

    deleteLyricLine (index) {
      const lines = this.cloneLyricLines()
      if (!lines[index]) return
      lines[index].deleted = true
      this.SET_LYRIC_LINES(lines)
    },

    recoverDeletedLyricLine (index) {
      const lines = this.cloneLyricLines()
      if (!lines[index]) return
      delete lines[index].deleted
      this.SET_LYRIC_LINES(lines)
    },

    defaultWritePath () {
      const subtitle = this.currentPlayingFile.subtitle
        ? String(this.currentPlayingFile.subtitle).replace(/\\/g, '/') + '/'
        : ''
      return subtitle + this.currentPlayingFile.title + '.vtt'
    },

    saveLyrics (sourceLines = null, { resetOffset = false } = {}) {
      if (!this.isAdministrator) {
        this.showErrNotif(t('lyricSelection.adminRequired'))
        return
      }
      const defaultPath = this.defaultWritePath()
      appDialog(this.$q, {
        title: t('lyricSelection.saveFile'),
        message: t('lyricSelection.savePathPrompt'),
        prompt: {
          model: defaultPath,
          isValid: value => typeof value === 'string' && value.toLowerCase().endsWith('.vtt'),
          type: 'text',
        },
        cancel: true,
        persistent: true,
      }).onOk(async writePath => {
        this.saving = true
        try {
          const baseLines = Array.isArray(sourceLines) ? sourceLines : this.lyricLines
          const lines = baseLines
            .filter(line => !line.deleted)
            .map(line => ({ ...line }))
            .sort((left, right) => left.time - right.time)
          if (lines.length === 0) {
            throw new Error(t('lyricSelection.noLines'))
          }
          await ServerApi.saveLyric(this.playWorkId, writePath, lines)
          this.SET_LYRIC_LINES(lines)
          if (resetOffset) this.SET_LYRIC_OFFSET_SECONDS(0)
          this.editingIndex = -1
          this.showSuccNotif(t('lyricSelection.saved'))
        } catch (error) {
          this.showErrNotif(this.errorMessage(error))
        } finally {
          this.saving = false
        }
      })
    },

    async fetchOtherLyricFiles (force = false) {
      const key = this.lyricSelectionKey
      if (!this.currentPlayingFile.hash) return
      if (!force && this.optionsLoadedKey === key) return
      this.loadingOptions = true
      try {
        const result = await ServerApi.queryLyricDetails(this.currentPlayingFile.hash, this.defaultSubtitleLanguage)
        if (key !== this.lyricSelectionKey) return
        this.lyricOptionList = result.lyricList.slice()
        this.globalSelectedHash = result.globalSelectedHash
        this.globalDisabled = result.globalDisabled
        this.optionsLoadedKey = key
      } catch (error) {
        if (key === this.lyricSelectionKey) this.showErrNotif(this.errorMessage(error))
      } finally {
        this.loadingOptions = false
      }
    },

    async selectLyricOption (option) {
      const key = this.lyricSelectionKey
      if (!key) return
      this.INVALIDATE_LYRIC_REQUESTS()
      const requestId = this.lyricRequestId
      const isCurrentRequest = () => requestId === this.lyricRequestId && key === this.lyricSelectionKey
      this.updatingSelection = true
      try {
        if (this.isAdministrator) {
          await ServerApi.selectGlobalLyric(this.currentPlayingFile.hash, option.hash)
          if (!isCurrentRequest()) return
          this.$q.localStorage.remove(key)
          this.globalSelectedHash = option.hash
          this.globalDisabled = false
        }
        const lines = await ServerApi.fetchLyric(option.hash)
        if (!isCurrentRequest()) return
        if (!this.isAdministrator) {
          this.$q.localStorage.set(key, option.hash)
        }
        this.SET_LYRIC_LINES(lines)
        this.SET_HAS_LYRIC(lines.length > 0)
        this.SET_CURRENT_LYRIC_LINE_NUMBER(0)
        if (this.isAdministrator) {
          this.showSuccNotif(t('lyricSelection.globalLyricUpdated'))
        }
        this.activeTab = 'lines'
      } catch (error) {
        if (isCurrentRequest()) this.showErrNotif(this.errorMessage(error))
      } finally {
        this.updatingSelection = false
      }
    },

    async closeLyric () {
      const key = this.lyricSelectionKey
      this.INVALIDATE_LYRIC_REQUESTS()
      this.updatingSelection = true
      try {
        if (this.isAdministrator && this.currentPlayingFile.hash) {
          await ServerApi.selectGlobalLyric(this.currentPlayingFile.hash, null)
          if (key) this.$q.localStorage.remove(key)
          this.globalSelectedHash = null
          this.globalDisabled = true
          this.showSuccNotif(t('lyricSelection.globalLyricDisabled'))
        } else if (key) {
          this.$q.localStorage.set(key, '__disabled__')
        }
        this.SET_HAS_LYRIC(false)
        this.SET_CURRENT_LYRIC('')
        this.SET_CURRENT_LYRIC_LINE_NUMBER(0)
        this.SET_LYRIC_LINES([])
      } catch (error) {
        this.showErrNotif(this.errorMessage(error))
      } finally {
        this.updatingSelection = false
      }
    },

    errorMessage (error) {
      if (error && error.response) {
        return error.response.data.error || (error.response.status + ' ' + error.response.statusText)
      }
      return error && error.message ? error.message : String(error)
    },
  },
}
</script>

<style lang="scss" scoped>
.lyric-selection {
  width: min(760px, 94vw);
  max-width: 94vw;
  height: min(680px, 84dvh);
  max-height: 84dvh;
  display: flex;
  flex-direction: column;
  background: var(--kikoeru-surface);
  color: var(--kikoeru-text);
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  overflow: hidden;
}

.lyric-header {
  gap: 12px;
  padding: 16px 18px 12px;
}

.lyric-header-copy {
  min-width: 0;
}

.lyric-header-title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
}

.lyric-header-track {
  margin-top: 3px;
  font-size: 12.5px;
  color: var(--kikoeru-muted);
}

.lyric-close-btn {
  color: var(--kikoeru-muted);
}

.lyric-tabs-wrap {
  padding: 0 18px 10px;
}

.lyric-segmented-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
}

.lyric-seg-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--kikoeru-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, color 0.15s ease;

  &:hover {
    color: var(--kikoeru-text);
  }

  &.is-active {
    background: var(--kikoeru-surface-elevated);
    color: var(--kikoeru-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
  }
}

.lyric-scope-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 18px 8px;
  padding: 8px 12px;
  border-radius: var(--kikoeru-radius-sm);
  font-size: 12px;
  line-height: 1.45;
  color: var(--kikoeru-muted);
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
}

.lyric-scope-bar--admin {
  color: var(--kikoeru-accent-text);
  background: var(--kikoeru-active-bg);
  border-color: color-mix(in srgb, var(--q-primary) 28%, transparent);
}

.lyric-subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 4px 18px 10px;
  flex-shrink: 0;
}

.lyric-subbar--wrap {
  flex-wrap: wrap;
}

.lyric-auto-track {
  font-size: 13px;
  color: var(--kikoeru-muted);
}

.lyric-subbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}

.lyric-neutral-btn {
  min-height: 32px;
  padding: 0 10px;
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-text);
  font-size: 12.5px;

  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--kikoeru-text) 24%, transparent);
  }
}

.lyric-neutral-btn--active {
  background: var(--kikoeru-active-bg);
  border-color: color-mix(in srgb, var(--q-primary) 38%, transparent);
  color: var(--kikoeru-accent-text);
}

.lyric-primary-btn,
.lyric-danger-btn {
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--kikoeru-radius-sm);
  font-size: 12.5px;
}

.lyric-body {
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.lyric-list {
  flex: 1 1 auto;
  min-height: 0;
  padding: 4px 10px 10px;
  scrollbar-color: rgba(127, 127, 127, .45) transparent;
  scrollbar-width: thin;
}

.lyric-list::-webkit-scrollbar {
  width: 6px;
}

.lyric-list::-webkit-scrollbar-track {
  background: transparent;
}

.lyric-list::-webkit-scrollbar-thumb {
  background: rgba(127, 127, 127, .35);
  border-radius: 999px;
}

.lyric-row {
  position: relative;
  min-height: 46px;
  padding: 8px 12px;
  margin-bottom: 2px;
  border-radius: var(--kikoeru-radius-sm);
  transition: background-color 0.14s ease;

  &:hover {
    background: var(--kikoeru-inset);
  }
}

.lyric-row--active {
  background: var(--kikoeru-active-bg) !important;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--q-primary);
  }

  .lyric-time-start,
  .lyric-line-text {
    color: var(--kikoeru-accent-text);
    font-weight: 500;
  }
}

.lyric-empty {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 36px 20px;
  text-align: center;
  color: var(--kikoeru-muted);

  p {
    margin: 0;
    max-width: 380px;
    font-size: 13.5px;
    line-height: 1.6;
  }
}

.lyric-muted {
  color: var(--kikoeru-muted);
}

.lyric-muted-btn {
  color: var(--kikoeru-muted);
}

.lyric-time-col {
  min-width: 56px;
  padding-right: 12px;
  align-items: flex-end;
  justify-content: center;
}

.lyric-time-start {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  color: var(--kikoeru-muted);
  line-height: 1.3;
}

.lyric-time-end {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--kikoeru-muted);
  opacity: 0.55;
  line-height: 1.25;
}

.lyric-line-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--kikoeru-text);
}

.lyric-option-item {
  padding: 10px 12px;
}

.lyric-option-title {
  font-weight: 500;
  overflow-wrap: anywhere;
}

.lyric-option-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.lyric-option-badge {
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--kikoeru-border);
  background: var(--kikoeru-inset);
  color: var(--kikoeru-muted);
  font-size: 11.5px;
}

.lyric-option-badge--accent {
  border-color: transparent;
  background: var(--kikoeru-active-bg);
  color: var(--kikoeru-accent-text);
  font-weight: 500;
}

.lyric-sync-body {
  padding: 16px;
  gap: 14px;
}

.lyric-panel-card {
  padding: 14px 16px;
  border-radius: var(--kikoeru-radius-md);
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
}

.lyric-panel-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.lyric-stepper {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) minmax(76px, 1.2fr) repeat(2, minmax(0, 1fr));
  gap: 6px;
  align-items: stretch;
}

.lyric-stepper-btn {
  min-height: 36px;
  border-radius: var(--kikoeru-radius-sm);
  font-variant-numeric: tabular-nums;
}

.lyric-stepper-value {
  min-height: 36px;
  padding: 0 8px;
  border-radius: var(--kikoeru-radius-sm);
  border: 1px solid var(--kikoeru-border);
  background: var(--kikoeru-surface);
  color: var(--kikoeru-muted);
  font-size: 13.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: default;
  transition: border-color 0.14s ease, color 0.14s ease;

  &.is-nonzero {
    border-color: color-mix(in srgb, var(--q-primary) 45%, transparent);
    color: var(--kikoeru-accent-text);
    cursor: pointer;
  }
}

.lyric-global-offset-action {
  margin-top: 12px;

  .q-btn {
    min-height: 38px;
    border-radius: var(--kikoeru-radius-sm);
  }
}

.lyric-sync-instructions {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--kikoeru-muted);
}

.lyric-sync-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  .q-btn {
    min-height: 38px;
    border-radius: var(--kikoeru-radius-sm);
  }
}

.lyric-sync-actions--single {
  grid-template-columns: minmax(0, 1fr) auto;
}

.lyric-line-deleted {
  color: var(--kikoeru-muted);
  text-decoration: line-through;
  opacity: 0.7;
}

.lyric-inline-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 2px 0 8px;
  padding: 14px;
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
}

.lyric-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.lyric-field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--kikoeru-muted);
  line-height: 1.2;
}

.lyric-clean-input {
  :deep(.q-field__control) {
    border-radius: var(--kikoeru-radius-sm);
    background: var(--kikoeru-surface);
  }
}

.lyric-inline-times {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.lyric-inline-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.lyric-player-footer {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  background: var(--kikoeru-surface-elevated);
  border-top: 1px solid var(--kikoeru-border);
  flex-shrink: 0;
}

.lyric-player-progress {
  position: absolute;
  left: 0;
  right: 0;
  top: -1px;
  height: 2px;
  background: transparent;
  pointer-events: none;
}

.lyric-player-progress__fill {
  height: 100%;
  background: var(--q-primary);
  transition: width 0.25s linear;
}

.lyric-player-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.lyric-player-btn {
  width: 34px;
  height: 34px;
  color: var(--kikoeru-muted);
  transition: color 0.14s ease, background-color 0.14s ease;

  &:hover {
    color: var(--kikoeru-text);
  }

  :deep(.q-icon) {
    font-size: 20px;
  }
}

.lyric-player-btn--main {
  width: 36px;
  height: 36px;
  color: var(--kikoeru-text);
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);

  &:hover {
    background: var(--kikoeru-active-bg);
    color: var(--kikoeru-accent-text);
    border-color: color-mix(in srgb, var(--q-primary) 35%, transparent);
  }

  :deep(.q-icon) {
    font-size: 22px;
  }
}

.lyric-player-live {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 13px;
  font-weight: 500;
  color: var(--kikoeru-text);
  line-height: 1.35;
}

.lyric-player-time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--kikoeru-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (max-width: 599px) {
  .lyric-selection {
    width: 100vw;
    max-width: 100vw;
    height: 88dvh;
    max-height: 88dvh;
  }

  .lyric-header {
    padding: 12px 14px 8px;
  }

  .lyric-tabs-wrap {
    padding: 0 12px 8px;
  }

  .lyric-seg-tab {
    font-size: 12.5px;
    padding: 0 6px;
    gap: 4px;
  }

  .lyric-scope-bar {
    margin: 0 12px 8px;
  }

  .lyric-subbar {
    padding: 4px 12px 8px;
  }

  .lyric-subbar-actions {
    width: 100%;
    margin-left: 0;
  }

  .lyric-subbar--wrap .lyric-neutral-btn,
  .lyric-subbar--wrap .lyric-primary-btn,
  .lyric-subbar--wrap .lyric-danger-btn {
    flex: 1 1 auto;
  }

  .lyric-player-footer {
    padding: 8px 12px;
    gap: 8px;
  }

  .lyric-sync-body {
    padding: 12px;
  }

  .lyric-stepper {
    grid-template-columns: repeat(2, minmax(0, 1fr)) minmax(66px, 1fr) repeat(2, minmax(0, 1fr));
    gap: 4px;
  }

  .lyric-sync-actions {
    grid-template-columns: minmax(0, 1fr);
  }

  .lyric-sync-actions--single {
    grid-template-columns: minmax(0, 1fr);
  }

  .lyric-inline-times {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
