<template>
  <q-badge
    :color="color"
    :title="failureDetails || null"
    class="transcoding-status q-px-sm"
    role="status"
    aria-live="polite"
  >
    <q-spinner v-if="isIndeterminate" size="12px" class="q-mr-xs" />
    {{ showMessage }}
  </q-badge>
</template>

<script>
import { t } from '../i18n'
import { mapGetters } from 'vuex'
import { ServerApi } from 'src/utils'

export default {
  name: 'TranscodingStatus',

  props: {
    trackHash: {
      type: String,
      required: true,
    },
  },

  data () {
    return {
      serverStatus: {
        status: 'waiting',
        ready: false,
        progress: null,
        error: null,
      },
      intervalId: null,
      requestGeneration: 0,
      statusError: false,
    }
  },

  computed: {
    ...mapGetters('AudioPlayer', [
      'transcodeBitRate',
    ]),

    progressPercent () {
      if (!this.serverStatus.progress) return null
      const percent = Number(this.serverStatus.progress.percent)
      return Number.isFinite(percent) ? percent : null
    },

    serverFailed () {
      return this.serverStatus.status === 'failed'
    },

    failureDetails () {
      if (this.serverFailed) return this.serverStatus.error || t('transcodingStatus.taskFailed')
      if (this.statusError) return t('transcodingStatus.statusUnavailable')
      return ''
    },

    isIndeterminate () {
      return !this.serverStatus.ready && !this.serverFailed && this.progressPercent === null && !this.statusError
    },

    showMessage () {
      if (this.serverStatus.ready) return `AAC ${this.transcodeBitRate}k`
      if (this.serverFailed) return t('transcodingStatus.failed')
      if (this.statusError) return t('transcodingStatus.statusFailed')
      if (this.progressPercent === null) return t('transcodingStatus.waiting')
      return t('transcodingStatus.progress', { value: Math.max(0, Math.min(100, this.progressPercent)).toFixed(0) })
    },

    color () {
      if (this.serverStatus.ready) return 'positive'
      if (this.serverFailed || this.statusError) return 'negative'
      if (this.progressPercent === null) return 'grey-7'
      return 'secondary'
    },
  },

  watch: {
    trackHash () {
      this.resetChecker()
    },

    transcodeBitRate () {
      this.resetChecker()
    },
  },

  methods: {
    clearChecker () {
      if (this.intervalId !== null) {
        clearInterval(this.intervalId)
        this.intervalId = null
      }
    },

    async checkStatus () {
      const generation = this.requestGeneration
      const trackHash = this.trackHash
      const bitRate = this.transcodeBitRate
      if (!trackHash || bitRate <= 0) return

      try {
        const status = await ServerApi.getTranscodingStatus(trackHash, bitRate)
        if (generation !== this.requestGeneration || trackHash !== this.trackHash) return
        this.serverStatus = status
        this.statusError = false
        if (status.ready || status.status === 'failed') this.clearChecker()
      } catch (error) {
        if (generation !== this.requestGeneration) return
        this.statusError = true
        console.warn('Failed to read transcoding status:', error.message || error)
      }
    },

    resetChecker () {
      this.clearChecker()
      this.requestGeneration += 1
      this.statusError = false
      this.serverStatus = {
        status: 'waiting',
        ready: false,
        progress: null,
        error: null,
      }
      if (!this.trackHash || this.transcodeBitRate <= 0) return
      this.checkStatus()
      this.intervalId = setInterval(() => this.checkStatus(), 1000)
    },
  },

  mounted () {
    this.resetChecker()
  },

  beforeUnmount () {
    this.requestGeneration += 1
    this.clearChecker()
  },
}
</script>

<style scoped>
.transcoding-status {
  white-space: nowrap;
}
</style>
