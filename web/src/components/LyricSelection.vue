<template>
  <q-card class="lyric-selection">
    <q-card-section class="row justify-between items-center">
      <div>
        <div class="text-h5">歌词选择</div>
        <div class="text-caption text-grey-7">{{ currentPlayingFile.title || '尚未选择曲目' }}</div>
      </div>
      <q-btn v-close-popup flat round icon="close" />
    </q-card-section>

    <q-separator />

    <q-card-section class="row items-center lyric-actions">
      <q-btn
        color="warning"
        icon="save"
        :label="$q.screen.lt.sm ? undefined : '保存歌词'"
        :round="$q.screen.lt.sm"
        aria-label="保存歌词"
        :disable="!isAdministrator || lyricLines.length === 0"
        :loading="saving"
        @click="saveLyrics"
      />
      <q-btn
        color="secondary"
        icon="library_music"
        :label="$q.screen.lt.sm ? undefined : '选择其他歌词'"
        :round="$q.screen.lt.sm"
        aria-label="选择其他歌词"
        :disable="!currentPlayingFile.hash"
        :loading="loadingOptions"
        @click="fetchOtherLyricFiles"
      />
      <q-btn
        color="negative"
        icon="subtitles_off"
        :label="$q.screen.lt.sm ? undefined : '关闭歌词'"
        :round="$q.screen.lt.sm"
        aria-label="关闭歌词"
        :disable="!hasLyric"
        @click="closeLyric"
      />
      <q-btn
        color="primary"
        icon="my_location"
        :label="$q.screen.lt.sm ? undefined : '转到当前段落'"
        :round="$q.screen.lt.sm"
        aria-label="转到当前段落"
        @click="showCurrentLyric"
      />
      <q-btn
        outline
        color="primary"
        icon="timer"
        :label="$q.screen.lt.sm ? undefined : '以当前播放位置设置本行结束时间'"
        :round="$q.screen.lt.sm"
        aria-label="以当前播放位置设置本行结束时间"
        :disable="!isAdministrator || lyricLines.length === 0"
        @click="setCurrentLineEndTime"
      />
      <q-toggle class="lyric-auto-track" v-model="autoTrackCurrentLine" label="自动跟踪当前歌词" />
      <div v-if="!isAdministrator" class="text-caption text-grey-7">
        当前用户可查看和切换歌词；编辑及保存需要管理员权限。
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section class="lyric-list-container">
      <div v-if="lyricLines.length === 0" class="text-grey-7 text-center q-pa-xl">
        当前曲目没有已加载的歌词。可点击“选择其他歌词”查看候选文件。
      </div>
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
            <div v-if="hasExplicitEnd(line)" class="text-caption">
              至 {{ formatSeconds(line.timeEnd / 1000, true) }}
            </div>
          </q-item-section>

          <q-item-section>
            <q-item-label :class="{ 'lyric-line-deleted': line.deleted }">
              {{ line.text }}
            </q-item-label>
          </q-item-section>

          <q-item-section v-if="isAdministrator" side>
            <div class="row no-wrap q-gutter-xs">
              <q-btn flat round dense icon="edit" color="primary" @click.stop="openLineEditor(index)">
                <q-tooltip>编辑文字和时间</q-tooltip>
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
                <q-tooltip>删除此行（保存后生效）</q-tooltip>
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
                <q-tooltip>恢复此行</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <q-dialog v-model="openLyricFileSelection">
      <q-card class="lyric-option-card">
        <q-card-section class="row items-center justify-between">
          <div class="text-h5">选择其他歌词文件</div>
          <q-btn v-close-popup flat round icon="close" />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div v-if="lyricOptionList.length === 0" class="text-grey-7 text-center q-pa-lg">
            没有找到候选歌词。
          </div>
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
                <q-item-label caption lines="2">{{ option.subtitle || '作品根目录' }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-xs">
                  <q-chip dense color="primary" text-color="white">{{ subtitleLanguageLabel(option.language) }}</q-chip>
                  <q-chip dense outline color="grey-7">匹配 {{ formatMatchLevel(option.matchLevel) }}</q-chip>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="openEditor">
      <q-card class="lyric-editor-card">
        <q-card-section class="text-h6">编辑歌词行</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="editLyricText" outlined autogrow label="歌词文字" />
          <q-input
            v-model.number="editStartSeconds"
            outlined
            type="number"
            step="0.001"
            min="0"
            label="开始时间（秒）"
          />
          <q-input
            v-model.number="editEndSeconds"
            outlined
            type="number"
            step="0.001"
            min="0"
            clearable
            label="结束时间（秒，留空则自动衔接下一行）"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat label="取消" />
          <q-btn color="primary" label="应用" @click="confirmLyricChange" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script>
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
        this.showErrNotif('开始时间必须是非负数')
        return
      }
      if (endSeconds !== null && (!Number.isFinite(endSeconds) || endSeconds < startSeconds)) {
        this.showErrNotif('结束时间必须不早于开始时间')
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
        this.showErrNotif('当前播放位置早于本行开始时间')
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
        this.showErrNotif('保存歌词需要管理员权限')
        return
      }
      const defaultPath = this.defaultWritePath()
      this.$q.dialog({
        title: '保存歌词文件',
        message: '请输入相对于当前作品根目录的保存路径，必须以 .vtt 结束：',
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
            throw new Error('没有可保存的歌词行')
          }
          await ServerApi.saveLyric(this.playWorkId, writePath, lines)
          this.SET_LYRIC_LINES(lines)
          this.showSuccNotif('歌词已保存为 VTT')
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
