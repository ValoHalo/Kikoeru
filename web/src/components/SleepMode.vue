<template>
    <q-dialog :model-value="modelValue" persistent @update:model-value="$emit('update:modelValue', $event)">
      <q-card>
        <div class="q-pa-sm">
          <q-time
            v-model="time"
            now-btn
            :dark="isDarkModeOn"
          />
        </div>

        <div class="row justify-between">
          <q-card-actions>
            <q-btn flat :label="$t('sleepMode.cancel')" color="primary" @click="clearSleepTimer" :disable="!sleepMode" v-close-popup />
          </q-card-actions>

          <q-card-actions align="right">
            <q-btn class="app-dialog-cancel" flat :label="$t('common.cancel')" color="primary" v-close-popup />
            <q-btn flat :label="$t('common.ok')" color="primary" @click="setSleepTimer" v-close-popup />
          </q-card-actions>
        </div>

      </q-card>
    </q-dialog>
</template> 

<script>
import { t } from '../i18n'
import { mapState, mapMutations } from 'vuex'

export default {
  name: 'SleepMode',

  // v-model: showTimer from MainLayout
  props: {
    modelValue: {
      type: Boolean,
      required: true
    }
  },
  emits: ['update:modelValue'],

  data() {
    return {
      // for q-time component only
      time: '00:00'
    }
  },

  computed: {
    ...mapState('AudioPlayer', [
      'sleepTime',
      'sleepMode'
    ]),

    isDarkModeOn() {
      return this.$q.dark.isActive;
    }
  },

  mounted() {
    try {
      if (this.$q.sessionStorage.getItem('sleepMode')) {
        const stored = this.$q.sessionStorage.getItem('sleepTime')
        if (typeof stored === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(stored)) this.SET_SLEEP_TIMER(stored)
      }
    } catch {
      console.log('Web Storage API error');
    }
  },

  watch: {
    // v-model: showTimer from MainLayout
    modelValue(visible) {
      if (visible) {
        if (!this.sleepMode) {
          const currentTime = new Date();
          this.time = currentTime.getHours().toString().padStart(2, '0') + ':' + currentTime.getMinutes().toString().padStart(2, '0');          
        } else {
          this.time = this.sleepTime;
        }
      }
    }
  },

  methods: {
    ...mapMutations('AudioPlayer', [
      'SET_SLEEP_TIMER',
      'CLEAR_SLEEP_MODE'
    ]),

    setSleepTimer() {
      this.SET_SLEEP_TIMER(this.time);
      // Persist sleep timer
      try {
        this.$q.sessionStorage.set('sleepTime', this.time);
        this.$q.sessionStorage.set('sleepMode', true);
      } catch {
        console.log('Web Storage API error');
      }
      this.showSuccNotif(t('sleepMode.scheduled', { time: this.time }));
    },

    clearSleepTimer() {
      this.CLEAR_SLEEP_MODE();
      try {
        this.$q.sessionStorage.set('sleepTime', null);
        this.$q.sessionStorage.set('sleepMode', false);
      } catch {
        console.log('Web Storage API error');
      }
      this.showSuccNotif(t('sleepMode.disabled'));
    },

    showSuccNotif (message) {
      this.$q.notify({
        message,
        color: 'primary',
        icon: 'bedtime',
        timeout: 5000
      })
    },
  }
}
</script>
