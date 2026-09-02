<template>

  <!--在进度条周围监听mouseup、mousedown事件，辅助进度条状态切换-->
  <div class="q-px-md"
      @mousedown.capture="onPanSlider('start')"
      @mouseup.capture="onPanSlider('end')"
  >
    <q-slider v-model="changeCurrentTime"
      @change="onChangeSlider"
      @pan="onPanSlider"
      :min="0" :max="duration" :step="0.01"
      label
      :label-value="formatSeconds(displayCurrentTime)"
      />
    <div class="vue-plyr">
      <!--使用video组件来播放音频和视频文件，同时隐藏原生的vue-plyr组件，这里的组件只会留下一个进度条的功能
      之所以用video，是因为video可以设置mp3等音频文件，也可以播放mp4等视频文件，在播放视频的时候，还能够用该video元素作为canvas绘制来源，
      反之，audio虽然可以播放video的音频，但是将其作为canvas的绘制源，因此倾向于使用video来播放所有媒体元素-->
      <!--注意，这里video设置了一个id，因为需要被其他组件通过document.querySelector方式进行查找引用-->
      <video
        v-if="enableVideoSource"
        id="mediaVideo"
        ref="media"
        class="hide-in-global-page-for-pip"
        crossorigin="anonymous"
        playsinline
        controls
        style="display: inline;"
        @canplay="onCanplay"
        @timeupdate="onTimeupdate"
        @ended="onEnded"
        @seeked="onSeeked"
        @playing="onPlaying"
        @waiting="onWaiting"
        @pause="onPause"
      >
        <source v-if="source" :src="source" />
      </video>
      <audio
        v-else
        ref="media"
        crossorigin="anonymous"
        @canplay="onCanplay"
        @timeupdate="onTimeupdate"
        @ended="onEnded"
        @seeked="onSeeked"
        @playing="onPlaying"
        @waiting="onWaiting"
        @pause="onPause"
      >
        <source v-if="source" :src="source" />
      </audio>
    </div>
  </div>
</template>

<script>
import Lyric from 'lrc-file-parser'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { mapState, mapGetters, mapMutations } from 'vuex'
import NotifyMixin from '../mixins/Notification.js'
import { formatSeconds, extname, lyricLinesToLrc, ServerApi } from '../utils'
import { TRANSCODE_OPTIONS } from '../store/module-AudioPlayer/state'
import { debounce } from 'quasar';

const MEDIA_SESSION_ACTIONS = [
  'play',
  'pause',
  'previoustrack',
  'nexttrack',
  'seekbackward',
  'seekforward',
  'seekto',
]

function convert_srt_vtt_to_lrc(text) {
  let lines = text.split("\n").map(l => l.trim())
  let isVtt = lines[0] == 'WEBVTT';
  if (isVtt) {
    lines = lines.slice(1)
  }

  const timeParseRe = /(\d*):(\d*):(\d*)(\.|,)(\d*)\s*-->\s*[\d:.]*/

  const parsingUnit = []; // [([minute, seconds, millseconds], '文字\n文字'), (), ..., ()]
  let i = 0;
  while(i < lines.length) {

    // 注意 srt 和 vtt 字幕的毫秒区分符号一个是`,'另一个是`.
    // audio.srt be like
    // 1
    // 00:01:22,343 --> 00:03:22,344
    // 字幕，字幕
    // 
    // 2
    // ...

    // audio.vtt be like
    // WEBVTT
    // 
    // 1
    // 00:01:22.343 --> 00:03:22.344
    // 字幕，字幕
    // 
    // 2
    // ...

    if (/^\d*$/.test(lines[i++])) { /* parse 序号 */
      if (timeParseRe.test(lines[i])) { /* parse 时间戳 */
        const [_/* whole string */ , h, m, s, _mill_sep /* ignore */, ms] = timeParseRe.exec(lines[i]).map(x => parseInt(x));
        let texts = [];
        i++;
        while(i < lines.length && lines[i] != "") { /* parse 文字，直到空行 */
          texts.push(lines[i++]);
        }
        parsingUnit.push([
          [h, m, s, ms],
          texts.join(' '),
        ]);
      }
    }
  } // parse srt vtt 完成

  function padding(n, len) {
    n = Math.ceil(n);
    let s = `${n}`;
    let pad = len - s.length;
    if (pad > 0) {
      for (let i = 0; i < pad; ++i) {
        s = "0" + s;
      }
    }
    return s;
  }

  function formatLrcTime([h, m, s, ms]) {
    return padding(h * m, 2) + ":" + padding(m, 2) + ":" + padding(s, 2) + "." + padding(ms, 3);
  }

  const lrcContent = parsingUnit.map(([time, text]) => `[${formatLrcTime(time)}] ${text}`).join("\n");
  return lrcContent;
}

export default {
  name: 'AudioElement',

  mixins: [NotifyMixin],

  data() {
    return {
      lrcContent: "",
      lrcObj: null,
      lrcAvailable: false,
      playableLyricLineIndexes: [],
      preTranscodeTimerId: null,
      playerInstance: null,

      // 音频播放器进度条实现有些trick，普通的slider不能直接用，
      // 因为time的更新源有两个【audio播放】【用户输入】，
      // 两个更新源回导致进度条跳转出错，需要在【用户输入时】关闭【audio播放】发出的time更新（slider上）
      isChangingCurrentTime: false,
      changeCurrentTime: 0,
    }
  },

  computed: {
    player () {
      return this.playerInstance
    },

    source () {
      if (this.currentPlayingFile.hash && this.shouldTranscodeTrack(this.currentPlayingFile)) {
        return `/api/media/transcode/${this.currentPlayingFile.hash}?bitRate=${this.transcodeBitRate}`
      }
      // New API
      if (this.currentPlayingFile.mediaStreamUrl) {
        return this.currentPlayingFile.mediaStreamUrl
      } else if (this.currentPlayingFile.hash) {
        // Fallback to be compatible with old backend
        return `/api/media/stream/${this.currentPlayingFile.hash}`
      } else {
        return ""
      }
    },

    ...mapState('AudioPlayer', [
      'playing',
      'queue',
      'queueIndex',
      'playMode',
      'muted',
      'volume',
      'playbackRate',
      'sleepTime',
      'sleepMode',
      'rewindSeekTime',
      'forwardSeekTime',
      'rewindSeekMode',
      'forwardSeekMode',
      'enableVisualizer',
      'resumeHistroySeconds',
      'playWorkId',
      'visualPlayerCoverUrl',
      'duration',
      'currentTime',
      'newCurrentTime',
      'enableVideoSource',
      'lyricOffsetSeconds',
      'enablePIPLyrics',
      'lyricLines',
      'transcodeOption',
      'transcodeFromTypes',
      'defaultSubtitleLanguage',
    ]),

    ...mapGetters('AudioPlayer', [
      'currentPlayingFile',
      'resumeHistroyDone',
      'transcodeBitRate',
    ]),

    displayCurrentTime() {
      if (this.isChangingCurrentTime) return this.changeCurrentTime;
      else return this.currentTime;
    }
  },

  watch: {
    playing (flag) {
      if (this.player.duration) {
        // 缓冲至可播放状态
        flag ? this.player.play() : this.player.pause()
      }
      // this.playLrc(flag);
    },

    // watch source -> media.load() -> canPlay -> player.play()
    source (url) {
      this.clearPreTranscodeTimer()
      this.SET_PLAYING_TRANSCODE(this.shouldTranscodeTrack(this.currentPlayingFile))
      if (url) {
        // 加载新音频/视频文件
        this.player.media.load();
        this.loadLrcFile();
        this.updateMediaSessionMetadata();
      }
    },

    muted (flag) {
      // 切换静音状态
      this.player.muted = flag
    },

    volume (val) {
      // 屏蔽非法数值
      if (val < 0 || val > 1) {
        return
      }

      // 调节音量
      this.player.volume = val
    },
    playbackRate (value) {
      if (this.player && this.player.media) this.player.media.playbackRate = value
    },
    rewindSeekMode(rewind) {
      if (rewind) {
        this.player.rewind(this.rewindSeekTime);
        this.SET_REWIND_SEEK_MODE(false);
      }
    },
    forwardSeekMode(forward) {
      if (forward) {
        this.player.forward(this.forwardSeekTime);
        this.SET_FORWARD_SEEK_MODE(false);
      }
    },
    currentTime(v) {
      if (this.isChangingCurrentTime) return;
      else this.changeCurrentTime = this.currentTime;
    },
    newCurrentTime(v) {
      if (v < 0) return;
      this.player.currentTime = v;
      this.SET_NEW_CURRENT_TIME(-1); // 标记时间已经更新到media上了
    },
    lyricOffsetSeconds() {
      this.playLrc(this.playing); // 强制更新一下歌词时间
    },
    enablePIPLyrics(enablePIP) {
      if (enablePIP) {
        this.playLrc(false)
      } else {
        this.playLrc(this.playing)
      }
    },
    enableVideoSource () {
      this.$nextTick(() => {
        this.initializePlayer()
        if (this.source) this.player.media.load()
      })
    },
    lyricLines(lines) {
      this.applyLyricLines(lines)
    }
  },

  created() {
    this.debouncedPlayLrc = debounce(this.playLrc, 100, true /* 首次更改应当立即生效，对后续更改防抖动 */); // 防抖动
  },

  methods: {
    formatSeconds,

    initializePlayer () {
      if (this.playerInstance) this.playerInstance.destroy()
      this.playerInstance = new Plyr(this.$refs.media, {
        controls: ['progress']
      })
      this.playerInstance.muted = this.muted
      this.playerInstance.volume = this.volume
      this.playerInstance.media.playbackRate = this.playbackRate
    },

    /**
     * 当 外部暂停（线控暂停、软件切换）、用户控制暂停、seek 时会触发本事件
     */
    onPause() {
      // console.log('onPause')
      this.clearPreTranscodeTimer()
      this.playLrc(false)
      this.PAUSE()
    },
    /**
     * 当播放器真正开始播放时会触发本事件
     */
    onPlaying() {
      // console.log('playing')
      this.playLrc(true)
      this.PLAY()
      this.scheduleNextTrackPreTranscode()
    },
    /**
     * 当播放器缓冲区空，被迫暂停加载时会触发本事件
     */
    onWaiting() {
      // console.log('waiting')
      this.clearPreTranscodeTimer()
      this.playLrc(false)
      this.PLAY()
    },
    ...mapMutations('AudioPlayer', [
      'SET_DURATION',
      'SET_CURRENT_TIME',
      'PAUSE',
      'PLAY',
      'SET_TRACK',
      'NEXT_TRACK',
      'PREVIOUS_TRACK',
      'SET_CURRENT_LYRIC',
      'SET_CURRENT_LYRIC_LINE_NUMBER',
      'SET_LYRIC_LINES',
      'SET_VOLUME',
      'CLEAR_SLEEP_MODE',
      'SET_REWIND_SEEK_MODE',
      'SET_FORWARD_SEEK_MODE',
      'SET_AUDIO_ANALYSER',
      'RESUME_HISTROY_SECONDS_DONE',
      'SET_HAS_LYRIC',
      'SET_NEW_CURRENT_TIME',
      'SET_PLAYING_TRANSCODE',
    ]),

    transcodeExtensions () {
      if (typeof this.transcodeFromTypes !== 'string') return []
      return this.transcodeFromTypes
        .split(',')
        .map(type => type.trim().toLowerCase())
        .filter(Boolean)
    },

    shouldTranscodeTrack (track) {
      if (this.transcodeOption === TRANSCODE_OPTIONS.OFF || this.transcodeBitRate <= 0) return false
      const extension = extname(track && track.title ? track.title : '')
        .replace(/^\./, '')
        .toLowerCase()
      return extension !== '' && this.transcodeExtensions().includes(extension)
    },

    clearPreTranscodeTimer () {
      if (this.preTranscodeTimerId !== null) {
        clearTimeout(this.preTranscodeTimerId)
        this.preTranscodeTimerId = null
      }
    },

    scheduleNextTrackPreTranscode () {
      this.clearPreTranscodeTimer()
      const source = this.source
      this.preTranscodeTimerId = setTimeout(() => {
        this.preTranscodeTimerId = null
        if (this.source !== source || !this.playing) return
        this.preTranscodeNextTrack()
      }, 30 * 1000)
    },

    async preTranscodeNextTrack () {
      const nextTrack = this.queue[this.queueIndex + 1]
      if (!nextTrack || !this.shouldTranscodeTrack(nextTrack)) return
      try {
        await ServerApi.askForTranscoding(nextTrack.hash, this.transcodeBitRate)
      } catch (error) {
        console.warn('Failed to pre-transcode next track:', error.message || error)
      }
    },

    onCanplay () {
      // 缓冲至可播放状态时触发 (只有缓冲至可播放状态, 才能获取媒体文件的播放时长)
      this.SET_DURATION(this.player.duration)

      // 播放
      if (this.playing && this.player.currentTime !== this.player.duration) {
        this.player.play()
      }

      // 当音频文件在网页中加载完毕，可以播放时
      // 检查此前是否有需要恢复的历史进度，如果尚未恢复
      // 则设置currentTime到指定的时间点，然后标记已经恢复历史播放记录
      if (!this.resumeHistroyDone) {
        this.player.currentTime = this.resumeHistroySeconds;
        this.RESUME_HISTROY_SECONDS_DONE()
        this.$q.notify({message: "已恢复播放历史", timeout: 1000})
      }
    },

    onTimeupdate () {
      // 当目前的播放位置已更改时触发
      this.SET_CURRENT_TIME(this.player.currentTime)
      if (this.enablePIPLyrics) this.debouncedPlayLrc(false) // 开启桌面歌词后，用视频的time更新事件驱动歌词更新，false表示禁用掉LrcObject本身的事件更新
      if (this.sleepMode && this.sleepTime) {
        const isCountdownComplete = typeof this.sleepTime === 'number' && Date.now() >= this.sleepTime
        const timeParts = typeof this.sleepTime === 'string' ? this.sleepTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/) : null
        const currentTime = new Date()
        const isScheduledTime = timeParts &&
          currentTime.getHours() === Number(timeParts[1]) &&
          currentTime.getMinutes() === Number(timeParts[2])
        if (isCountdownComplete || isScheduledTime) {
          this.PAUSE()
          this.CLEAR_SLEEP_MODE()
          // Persist sleep mode settings
          this.$q.sessionStorage.set('sleepTime', null)
          this.$q.sessionStorage.set('sleepMode', false)
        }
      }
    },

    onEnded () {
      // 当前文件播放结束时触发
      switch (this.playMode.name) {
        case "all repeat":
          // 循环播放
          if (this.queueIndex === this.queue.length - 1) {
            this.SET_TRACK(0)
          } else {
            this.NEXT_TRACK()
          }
          break
        case "repeat once":
          // 单曲循环
          this.player.currentTime = 0
          this.player.play()
          this.PLAY()
          break
        case "shuffle": {
          // 随机播放
          const index = Math.floor(Math.random()*this.queue.length)
          this.SET_TRACK(index)
          if (index === this.queueIndex) {
            this.player.currentTime = 0
          }
          break
        }
        default:
          // 顺序播放
          if (this.queueIndex === this.queue.length - 1) {
            this.PAUSE()
          } else {
            this.NEXT_TRACK()
          }
      }
    },

    onSeeked() {
      // if (this.lrcAvailable) {
      //   this.lrcObj.play(this.player.currentTime * 1000);
      //   if (!this.playing) {
      //     this.lrcObj.pause();
      //   }
      // }
      this.playLrc(this.playing);
    },


    playLrc (playStatus) {
      if (this.lrcAvailable) {
        if (playStatus) {
          this.lrcObj.play((this.player.currentTime + this.lyricOffsetSeconds) * 1000);
        } else {
          this.lrcObj.play((this.player.currentTime + this.lyricOffsetSeconds) * 1000); // update and pause lyric
          this.lrcObj.pause();
        }
      }
    },

    createLrcObj () {
        this.lrcObj = new Lyric({
          onPlay: (line, text) => {
            this.SET_CURRENT_LYRIC(text);
            const originalLine = this.playableLyricLineIndexes[line]
            this.SET_CURRENT_LYRIC_LINE_NUMBER(
              typeof originalLine === 'number' ? originalLine : line
            )
          },
        })
    },

    applyLyricLines(lines) {
      if (!this.lrcObj) return
      const sourceLines = Array.isArray(lines) ? lines : []
      this.playableLyricLineIndexes = []
      const playableLines = sourceLines.filter((line, index) => {
        if (!line.deleted) {
          this.playableLyricLineIndexes.push(index)
          return true
        }
        return false
      })
      this.lrcContent = lyricLinesToLrc(playableLines)
      this.lrcAvailable = playableLines.length > 0
      this.lrcObj.setLyric(this.lrcContent)
      this.SET_HAS_LYRIC(this.lrcAvailable)
      if (this.lrcAvailable) {
        this.playLrc(this.playing)
      } else {
        this.SET_CURRENT_LYRIC('')
        this.SET_CURRENT_LYRIC_LINE_NUMBER(0)
      }
    },

    async loadLrcFile () {
      const fileHash = this.queue[this.queueIndex].hash;
      const url = `/api/media/check-lrc/${fileHash}`;

      try {
        // 首先向服务器查询是否有歌词
        const check_response = await this.$axios.get(url, { params: { language: this.defaultSubtitleLanguage } })
        if (!check_response.data.result) {
          this.resetToNoLyricStatus()
          return;
        }

        // 新后端直接返回解析后的歌词；旧后端仍返回可下载的文件 hash。
        let lyricLines = []
        if (Array.isArray(check_response.data.lrc)) {
          lyricLines = check_response.data.lrc
        } else {
          const lrcUrl = `/api/media/stream/${check_response.data.hash}`;
          const lyricExtension = String(check_response.data.lyricExtension || '').toLowerCase();
          const response = await this.$axios.get(lrcUrl)
          let lrcContent = response.data
          if (lyricExtension == ".srt" || lyricExtension == ".vtt") {
            lrcContent = convert_srt_vtt_to_lrc(lrcContent);
          }
          this.lrcObj.setLyric(lrcContent)
          lyricLines = (this.lrcObj.lines || []).map(line => ({ ...line }))
        }
        this.SET_LYRIC_LINES(lyricLines)
      } catch(error) {
        if (error.response) {
          // 请求已发出，但服务器响应的状态码不在 2xx 范围内
          if (error.response.status !== 401) {
            console.error(error);
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`);
          }
        } else {
          console.error(error)
          this.showErrNotif(error.message || error);
        }
        this.SET_HAS_LYRIC(false);
      }
    },

    resetToNoLyricStatus() {
      // 无歌词文件
      this.lrcAvailable = false;
      this.lrcObj.setLyric('');
      this.lrcContent = '';
      this.SET_CURRENT_LYRIC('');
      this.SET_CURRENT_LYRIC_LINE_NUMBER(0)
      this.SET_LYRIC_LINES([])
      this.SET_HAS_LYRIC(false);
    },

    updateMediaSessionMetadata() {
      console.log("try update media session")
      try {
        if (this.playWorkId == 0) {
          navigator.mediaSession.metadata = null;
        } else {
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: this.currentPlayingFile.title,
            artist: "",
            album: this.currentPlayingFile.workTitle,
            // artwork: this.visualPlayerCoverUrl,
            artwork: [
              // {
              //   src: this.genCoverUrl(this.playWorkId, "visualPlayerCover"), // 图像太大，safari上有时会出现加载失败的问题
              //   sizes: "600x600", // 随便写的尺寸
              //   type: "image/jpg",
              // },
              {
                src: this.genCoverUrl(this.playWorkId, "main"),
                sizes: "560x560",
                type: "image/jpeg",
              },
              {
                src: this.genCoverUrl(this.playWorkId, "240x240"),
                sizes: "240x240",
                type: "image/jpeg",
              },
              {
                src: this.genCoverUrl(this.playWorkId, "sam"),
                sizes: "100x100",
                type: "image/jpeg",
              },
            ]
          })
        }
      } catch (e) {
        console.warn("set mediasession failed, because: ", e)
      }
    },

    setupMediaSessionActionHandlers () {
      if (!navigator.mediaSession || typeof navigator.mediaSession.setActionHandler !== 'function') return

      const handlers = {
        play: () => this.PLAY(),
        pause: () => this.PAUSE(),
        previoustrack: () => this.PREVIOUS_TRACK(),
        nexttrack: () => this.NEXT_TRACK(),
        seekbackward: ({ seekOffset }) => {
          this.player.currentTime = Math.max(0, this.player.currentTime - (seekOffset || this.rewindSeekTime))
        },
        seekforward: ({ seekOffset }) => {
          const targetTime = this.player.currentTime + (seekOffset || this.forwardSeekTime)
          this.player.currentTime = Math.min(this.player.duration || targetTime, targetTime)
        },
        seekto: ({ seekTime }) => {
          if (typeof seekTime === 'number') this.player.currentTime = seekTime
        },
      }

      MEDIA_SESSION_ACTIONS.forEach(action => {
        try {
          navigator.mediaSession.setActionHandler(action, handlers[action])
        } catch (error) {
          console.warn(`Media Session action ${action} is not supported:`, error.message || error)
        }
      })
    },

    clearMediaSessionActionHandlers () {
      if (!navigator.mediaSession || typeof navigator.mediaSession.setActionHandler !== 'function') return
      MEDIA_SESSION_ACTIONS.forEach(action => {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch (error) {
          console.warn(`Failed to clear Media Session action ${action}:`, error.message || error)
        }
      })
    },

    // type: in 'visualPlayerCover', 'main', 'sam', '240x240', # warning '360x360' is almost not exist in dlsite, do not use 360x360
    // 'visualPlayerCover' 默认是 'main'，如果用户有手动设置过可视化封面的话，则使用用户设置过的那个图片
    genCoverUrl(workId, type) {
      if (type == "visualPlayerCover") {
        return this.visualPlayerCoverUrl
          ? this.visualPlayerCoverUrl
          : ""
      } else if (workId != 0) {
        return `/api/cover/${workId}?type=${type}`
      } else {
        return ""
      }
    },

    onChangeSlider(v) {
      console.log("player current time is ", this.player.currentTime)
      console.log("slider change value to ", v)
      console.log("global current time is ", this.currentTime)
      this.player.currentTime = v;
    },
     onPanSlider(phase) {
      console.warn(" pan with phase = ", phase)
      if (phase == 'start') {
        this.isChangingCurrentTime = true;
        this.changeCurrentTime = this.currentTime;
      } else {
        // 延时一下，避免音频状态的值立即被更新到slider上
        setTimeout(() => {
          this.isChangingCurrentTime = false;
        }, 100);
      }
     },
  },

  mounted () {
    this.initializePlayer()
    this.setupMediaSessionActionHandlers()
    // 初始化音量
    this.SET_VOLUME(this.player.volume);

    const initAudio = () => {
      document.removeEventListener('click', initAudio);
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = {
        left: audioCtx.createAnalyser(),
        right: audioCtx.createAnalyser(),
        audioCtx,
        splitter: null,
        merger: null,
        audioSrc: null,
      };

      analyser.audioSrc = audioCtx.createMediaElementSource(this.player.media);
      analyser.splitter = audioCtx.createChannelSplitter(2);
      analyser.merger = audioCtx.createChannelMerger(2);
      analyser.audioSrc.connect(analyser.splitter);
      analyser.splitter.connect(analyser.left, 0);
      analyser.splitter.connect(analyser.right, 1);
      analyser.audioSrc.connect(audioCtx.destination)
      this.SET_AUDIO_ANALYSER(analyser)
    }

    if (this.enableVisualizer) {
      document.addEventListener('click', initAudio);
      if (this.$q.platform.is.safari && this.$q.platform.is.mobile) {
        this.$q.notify({
          message: "监测到safari平台上开启了音频可视化功能，注意移动端safari有bug，如果没有声音的话，请关闭音频可视化功能",
          timeout: 5000
        })
      }
    }

    this.createLrcObj();
    this.SET_PLAYING_TRANSCODE(this.shouldTranscodeTrack(this.currentPlayingFile))
    if (this.source) {
      this.loadLrcFile();
    }
  },

  beforeUnmount () {
    this.clearPreTranscodeTimer()
    this.clearMediaSessionActionHandlers()
    this.SET_PLAYING_TRANSCODE(false)
    if (this.playerInstance) this.playerInstance.destroy()
  },
}
</script>

<style scoped>
.vue-plyr {
  /* visibility: hidden; */
  /*display: none;*/
  width: 1px;
    height: 1px;
    overflow: hidden;
    top: 0px;
    left: 0px;
    position: absolute;
}

</style>
