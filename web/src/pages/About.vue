<template>
  <q-page class="about-page q-pa-md"><q-card flat bordered class="about-card"><q-card-section class="text-center q-pt-xl"><q-icon name="headphones" color="primary" size="48px" /><div class="text-h4 q-mt-sm">Kikoeru</div><div class="text-subtitle2 text-grey-7">{{ $t('about.description') }}</div></q-card-section><q-separator /><q-list separator><q-item><q-item-section><q-item-label>{{ $t('about.maintainers') }}</q-item-label><q-item-label caption>ValoHalo / KaffuAlcaid</q-item-label></q-item-section></q-item><q-item><q-item-section><q-item-label>{{ $t('about.repository') }}</q-item-label><q-item-label caption><a href="https://github.com/ValoHalo/Kikoeru" target="_blank" rel="noreferrer" class="text-primary">github.com/ValoHalo/Kikoeru</a></q-item-label></q-item-section></q-item><q-item><q-item-section><q-item-label>{{ $t('about.disclaimer') }}</q-item-label><q-item-label caption>{{ $t('about.disclaimerText') }}</q-item-label></q-item-section></q-item></q-list></q-card></q-page>
</template>
<script>export default { name: 'About' }</script>
<style lang="scss" scoped>
.about-page { max-width: 680px; margin: 0 auto; }
.about-card { border-radius: 8px; overflow: hidden; }
</style>
