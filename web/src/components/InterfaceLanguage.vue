<template>
  <q-select
    :model-value="localePreference"
    :options="languageOptions"
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
import { localePreference, setLocale } from '../i18n'
import { interfaceLanguageOptions } from '../preferenceOptions'

export default {
  name: 'InterfaceLanguage',
  computed: {
    languageOptions () { return interfaceLanguageOptions() }
  },
  setup () {
    return { localePreference, setLocale }
  }
}
</script>

<style scoped>
.interface-language { width: 200px; max-width: 100%; }
</style>
