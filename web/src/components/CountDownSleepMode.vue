<template>
  <q-dialog :model-value="modelValue" persistent position="bottom" @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="countdown-card">
      <q-card-section class="row items-center justify-between">
        <div>
          <div class="text-subtitle1 text-weight-medium">{{ $t('countDownSleepMode.title') }}</div>
          <div class="text-caption text-grey-7">{{ $t('countDownSleepMode.description') }}</div>
        </div>
        <q-btn flat round dense icon="close" :aria-label="$t('common.close')" v-close-popup />
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-md">
        <q-btn-toggle
          v-model="minutes"
          spread
          unelevated
          no-caps
          toggle-color="primary"
          :options="presetOptions"
        />
        <q-input v-model.number="minutes" filled type="number" min="1" step="1" :label="$t('countDownSleepMode.minutesLabel')" :suffix="$t('countDownSleepMode.minutes')" />
        <div v-if="sleepMode && numericSleepTime" class="countdown-status">
          <q-icon name="hourglass_bottom" color="primary" size="20px" />
          <span>{{ $t('countDownSleepMode.remaining', { remainingLabel: remainingLabel }) }}</span>
        </div>
      </q-card-section>

      <q-card-actions align="between">
        <q-btn v-if="sleepMode" flat no-caps :label="$t('countDownSleepMode.cancel')" color="negative" @click="clearSleepTimer" v-close-popup />
        <q-space />
        <q-btn unelevated no-caps :label="sleepMode ? $t('countDownSleepMode.restart') : $t('countDownSleepMode.start')" icon="bedtime" color="primary" @click="setSleepTimer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { t } from '../i18n'
import { mapState, mapMutations } from 'vuex'

export default {
  name: 'CountDownSleepMode',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],

  data () {
    return {
      minutes: 30,
      remainingMs: 0,
      timerId: null,
    }
  },

  computed: {
    presetOptions () {
      return [
        { label: t('countDownSleepMode.preset15'), value: 15 },
        { label: t('countDownSleepMode.preset30'), value: 30 },
        { label: t('countDownSleepMode.preset60'), value: 60 },
        { label: t('countDownSleepMode.preset90'), value: 90 },
      ]
    },
    ...mapState('AudioPlayer', ['sleepTime', 'sleepMode']),
    numericSleepTime () {
      return typeof this.sleepTime === 'number' && Number.isFinite(this.sleepTime)
    },
    remainingLabel () {
      const totalSeconds = Math.max(0, Math.ceil(this.remainingMs / 1000))
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      return hours > 0
        ? t('countDownSleepMode.hoursRemaining', { hours: hours, count: minutes, seconds: seconds })
        : t('countDownSleepMode.minutesRemaining', { count: minutes, seconds: seconds })
    },
  },

  watch: {
    modelValue (visible) {
      if (visible) this.syncTimer()
    },
    sleepMode () {
      this.syncTimer()
    },
  },

  mounted () {
    if (this.$q.sessionStorage.getItem('sleepMode')) {
      const stored = this.$q.sessionStorage.getItem('sleepTime')
      if (typeof stored === 'number' && stored > Date.now()) this.SET_SLEEP_TIMER(stored)
    }
    this.syncTimer()
  },

  beforeUnmount () {
    this.stopTicker()
  },

  methods: {
    ...mapMutations('AudioPlayer', ['SET_SLEEP_TIMER', 'CLEAR_SLEEP_MODE']),
    setSleepTimer () {
      const minutes = Number(this.minutes)
      if (!Number.isFinite(minutes) || minutes <= 0) {
        this.$q.notify({ message: t('countDownSleepMode.invalidMinutes'), color: 'negative', icon: 'error', timeout: 2000 })
        return
      }
      const deadline = Date.now() + Math.round(minutes * 60000)
      this.SET_SLEEP_TIMER(deadline)
      this.$q.sessionStorage.set('sleepTime', deadline)
      this.$q.sessionStorage.set('sleepMode', true)
      this.syncTimer()
      this.$emit('update:modelValue', false)
      const stopAt = new Date(deadline)
      const stopAtLabel = `${String(stopAt.getHours()).padStart(2, '0')}:${String(stopAt.getMinutes()).padStart(2, '0')}`
      this.$q.notify({ message: t('countDownSleepMode.scheduled', { count: minutes, stopAtLabel: stopAtLabel }), color: 'primary', icon: 'bedtime', timeout: 3000 })
    },
    clearSleepTimer () {
      this.CLEAR_SLEEP_MODE()
      this.$q.sessionStorage.set('sleepTime', null)
      this.$q.sessionStorage.set('sleepMode', false)
      this.syncTimer()
      this.$q.notify({ message: t('countDownSleepMode.disabled'), color: 'primary', icon: 'bedtime', timeout: 2000 })
    },
    syncTimer () {
      this.stopTicker()
      if (!this.sleepMode || !this.numericSleepTime) {
        this.remainingMs = 0
        return
      }
      this.updateRemaining()
      this.timerId = window.setInterval(this.updateRemaining, 1000)
    },
    updateRemaining () {
      this.remainingMs = Math.max(0, this.sleepTime - Date.now())
      if (this.remainingMs === 0) this.stopTicker()
    },
    stopTicker () {
      if (this.timerId !== null) window.clearInterval(this.timerId)
      this.timerId = null
    },
  },
}
</script>

<style lang="scss" scoped>
.countdown-card { width: 520px; max-width: 100vw; padding-bottom: 8px; }
.countdown-status { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 8px 12px; border-left: 3px solid var(--q-color-primary); background: rgba(var(--kikoeru-accent-rgb), .08); }
</style>
