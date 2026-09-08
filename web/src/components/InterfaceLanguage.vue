<template>
  <q-select
    :model-value="$i18n.locale"
    :options="availableLocales"
    :aria-label="$t('common.interfaceLanguage')"
    emit-value
    map-options
    dense
    outlined
    options-dense
    class="interface-language"
    @update:model-value="setLocale"
  />
</template>

<script>
import { availableLocales, setLocale } from '../i18n'

export default {
  name: 'InterfaceLanguage',
  setup () {
    return { availableLocales, setLocale }
  }
}
</script>

<style scoped>
.interface-language { width: 200px; max-width: 100%; }
</style>
