<template>
  <div class="container">
    <div class="text-h5">{{ $t('audioEqualizer.title') }}</div>
    <q-toggle
      :disable="disable"
      v-model="isFlipLeftRightChannel"
      color="primary"
      :icon="isFlipLeftRightChannel ? 'sync_alt' : 'headphones'"
      :label="$t('audioEqualizer.swapChannels')"
    />
  </div>
</template>

<script>
export default {
  name: 'AudioEqualizer',
  props: { disable: { type: Boolean, required: true } },
  computed: {
    isFlipLeftRightChannel: {
      get () { return this.$store.state.AudioPlayer.swapChannels },
      set (value) { this.$store.commit('AudioPlayer/SET_SWAP_CHANNELS', value) }
    }
  }
}
</script>

<style scoped lang="scss">
</style>
