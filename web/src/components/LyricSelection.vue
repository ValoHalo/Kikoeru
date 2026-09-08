<template>
  <q-card class="lyric-selection">
    <q-card-section class="row no-wrap items-start lyric-header">
      <div class="col lyric-header-copy">
        <div class="text-h5">{{ $t('lyricSelection.title') }}</div>
        <div class="text-caption text-grey-7 ellipsis">{{ currentPlayingFile.title || $t('lyricSelection.noTrack') }}</div>
      </div>
      <q-btn v-close-popup flat round class="col-auto" icon="close" :aria-label="$t('lyricSelection.close')" @click="isEditingLyrics = false" />
    </q-card-section>

    <q-separator />

    <q-card-section class="row items-center lyric-actions">
      <q-btn
        v-if="isAdministrator"
        color="primary"
        :icon="isEditingLyrics ? 'edit_off' : 'edit'"
        :label="$q.screen.lt.sm ? undefined : (isEditingLyrics ? $t('lyricSelection.exitEdit') : $t('lyricSelection.edit'))"
        :round="$q.screen.lt.sm"
        :aria-label="isEditingLyrics ? $t('lyricSelection.exitEditing') : $t('lyricSelection.edit')"
        @click="isEditingLyrics = !isEditingLyrics"
      />
      <q-btn
        v-if="isEditingLyrics"
        color="warning"
        icon="save"
        :label="$q.screen.lt.sm ? undefined : $t('lyricSelection.save')"
        :round="$q.screen.lt.sm"
        :aria-label="$t('lyricSelection.save')"
        :disable="!isAdministrator || lyricLines.length === 0"
        :loading="saving"
        @click="saveLyrics"
      />
      <q-btn
        v-if="!isEditingLyrics"
        color="secondary"
        icon="library_music"
        :label="$q.screen.lt.sm ? undefined : $t('lyricSelection.selectOther')"
        :round="$q.screen.lt.sm"
        :aria-label="$t('lyricSelection.selectOther')"
        :disable="!currentPlayingFile.hash"
        :loading="loadingOptions"
        @click="fetchOtherLyricFiles"
      />
      <q-btn
        v-if="!isEditingLyrics"
        color="negative"
        icon="subtitles_off"
        :label="$q.screen.lt.sm ? undefined : $t('lyricSelection.disable')"
        :round="$q.screen.lt.sm"
        :aria-label="$t('lyricSelection.disable')"
        :disable="!hasLyric"
        @click="closeLyric"
      />
      <q-btn
        v-if="!isEditingLyrics"
        color="primary"
        icon="my_location"
        :label="$q.screen.lt.sm ? undefined : $t('lyricSelection.currentLine')"
        :round="$q.screen.lt.sm"
        :aria-label="$t('lyricSelection.currentLine')"
        @click="showCurrentLyric"
      />
      <q-btn
        v-if="isEditingLyrics"
        outline
        color="primary"
        icon="timer"
        :label="$q.screen.lt.sm ? undefined : $t('lyricSelection.setLineEnd')"
        :round="$q.screen.lt.sm"
        :aria-label="$t('lyricSelection.setLineEnd')"
        :disable="!isAdministrator || lyricLines.length === 0"
        @click="setCurrentLineEndTime"
      />
      <q-toggle v-if="!isEditingLyrics" class="lyric-auto-track" v-model="autoTrackCurrentLine" :label="$t('lyricSelection.autoFollow')" />
      <div v-if="!isAdministrator" class="text-caption text-grey-7">{{ $t('lyricSelection.permissionHint') }}</div>
    </q-card-section>

    <q-separator />

    <q-card-section class="lyric-list-container">
      <div v-if="lyricLines.length === 0" class="text-grey-7 text-center q-pa-xl">{{ $t('lyricSelection.noLyrics') }}</div>
      <q-list v-else separator class="scroll lyric-list">
        <q-item
          v-for="(line, index) in lyricLines"
          :id="'lyric_line_' + index"
          :key="index"
          clickable
          v-ripple
          :active="index === currentLyricLineNumber"
          active-class="bg-green-2 text-dark"
          @click="seekToLine(line)"
        >
          <q-item-section side>
            <q-chip size="sm" color="primary" text-color="white">
              {{ formatSeconds(line.time / 1000, true) }}
            </q-chip>
            <div v-if="hasExplicitEnd(line)" class="text-caption">{{ $t('lyricSelection.until', { value: formatSeconds(line.timeEnd / 1000, true) }) }}
            </div>
          </q-item-section>

          <q-item-section>
            <q-item-label :class="{ 'lyric-line-deleted': line.deleted }">
              {{ line.text }}
            </q-item-label>
          </q-item-section>

          <q-item-section v-if="isAdministrator && isEditingLyrics" side>
            <div class="row no-wrap q-gutter-xs">
              <q-btn flat round dense icon="edit" color="primary" @click.stop="openLineEditor(index)">
                <q-tooltip>{{ $t('lyricSelection.editLine') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="!line.deleted"
                flat
                round
                dense
                icon="delete"
                color="negative"
                @click.stop="deleteLyricLine(index)"
              >
                <q-tooltip>{{ $t('lyricSelection.deleteLine') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-else
                flat
                round
                dense
                icon="restore"
                color="positive"
                @click.stop="recoverDeletedLyricLine(index)"
              >
                <q-tooltip>{{ $t('lyricSelection.restoreLine') }}</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <q-dialog v-model="openLyricFileSelection">
      <q-card class="lyric-option-card">
        <q-card-section class="row items-center justify-between">
          <div class="text-h5">{{ $t('lyricSelection.selectFile') }}</div>
          <q-btn v-close-popup flat round icon="close" />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div v-if="lyricOptionList.length === 0" class="text-grey-7 text-center q-pa-lg">{{ $t('lyricSelection.noCandidates') }}</div>
          <q-list v-else separator class="scroll lyric-option-list">
            <q-item
              v-for="(option, index) in lyricOptionList"
              :key="index"
              clickable
              v-ripple
              @click="selectLyricOption(option)"
            >
              <q-item-section>
                <q-item-label>{{ option.title }}</q-item-label>
                <q-item-label caption lines="2">{{ option.subtitle || $t('lyricSelection.workRoot') }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-xs">
                  <q-chip dense color="primary" text-color="white">{{ subtitleLanguageLabel(option.language) }}</q-chip>
                  <q-chip dense outline color="grey-7">{{ $t('lyricSelection.match', { value: formatMatchLevel(option.matchLevel) }) }}</q-chip>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="openEditor">
      <q-card class="lyric-editor-card">
        <q-card-section class="text-h6">{{ $t('lyricSelection.editLineTitle') }}</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="editLyricText" outlined autogrow :label="$t('lyricSelection.text')" />
          <q-input
            v-model.number="editStartSeconds"
            outlined
            type="number"
            step="0.001"
            min="0"
            :label="$t('lyricSelection.startTime')"
          />
          <q-input
            v-model.number="editEndSeconds"
            outlined
            type="number"
            step="0.001"
            min="0"
            clearable
            :label="$t('lyricSelection.endTime')"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat :label="$t('common.cancel')" />
          <q-btn color="primary" :label="$t('lyricSelection.apply')" @click="confirmLyricChange" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script>
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
      autoTrackCurrentLine: true,
      isEditingLyrics: false,
      openEditor: false,
      editLyricLineNumber: 0,
      editLyricText: '',
      editStartSeconds: 0,
      editEndSeconds: null,
      openLyricFileSelection: false,
      lyricOptionList: [],
      loadingOptions: false,
      saving: false,
    }
  },

  computed: {
    ...mapState('AudioPlayer', [
      'currentTime',
      'currentLyricLineNumber',
      'hasLyric',
      'lyricLines',
      'playWorkId',
      'defaultSubtitleLanguage',
    ]),

    ...mapGetters('AudioPlayer', [
      'currentPlayingFile',
    ]),

    isAdministrator () {
      return this.$store.state.User.canManage === true
    },
  },

  watch: {
    currentLyricLineNumber () {
      if (this.autoTrackCurrentLine) {
        this.showCurrentLyric()
      }
    },

    lyricLines () {
      if (this.autoTrackCurrentLine) {
        this.$nextTick(this.showCurrentLyric)
      }
    },

    'currentPlayingFile.hash' () {
      this.lyricOptionList = []
      this.openLyricFileSelection = false
      this.$nextTick(this.showCurrentLyric)
    },
  },

  methods: {
    formatSeconds,
    subtitleLanguageLabel,

    ...mapMutations('AudioPlayer', [
      'SET_CURRENT_LYRIC',
      'SET_CURRENT_LYRIC_LINE_NUMBER',
      'SET_HAS_LYRIC',
      'SET_LYRIC_LINES',
      'SET_NEW_CURRENT_TIME',
    ]),

    cloneLyricLines () {
      return this.lyricLines.map(line => ({ ...line }))
    },

    hasExplicitEnd (line) {
      return Number.isFinite(Number(line.timeEnd)) && Number(line.timeEnd) >= 0
    },

    formatMatchLevel (value) {
      const level = Number(value)
      return Number.isFinite(level) ? level.toFixed(2) : '-'
    },

    showCurrentLyric () {
      const element = document.getElementById('lyric_line_' + this.currentLyricLineNumber)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }
    },

    seekToLine (line) {
      this.SET_NEW_CURRENT_TIME(Math.max(0, Number(line.time) || 0) / 1000)
    },

    openLineEditor (index) {
      const line = this.lyricLines[index]
      if (!line) return
      this.editLyricLineNumber = index
      this.editLyricText = String(line.text || '')
      this.editStartSeconds = Math.max(0, Number(line.time) || 0) / 1000
      this.editEndSeconds = this.hasExplicitEnd(line) ? Number(line.timeEnd) / 1000 : null
      this.openEditor = true
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
      const line = lines[this.editLyricLineNumber]
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
      this.openEditor = false
    },

    setCurrentLineEndTime () {
      const lines = this.cloneLyricLines()
      const line = lines[this.currentLyricLineNumber]
      if (!line) return
      const endTime = Math.round(this.currentTime * 1000)
      if (endTime < Number(line.time)) {
        this.showErrNotif(t('lyricSelection.playbackBeforeStart'))
        return
      }
      line.timeEnd = endTime
      this.SET_LYRIC_LINES(lines)
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

    saveLyrics () {
      if (!this.isAdministrator) {
        this.showErrNotif(t('lyricSelection.adminRequired'))
        return
      }
      const defaultPath = this.defaultWritePath()
      this.$q.dialog({
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
          const lines = this.lyricLines
            .filter(line => !line.deleted)
            .map(line => ({ ...line }))
            .sort((left, right) => left.time - right.time)
          if (lines.length === 0) {
            throw new Error(t('lyricSelection.noLines'))
          }
          await ServerApi.saveLyric(this.playWorkId, writePath, lines)
          this.SET_LYRIC_LINES(lines)
          this.showSuccNotif(t('lyricSelection.saved'))
        } catch (error) {
          this.showErrNotif(this.errorMessage(error))
        } finally {
          this.saving = false
        }
      })
    },

    async fetchOtherLyricFiles () {
      this.loadingOptions = true
      try {
        const options = await ServerApi.queryLyric(this.currentPlayingFile.hash, this.defaultSubtitleLanguage)
        this.lyricOptionList = options.slice()
        this.openLyricFileSelection = true
      } catch (error) {
        this.showErrNotif(this.errorMessage(error))
      } finally {
        this.loadingOptions = false
      }
    },

    async selectLyricOption (option) {
      try {
        const lines = await ServerApi.fetchLyric(this.playWorkId, option)
        this.SET_LYRIC_LINES(lines)
        this.SET_HAS_LYRIC(Array.isArray(lines) && lines.length > 0)
        this.SET_CURRENT_LYRIC_LINE_NUMBER(0)
        this.openLyricFileSelection = false
      } catch (error) {
        this.showErrNotif(this.errorMessage(error))
      }
    },

    closeLyric () {
      this.SET_HAS_LYRIC(false)
      this.SET_CURRENT_LYRIC('')
      this.SET_CURRENT_LYRIC_LINE_NUMBER(0)
      this.SET_LYRIC_LINES([])
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

<style scoped>
.lyric-selection {
  width: 90vw;
  max-width: 1100px;
  height: 80vh;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.lyric-actions {
  flex: 0 0 auto;
  gap: 8px;
}

.lyric-header-copy {
  min-width: 0;
}

@media (max-width: 599px) {
  .lyric-actions {
    column-gap: 0;
    justify-content: space-between;
  }

  .lyric-auto-track {
    flex: 0 0 100%;
  }
}

.lyric-list-container {
  min-height: 0;
  flex: 1 1 auto;
}

.lyric-list {
  max-height: 100%;
}

.lyric-line-deleted {
  color: #9e9e9e;
  text-decoration: line-through;
}

.lyric-option-card {
  width: 80vw;
  max-width: 900px;
}

.lyric-option-list {
  max-height: 60vh;
}

.lyric-editor-card {
  width: 90vw;
  max-width: 640px;
}
</style>
