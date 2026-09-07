<template>
  <q-header class="app-header" :reveal="immersive" :reveal-offset="100">
    <q-toolbar class="app-toolbar">
      <q-btn flat round dense icon="menu" class="app-header-button" aria-label="菜单" @click="$emit('toggle-drawer')">
        <q-tooltip>导航菜单</q-tooltip>
      </q-btn>
      <div class="app-heading">
        <router-link to="/" class="app-brand">Kikoeru</router-link>
        <nav class="app-location" aria-label="当前位置">
          <template v-if="parent">
            <router-link :to="parentTo" class="app-location-parent">{{ parent }}</router-link>
            <q-icon name="chevron_right" size="16px" class="app-location-separator" />
          </template>
          <span class="app-location-title">{{ title }}</span>
        </nav>
      </div>
      <q-btn flat round dense :icon="searchOpen ? 'close' : 'search'" class="app-header-button app-search-toggle" :aria-label="searchOpen ? '关闭搜索' : '搜索作品'" :aria-expanded="searchOpen" @click="toggleSearch" />
      <form class="app-search" :class="{ 'app-search--open': searchOpen }" role="search" @submit.prevent="submitSearch">
        <q-btn flat round dense icon="search" type="submit" class="app-search-button" aria-label="提交搜索"><q-tooltip>搜索作品</q-tooltip></q-btn>
        <input ref="searchInput" v-model="keyword" type="search" :placeholder="isAdvanceSearch ? '添加作品、声优、标签、社团关键词' : '搜索作品、声优、标签、社团'" :aria-label="isAdvanceSearch ? '添加搜索关键词' : '搜索作品'" @keydown.esc="closeSearch" @keydown.enter="onSearchEnter" />
        <q-btn v-if="keyword" flat round dense icon="close" class="app-search-button" aria-label="清除搜索" @click="clearSearch"><q-tooltip>清除搜索</q-tooltip></q-btn>
        <span class="app-search-divider" aria-hidden="true" />
        <q-btn flat round dense :icon="isAdvanceSearch ? 'add' : 'tune'" class="app-search-button" :class="{ 'app-search-active': isAdvanceSearch }" :aria-label="isAdvanceSearch ? '添加关键词' : '聚合搜索'" @click="isAdvanceSearch ? submitSearch() : openAdvanceSearch()">
          <q-tooltip>{{ isAdvanceSearch ? '添加关键词' : '聚合搜索' }}</q-tooltip>
        </q-btn>
      </form>
    </q-toolbar>
  </q-header>
</template>

<script>
export default {
  name: 'AppHeader',
  props: {
    title: { type: String, required: true },
    parent: { type: String, default: '' },
    parentTo: { type: String, default: '/' },
    immersive: Boolean,
  },
  emits: ['toggle-drawer'],
  data () {
    return { keyword: this.$route.name !== 'advance search' && typeof this.$route.query.keyword === 'string' ? this.$route.query.keyword : '', searchOpen: false }
  },
  computed: {
    isAdvanceSearch () { return this.$route.name === 'advance search' },
  },
  watch: {
    '$route.fullPath' () {
      this.keyword = !this.isAdvanceSearch && typeof this.$route.query.keyword === 'string' ? this.$route.query.keyword : ''
    },
  },
  methods: {
    onSearchEnter (event) {
      // Do not submit unfinished IME composition as a search term.
      if (event.isComposing || event.keyCode === 229) event.preventDefault()
    },
    submitSearch () {
      const keyword = this.keyword.trim()
      if (this.isAdvanceSearch && !keyword) return
      this.$router.push({ path: this.isAdvanceSearch ? '/search' : '/works', query: keyword ? { keyword } : {} })
      if (this.isAdvanceSearch) this.keyword = ''
    },
    openAdvanceSearch () {
      const keyword = this.keyword.trim()
      this.$router.push({ path: '/search', query: keyword ? { keyword } : {} })
    },
    clearSearch () {
      this.keyword = ''
      this.$refs.searchInput.focus()
      if (!this.isAdvanceSearch && this.$route.query.keyword) this.submitSearch()
    },
    toggleSearch () {
      this.searchOpen = !this.searchOpen
      if (this.searchOpen) this.$nextTick(() => this.$refs.searchInput.focus())
    },
    closeSearch () {
      this.searchOpen = false
      this.$refs.searchInput.blur()
    },
  },
}
</script>

<style lang="scss">
.app-header {
  --header-surface: #fff;
  --header-text: #292c32;
  --header-muted: #656b74;
  --header-line: #e3e6ea;
  --header-field: #f2f4f6;
  background: var(--header-surface);
  color: var(--header-text);
  border-bottom: 1px solid var(--header-line);
}
.body--dark .app-header {
  --header-surface: #1d1e20;
  --header-text: #eceef1;
  --header-muted: #afb4bd;
  --header-line: #35373c;
  --header-field: #292b2f;
}
.app-toolbar { min-height: 56px; padding: 0 20px 0 8px; gap: 16px; flex-wrap: wrap; }
.app-header-button { width: 40px; height: 40px; flex: 0 0 40px; }
.app-header-button .q-icon { font-size: 22px; }
.app-heading { display: flex; align-items: baseline; gap: 16px; min-width: 0; flex: 1; }
.app-brand { color: inherit; font-size: 20px; line-height: 24px; font-weight: 500; letter-spacing: 0; flex-shrink: 0; }
.app-location { min-width: 0; display: flex; align-items: baseline; gap: 8px; flex: 1; border-left: 1px solid var(--header-line); padding-left: 20px; font-size: 14px; line-height: 24px; }
.app-location-parent { color: var(--header-muted); white-space: nowrap; }
.app-location-parent:hover { color: var(--kikoeru-accent-text); }
.app-location-separator { color: var(--header-muted); align-self: center; }
.app-location-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
.app-search { display: flex; align-items: center; width: 340px; flex: 0 1 340px; max-width: 42%; height: 38px; padding: 0 3px; border: 1px solid transparent; border-radius: 6px; background: var(--header-field); }
.app-search:focus-within { border-color: var(--q-primary); }
.app-search input { color: var(--header-text); background: transparent; border: 0; outline: none; min-width: 0; width: 100%; font: inherit; font-size: 14px; letter-spacing: 0; padding: 0 5px; }
.app-search input::placeholder { color: var(--header-muted); opacity: 1; }
.app-search input::-webkit-search-cancel-button { display: none; }
.app-search-button { width: 30px; height: 30px; min-height: 30px; flex: 0 0 30px; color: var(--header-muted); }
.app-search-button .q-icon { font-size: 20px; }
.app-search-active { color: var(--kikoeru-accent-text); }
.app-search-divider { width: 1px; height: 18px; margin: 0 3px; background: var(--header-line); flex-shrink: 0; }
.app-search-toggle { display: none; }
@media (max-width: 700px) {
  .app-toolbar { padding: 0 8px; column-gap: 10px; row-gap: 0; }
  .app-header-button { margin: 8px 0; }
  .app-location { padding-left: 14px; }
  .app-search-toggle { display: inline-flex; }
  .app-search { display: none; }
  .app-search--open { display: flex; flex: 1 0 calc(100% - 16px); width: auto; max-width: none; height: 44px; margin: 0 8px 10px; }
  .app-search input { font-size: 16px; }
  .app-search-button { width: 40px; height: 40px; flex-basis: 40px; }
}
@media (max-width: 450px) {
  .app-toolbar { column-gap: 8px; }
  .app-header-button { width: 44px; height: 44px; flex-basis: 44px; margin: 6px 0; }
  .app-brand, .app-location-parent, .app-location-separator { display: none; }
  .app-location { border: 0; padding: 0; font-size: 16px; }
}
</style>
