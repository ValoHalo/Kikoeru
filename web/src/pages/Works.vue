<template>
  <div class="works-page">
    <!--没有搜索的情况下，显示最近播放作品-->
    <RecentWorks v-if="enableShowRecent && !isAdvanceSearch && searchMetas.length == 0 && !collectionId" />

    <section class="works-toolbar" :class="{ 'works-toolbar--selecting': selecting }" :aria-labelledby="selecting ? undefined : 'works-heading'" :aria-label="selecting ? $t('batchWorks.selectWork') : undefined">
    <LibraryBatchActions v-if="selecting" :selected="selectedWorks" @select-all="selectLoaded" @clear="selectedWorks = []" @exit="exitSelection" @completed="batchCompleted" />
    <div v-else class="works-toolbar-heading">
      <div class="works-title"><q-icon name="library_music" size="21px" /><h2 id="works-heading">{{ pageTitle ? $t(pageTitle) : '' }}</h2><span class="works-count">{{ pagination.totalCount }}</span></div>
      <div class="works-display-controls">
        <SavedSearchMenu v-if="$store.state.User.name" :search="savedSearchValue" @apply="applySavedSearch" />
        <q-btn v-if="$store.state.User.name" flat no-caps icon="checklist" :label="$t('batchWorks.selectWork')" :aria-label="$t('batchWorks.selectWork')" @click="selecting = true" />
        <q-btn flat no-caps :icon="sortInDesc ? 'south' : 'north'" :label="sortInDesc ? $t('works.descending') : $t('works.ascending')" :aria-label="$t('favourites.sortDirection')" class="works-sort-direction" @click="sortInDesc = !sortInDesc" />
        <div class="works-view-options" role="group" :aria-label="$t('works.viewMode')">
          <q-btn flat dense no-caps icon="grid_view" :label="$t('works.cardView')" :aria-pressed="!listMode" :class="{ 'is-selected': !listMode }" @click="listMode = false" />
          <q-btn flat dense no-caps icon="view_list" :label="$t('works.listView')" :aria-pressed="listMode" :class="{ 'is-selected': listMode }" @click="listMode = true" />
        </div>
        <q-btn v-if="$q.screen.width > 700 && listMode" flat no-caps :icon="showLabel ? 'label' : 'label_off'" :label="$t(showLabel ? 'works.hideTags' : 'works.showTags')" :aria-label="$t(showLabel ? 'works.hideTags' : 'works.showTags')" :aria-pressed="showLabel" @click="showLabel = !showLabel" />
        <q-btn v-if="$q.screen.width >= 1120 && !listMode" flat no-caps :icon="detailMode ? 'zoom_out' : 'zoom_in'" :label="$t(detailMode ? 'works.smallerCards' : 'works.largerCards')" :aria-label="$t(detailMode ? 'works.smallerCards' : 'works.largerCards')" @click="detailMode = !detailMode" />
      </div>
    </div>
    <div v-show="!selecting" class="works-filters">
      <div class="works-filter-fields">
        <!-- 排序属性 -->
        <div class="works-filter-field">
          <span class="works-filter-label">{{ $t('works.sortBy') }}</span>
          <q-select
            dense
            borderless
            options-dense
            hide-bottom-space
            v-model="sortCategoryOption"
            :options="sortCategoryOptions"
            :option-label="humanReadableLabel"
            :aria-label="$t('works.sortBy')"
            class="works-filter-select"
          />
        </div>

        <!-- 年龄分级 -->
        <div class="works-filter-field">
          <span class="works-filter-label">{{ $t('works.ageRating') }}</span>
          <q-select
            dense
            borderless
            options-dense
            hide-bottom-space
            :model-value="$store.getters['AudioPlayer/sfwOnly'] ? 'nsfw_1' : nsfwOption"
            :disable="$store.getters['AudioPlayer/sfwOnly']"
            @update:model-value="nsfwOption = $event"
            :options="nsfwOptions"
            :option-label="humanReadableLabel"
            :aria-label="$t('works.ageRating')"
            class="works-filter-select"
            :class="{ 'is-active': !$store.getters['AudioPlayer/sfwOnly'] && nsfwOption !== 'nsfw_0' }"
          />
        </div>

        <!-- 字幕筛选 -->
        <div class="works-filter-field">
          <span class="works-filter-label">{{ $t('works.subtitleFilter') }}</span>
          <q-select
            dense
            borderless
            options-dense
            hide-bottom-space
            v-model="lyricOption"
            :options="lyricOptions"
            :option-label="humanReadableLabel"
            :display-value="lyricOption && lyricOption.length ? lyricOption.map(humanReadableLabel).join(', ') : $t('common.all')"
            :aria-label="$t('works.subtitleFilter')"
            clearable
            multiple
            class="works-filter-select works-filter-lyrics"
            :class="{ 'is-active': lyricOption && lyricOption.length > 0 }"
          />
        </div>

        <!-- 作品分组 -->
        <div class="works-filter-field">
          <span class="works-filter-label">{{ $t('common.collections') }}</span>
          <q-select
            dense
            borderless
            options-dense
            hide-bottom-space
            :model-value="collectionId"
            @update:model-value="setCollectionFilter"
            :options="collectionOptions"
            :loading="loadingCollections"
            emit-value
            map-options
            clearable
            :aria-label="$t('common.collections')"
            :display-value="collectionId ? (collections.find(item => String(item.id) === collectionId)?.name || $t('works.unavailableCollection')) : $t('works.allCollections')"
            class="works-filter-select"
            :class="{ 'is-active': Boolean(collectionId) }"
            @popup-show="loadCollections"
          >
            <template #no-option>
              <q-item><q-item-section class="text-grey">{{ $t('works.noCollections') }}</q-item-section></q-item>
            </template>
          </q-select>
        </div>
      </div>
    </div>
    <div v-if="!selecting && (advanceSearchKeywords.length || searchMetas.length)" class="works-search-chips">
      <div v-if="isAdvanceSearch" class="works-search-chip-list"><!--高级搜索模式的多关键字展示-->
        <span class="works-search-chip" v-for="(meta, index) in advanceSearchKeywords" :key="meta.t + meta.d">
          <span>{{ $privateText(meta.d) }}</span>
          <q-btn
            class="works-search-chip-close"
            round
            flat
            dense
            size="xs"
            icon="close"
            :aria-label="$t('works.removeKeyword', { d: $privateText(meta.d) })"
            @click="removeAdvanceSearchKeyword(index)"
          />
        </span>
      </div>
      <div v-else class="works-search-chip-list"> <!--普通搜索模式的信息展示-->
        <span class="works-search-chip" v-for="meta in searchMetas" :key="meta">{{ $privateText(meta) }}</span>
      </div>
    </div>
    </section>

    <div class="works-results row justify-center">
      <q-infinite-scroll ref="infiniteScroller" @load="onLoad" :offset="250" :disable="stopLoad || workListMode === WORK_LIST_MODES.PAGINATION" class="col">

        <div v-if="workListMode === WORK_LIST_MODES.PAGINATION && pagination.totalCount > 0" class="row justify-center q-pb-lg">
          <q-pagination :model-value="displayPage" :max="maxPages" :max-pages="7" boundary-links direction-links color="primary" @update:model-value="gotoPage" />
        </div>

        <div v-if="isLoading && !works.length">
          <q-list v-if="listMode" bordered separator class="works-list">
            <q-item v-for="n in 6" :key="n" class="q-py-sm">
              <q-item-section avatar><q-skeleton type="QAvatar" size="68px" square /></q-item-section>
              <q-item-section>
                <q-skeleton type="text" width="58%" />
                <q-skeleton type="text" width="34%" />
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="works-grid" :class="{ 'works-grid--compact': !detailMode }">
            <q-card v-for="n in 8" :key="n" flat bordered class="works-skeleton-card">
              <q-skeleton height="180px" square />
              <q-card-section class="q-pa-md q-gutter-xs">
                <q-skeleton type="text" width="42%" />
                <q-skeleton type="text" width="88%" />
                <q-skeleton type="text" width="65%" />
              </q-card-section>
            </q-card>
          </div>
        </div>

        <q-virtual-scroll
          v-else-if="listMode && works.length && workListMode === WORK_LIST_MODES.WATERFALL"
          ref="virtualList"
          :items="works"
          scroll-target="body"
          :virtual-scroll-item-size="96"
          bordered separator class="works-list"
        >
          <template #default="{ item }">
            <WorkSelection :key="item.id" :label="$privateText(item.title)" list :enabled="selecting" :selected="selectedWorks.includes(item.id)" @select="toggleSelection(item.id, $event)"><WorkListItem :metadata="item" :showLabel="showLabel && $q.screen.width > 700" /></WorkSelection>
          </template>
        </q-virtual-scroll>
        <q-list v-else-if="listMode && works.length" bordered separator class="works-list">
          <WorkSelection v-for="work in works" :key="work.id" :label="work.title" list :enabled="selecting" :selected="selectedWorks.includes(work.id)" @select="toggleSelection(work.id, $event)"><WorkListItem :metadata="work" :showLabel="showLabel && $q.screen.width > 700" /></WorkSelection>
        </q-list>

        <!--解决android平台hover事件不像safari那样及时响应的问题，需要手动添加触摸响应时间-->
        <div v-else-if="!listMode && works.length && $q.platform.is.android && $q.platform.has.touch" class="works-grid" :class="{ 'works-grid--compact': !detailMode }">
          <div class="works-grid-item" v-for="work in works" :key="work.id"
            @touchstart="()=>onWorkCardTouch(work.id)"
            :style="{ '--sim-hover-work-card': work.id === touchedWorkId ? '1' : '0'}"
          >
            <WorkSelection :label="work.title" :enabled="selecting" :selected="selectedWorks.includes(work.id)" @select="toggleSelection(work.id, $event)"><WorkCard :metadata="work" :thumbnailMode="!detailMode" class="fit" @library-changed="reset()"/></WorkSelection>
          </div>
        </div>

        <!--正常的workCard展示-->
        <div v-else-if="!listMode && works.length" class="works-grid" :class="{ 'works-grid--compact': !detailMode }">
          <div class="works-grid-item" v-for="work in works" :key="work.id"
            style="--sim-hover-work-card: 0"
          >
            <WorkSelection :label="work.title" :enabled="selecting" :selected="selectedWorks.includes(work.id)" @select="toggleSelection(work.id, $event)"><WorkCard :metadata="work" :thumbnailMode="!detailMode" class="fit" @library-changed="reset()"/></WorkSelection>
          </div>
        </div>

        <div v-if="workListMode === WORK_LIST_MODES.PAGINATION && !isLoading && works.length > 4" class="row justify-center q-py-lg">
          <q-pagination :model-value="displayPage" :max="maxPages" :max-pages="7" boundary-links direction-links color="primary" @update:model-value="gotoPage" />
        </div>

        <section v-if="!isLoading && worksLoadState === 'success' && pagination.totalCount === 0" class="works-empty" role="status" aria-live="polite">
          <q-icon :name="hasSearch || hasFilters ? 'search_off' : 'library_music'" size="32px" aria-hidden="true" />
          <h3>{{ $t(hasSearch || hasFilters ? 'works.noResults' : 'works.emptyLibrary') }}</h3>
          <p v-if="hasSearch || hasFilters">{{ $t(hasSearch ? 'works.emptySearchHint' : 'works.emptyFiltersHint') }}</p>
          <div v-if="hasSearch || hasFilters" class="works-empty-actions">
            <q-btn v-if="hasSearch" unelevated no-caps color="primary" :label="$t('appHeader.clearSearch')" @click="recoverEmptyResults('search')" />
            <q-btn v-if="hasFilters" outline no-caps color="primary" :label="$t('works.resetFilters')" @click="recoverEmptyResults('filters')" />
          </div>
        </section>

        <div v-if="workListMode === WORK_LIST_MODES.WATERFALL && stopLoad && !isLoading && worksLoadState === 'success' && works.length" class="works-end-note">{{ $t('works.noMoreWorks') }}</div>

        <template v-slot:loading>
          <div class="row justify-center q-my-md">
            <q-spinner-dots color="primary" size="40px" />
          </div>
        </template>
      </q-infinite-scroll>
    </div>
  </div>
</template>

<script>
import { t } from '../i18n'
import WorkCard from 'components/WorkCard.vue'
import WorkListItem from 'components/WorkListItem.vue'
import NotifyMixin from '../mixins/Notification.js'
import RecentWorks from 'src/components/RecentWorks.vue'
import { mapState } from 'vuex'
import { AdvanceSearchCondType } from '../utils.js'
import { WORK_LIST_MODES } from '../store/module-AudioPlayer/state'
import { rememberWorksScroll } from '../utils/worksScroll'
import WorkSelection from '../components/WorkSelection.vue'
import LibraryBatchActions from '../components/LibraryBatchActions.vue'
import SavedSearchMenu from '../components/SavedSearchMenu.vue'

export default {
  name: 'Works',

  mixins: [NotifyMixin],

  components: {
    WorkSelection,
    LibraryBatchActions,
    SavedSearchMenu,
    WorkCard,
    WorkListItem,
    RecentWorks,
  },

  data () {
    return {
      selecting: false,
      selectedWorks: [],
      selectionAnchor: null,
      listMode: false,
      showLabel: true,
      detailMode: true,
      stopLoad: false,
      isLoading: false,
      worksLoadState: 'idle',
      resettingSearchControls: false,
      worksRequestId: 0,
      titleRequestId: 0,
      activeWorkListMode: null,
      WORK_LIST_MODES,
      works: [],
      pageTitle: '',
      searchMetas: [],
      page: 1,
      pagination: { currentPage:0, pageSize:12, totalCount:0 },
      seed: 7, // random sort

      // 排序种类，例如可以选择按照发售日期来排序结果
      sortCategoryOption: "release",
      sortCategoryOptions: ["release", "rating", "dl_count", "price", "rate_average_2dp", "review_count", "id", "created_at", "random"],

      nsfwOption: "nsfw_0", 
      nsfwOptions: ["nsfw_0", "nsfw_1", "nsfw_2"], // nsfw_0无年龄限制，nsfw_1全年龄，nsfw_2十八禁

      lyricOption: [], // 注意，这个选项可多选，但是clear的时候，quasar可能会将其设置为null，需要特别注意
      lyricOptions: ["lyric_local"],
      collections: [],
      loadingCollections: false,

      // 排序顺序，true表示降序，false表示升序
      sortInDesc: true,

      touchedWorkId: 0, // 用来解决android移动端设备没有hover事件导致workCard不能跟随手指显示标签的问题

      /*
        advanceSearchKeywords
        [
          {t: 1, d: "異世界"}, // 模糊匹配，目前只实现这一个
          {t: 2, d: "恋鈴桃歌"}, // 声优匹配，实际搜索字段在前端就要变成id
          {t: 3, d: "环绕音"}, // 标签匹配，实际搜索字段在前端就要变成id
          {t: 3, d: "治愈"}, // 标签匹配，实际搜索字段在前端就要变成id
          {t: 4, d: "Delivery Voice"}, // 社团匹配，实际搜索字段在前端就要变成id
        ]
      */
      advanceSearchKeywords: [],
      isAdvanceSearch: false,
    }
  },

  created () {
    this.refreshPageTitle();
    this.seed = Math.floor(Math.random() * 98) + 2;
  },

  mounted() {
    if (localStorage.sortCategoryOption) {
      this.sortCategoryOption = localStorage.sortCategoryOption;
    }
    if (localStorage.nsfwOption) {
      this.nsfwOption = localStorage.nsfwOption;
    }
    if (localStorage.lyricOption) {
      const savedLyricOptions = JSON.parse(localStorage.lyricOption);
      this.lyricOption = Array.isArray(savedLyricOptions)
        ? savedLyricOptions.filter(option => this.lyricOptions.includes(option))
        : [];
    }
    if (localStorage.sortInDesc) {
      this.sortInDesc = (localStorage.sortInDesc === 'true');
    }
    if (localStorage.showLabel) {
      this.showLabel = (localStorage.showLabel === 'true');
    }
    if (localStorage.listMode) {
      this.listMode = (localStorage.listMode === 'true');
    }
    if (localStorage.detailMode) {
      this.detailMode = (localStorage.detailMode === 'true');
    }
    if (localStorage.advanceSearchKeywords) {
      this.advanceSearchKeywords = JSON.parse(localStorage.advanceSearchKeywords || "[]");
    }

    this.checkAdvanceSearchMode()
    this.consumeSearchKeyword()
    this.activeWorkListMode = this.workListMode
    if (this.workListMode === WORK_LIST_MODES.PAGINATION && !this.polishPageQuery()) {
      this.reset(this.requestedPage)
    }
  },

  computed: {
    savedSearchValue () {
      const query = { ...this.$route.query }
      delete query.page
      if (this.isAdvanceSearch) delete query.keyword
      return { path: this.isAdvanceSearch ? '/search' : '/works', query, filters: { order: this.sortCategoryOption, sort: this.sortInDesc ? 'desc' : 'asc', nsfw: Number(this.nsfwOption.replace('nsfw_', '')), lyric: this.lyricOption || [], keywords: this.advanceSearchKeywords } }
    },
    selectionContext () {
      const query = { ...this.$route.query }; delete query.page
      return JSON.stringify([this.$route.path, query, this.nsfwOption, this.lyricOption, this.advanceSearchKeywords, this.$store.state.User.name])
    },
    hasSearch () {
      return Boolean(this.$route.query.keyword || (this.isAdvanceSearch && this.advanceSearchKeywords.length))
    },

    hasFilters () {
      const query = this.$route.query
      return Boolean(query.circleId || query.tagId || query.vaId || this.collectionId
        || this.lyricOption?.length
        || (!this.$store.getters['AudioPlayer/sfwOnly'] && this.nsfwOption !== 'nsfw_0'))
    },

    collectionId () {
      const id = this.$route.query.collectionId
      return typeof id === 'string' && /^[1-9]\d*$/.test(id) ? id : null
    },

    collectionOptions () {
      return this.collections.map(item => ({ label: item.name, value: String(item.id) }))
    },

    url () {
      const query = this.$route.query
      if (query.circleId) {
        return `/api/circles/${this.$route.query.circleId}/works`
      } else if (query.tagId) {
        return `/api/tags/${this.$route.query.tagId}/works`
      } else if (query.vaId) {
        return `/api/vas/${this.$route.query.vaId}/works`
      } else if (query.keyword || this.isAdvanceSearch) {
        // keyword should pass in as a query param later
        return `/api/search`
      } else {
        return '/api/works'
      }
    },

    requestedPage () {
      const page = Number.parseInt(this.$route.query.page, 10)
      return Number.isFinite(page) && page > 0 ? page : 1
    },

    displayPage () {
      return this.isLoading ? this.requestedPage : Math.max(1, this.pagination.currentPage)
    },

    maxPages () {
      return Math.max(1, Math.ceil(this.pagination.totalCount / this.pagination.pageSize))
    },

    ...mapState('AudioPlayer', [
      'enableShowRecent',
      'workListMode',
    ]),
  },

  // keep-alive hooks
  // <keep-alive /> is set in MainLayout
  activated () {
    this.loadCollections()
    if (this.activeWorkListMode !== this.workListMode) {
      this.activeWorkListMode = this.workListMode
      if (!this.polishPageQuery()) this.reset(this.workListMode === WORK_LIST_MODES.PAGINATION ? this.requestedPage : 1)
    } else if (this.workListMode === WORK_LIST_MODES.WATERFALL && this.works.length < this.pagination.totalCount) {
      this.stopLoad = false
    }

  },

  beforeRouteLeave (to, from, next) {
    rememberWorksScroll(from.fullPath)
    next()
  },

  deactivated () {
    this.exitSelection()
    this.stopLoad = true
  },

  beforeUnmount () {
    this.worksRequestId++
    this.titleRequestId++
  },

  watch: {
    selecting (value) { if (value && !this.$store.state.AudioPlayer.hide) this.$store.commit('AudioPlayer/TOGGLE_HIDE') },
    selectionContext () { this.exitSelection() },
    url () {
      this.reset()
    },

    sortCategoryOption (v) {
      localStorage.sortCategoryOption = v;
      if (v === 'random') this.seed = Math.floor(Math.random() * 98) + 2;
      this.reset()
    },

    nsfwOption (v) {
      localStorage.nsfwOption = v;
      this.reset()
    },

    lyricOption (v) {
      if (v === null) v = [];
      localStorage.lyricOption = JSON.stringify(v, null, 0);
      this.reset()
    },

    sortInDesc (v) {
      localStorage.sortInDesc = v;
      this.reset()
    },

    showLabel (newLabelSetting) {
      localStorage.showLabel = newLabelSetting;
      this.$nextTick(() => this.$refs.virtualList?.refresh())
    },

    listMode (newListModeSetting) {
      localStorage.listMode = newListModeSetting;
    },

    detailMode(newModeSetting) {
      localStorage.detailMode = newModeSetting;
    },

    advanceSearchKeywords: {
      handler(newValue) {
        localStorage.advanceSearchKeywords = JSON.stringify(newValue, null, 0)
        this.reset()
      },
      deep: true
    },

    '$route.name': {
      handler: function() {
        // 高级搜索模式通过route.name进行判断，因此当这个属性变化的时候，需要及时更新状态，
        // 否则会出现url跳转到聚合搜索页面后，页面没有更新的问题，
        // 因为被vue复用组件了，需要重新检查一遍
        this.checkAdvanceSearchMode()
      },
      deep: true,
      immediate: true
    },

    '$route.fullPath' () {
      this.checkAdvanceSearchMode()
      this.consumeSearchKeyword()
    },

    '$route.query.keyword'() {
      if (!this.isAdvanceSearch) this.reset()
    },

    '$route.query.collectionId'() {
      this.reset(this.requestedPage)
    },

    '$route.query.page'() {
      if (this.workListMode === WORK_LIST_MODES.PAGINATION) this.reset(this.requestedPage)
    },
  },

  methods: {
    exitSelection () { this.selecting = false; this.selectedWorks = []; this.selectionAnchor = null },
    toggleSelection (id, event) {
      const ids = this.works.map(work => work.id)
      const start = ids.indexOf(this.selectionAnchor), end = ids.indexOf(id)
      const values = event.shiftKey && start >= 0 ? ids.slice(Math.min(start, end), Math.max(start, end) + 1) : [id]
      const selected = new Set(this.selectedWorks)
      const remove = selected.has(id)
      values.forEach(value => remove ? selected.delete(value) : selected.add(value))
      if (selected.size > 1000) return this.showWarnNotif(t('batchWorks.limit'))
      this.selectedWorks = [...selected]
      this.selectionAnchor = id
    },
    selectLoaded () {
      const selected = [...new Set([...this.selectedWorks, ...this.works.map(work => work.id)])]
      if (selected.length > 1000) return this.showWarnNotif(t('batchWorks.limit'))
      this.selectedWorks = selected
    },
    batchCompleted (result) {
      this.selectedWorks = result.missing
      this.reset(this.workListMode === WORK_LIST_MODES.PAGINATION ? this.requestedPage : 1)
    },
    async applySavedSearch (search) {
      if (search.unavailable) return this.showWarnNotif(t('savedSearch.unavailable'))
      if (search.query.collectionId && !this.collections.some(item => String(item.id) === search.query.collectionId)) return this.showWarnNotif(t('savedSearch.unavailable'))
      this.resettingSearchControls = true
      try {
        this.sortCategoryOption = search.filters.order
        this.sortInDesc = search.filters.sort === 'desc'
        this.nsfwOption = `nsfw_${search.filters.nsfw}`
        this.lyricOption = [...search.filters.lyric]
        this.advanceSearchKeywords = search.filters.keywords.map(item => ({ ...item }))
        await this.$router.push({ path: search.path, query: { ...search.query } })
        await this.$nextTick()
      } finally { this.resettingSearchControls = false; this.reset() }
    },
    async loadCollections () {
      if (this.loadingCollections) return
      this.loadingCollections = true
      try {
        const response = await this.$axios.get('/api/library/collections')
        this.collections = response.data.collections || []
      } catch (error) {
        this.showErrNotif(error.response?.data?.error || t('works.loadCollectionsFailed'))
      } finally {
        this.loadingCollections = false
      }
    },

    setCollectionFilter (value) {
      const query = { ...this.$route.query }
      delete query.page
      if (value) query.collectionId = String(value)
      else delete query.collectionId
      this.$router.push({ query })
    },

    onLoad (index, done) {
      if (this.workListMode === WORK_LIST_MODES.PAGINATION) {
        done()
        return
      }
      this.requestWorksQueue()
        .then(() => done())
    },

    requestWorksQueue (pageOverride) {
      if (this.isLoading && pageOverride === undefined) return Promise.resolve(false)
      const requestId = ++this.worksRequestId
      this.isLoading = true
      this.worksLoadState = 'loading'
      const params = {
        page: pageOverride || this.pagination.currentPage + 1 || 1,
        sort: this.sortInDesc ? "desc" : "asc",
        order: this.sortCategoryOption,
        nsfw: parseInt(this.nsfwOption.replace("nsfw_", "")), // 'nsfw_0' => 0, 'nsfw_1' => 1, 'nsfw_2' => 2
        lyric: this.lyricOption === null ? "" : this.lyricOption.map(o => o.replace("lyric_", "")).sort().join("_"),
        seed: this.seed,
        isAdvance: this.isAdvanceSearch ? 1 : 0
      }
      if (this.collectionId) params.collectionId = this.collectionId

      if (this.isAdvanceSearch) {
        params.keyword = JSON.stringify(this.advanceSearchKeywords, null, 0)
      } else if (this.$route.query.keyword) {
        params.keyword = this.$route.query.keyword
      }

      return this.$axios.get(this.url, { params })
        .then((response) => {
          if (requestId !== this.worksRequestId) return false
          const works = response.data.works
          this.works = this.workListMode === WORK_LIST_MODES.PAGINATION || params.page === 1
            ? works.concat()
            : this.works.concat(works)
          this.pagination = response.data.pagination
          this.worksLoadState = 'success'

          this.stopLoad = this.works.length >= this.pagination.totalCount
          return true
        })
        .catch((error) => {
          if (requestId !== this.worksRequestId) return false
          this.worksLoadState = 'error'
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            if (error.response.status !== 401) {
              this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
            }
          } else {
            this.showErrNotif(error.message || error)
          }
          this.stopLoad = true
          return false
        })
        .finally(() => {
          if (requestId === this.worksRequestId) this.isLoading = false
        })
    },

    refreshPageTitle () {
      const requestId = ++this.titleRequestId
      if (this.$route.query.circleId || this.$route.query.tagId || this.$route.query.vaId) {
        let url = '', restrict = ''
        if (this.$route.query.circleId) {
          restrict = 'circles'
          url = `/api/${restrict}/${this.$route.query.circleId}`
        } else if (this.$route.query.tagId) {
          restrict = 'tags'
          url = `/api/${restrict}/${this.$route.query.tagId}`
        } else {
          restrict = 'vas'
          url = `/api/${restrict}/${this.$route.query.vaId}`
        }

        this.$axios.get(url)
          .then((response) => {
            if (requestId !== this.titleRequestId) return
            const name = response.data.name
            let pageTitle

            switch (restrict) {
              case 'tags':
                pageTitle = 'works.searchTag'
                break
              case 'vas':
                pageTitle = 'works.searchVoiceActor'
                break
              case 'circles':
                pageTitle = 'works.searchCircle'
                break
            }
            // pageTitle += name || ''
            this.searchMetas = [name]
            this.pageTitle = pageTitle
          })
          .catch((error) => {
            if (requestId !== this.titleRequestId) return
            if (error.response) {
              // 请求已发出，但服务器响应的状态码不在 2xx 范围内
              if (error.response.status !== 401) {
                this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
              }
            } else {
              this.showErrNotif(error.message || error)
            }
          })
      } else if (this.isAdvanceSearch) {
        this.pageTitle = 'common.advancedSearch'
        this.searchMetas = []
      } else if (this.$route.query.keyword) {
        this.pageTitle = 'works.searchKeyword';
        this.searchMetas = [this.$route.query.keyword];
      } else {
        this.pageTitle = 'works.allWorks'
        this.searchMetas = [];
      }
    },

    async reset (page = 1) {
      const requestId = ++this.worksRequestId
      this.worksLoadState = 'idle'
      if (this.resettingSearchControls) return
      // Coalesce filter watchers and invalidate responses before the next request.
      await this.$nextTick()
      if (requestId !== this.worksRequestId) return
      this.stopLoad = true
      this.refreshPageTitle()
      this.pagination = { currentPage: page - 1, pageSize: this.pagination.pageSize || 12, totalCount: this.pagination.totalCount || 0 }
      this.works = []
      this.requestWorksQueue(this.workListMode === WORK_LIST_MODES.PAGINATION ? page : 1)
    },

    async recoverEmptyResults (action) {
      this.resettingSearchControls = true
      this.worksRequestId++
      this.worksLoadState = 'idle'
      const query = { ...this.$route.query }
      delete query.page
      if (this.workListMode === WORK_LIST_MODES.PAGINATION) query.page = '1'
      if (action === 'search') {
        delete query.keyword
        if (this.isAdvanceSearch) this.advanceSearchKeywords = []
      } else {
        for (const key of ['circleId', 'tagId', 'vaId', 'collectionId']) delete query[key]
        this.lyricOption = []
        if (!this.$store.getters['AudioPlayer/sfwOnly']) this.nsfwOption = 'nsfw_0'
      }
      try {
        await this.$router.push({ query })
      } finally {
        await this.$nextTick()
        this.resettingSearchControls = false
        this.reset()
      }
    },

    gotoPage (page) {
      if (page === this.requestedPage) return
      this.$router.push({ query: { ...this.$route.query, page } }).catch(() => {})
    },

    polishPageQuery () {
      if (this.workListMode === WORK_LIST_MODES.PAGINATION && !this.$route.query.page) {
        this.$router.replace({ query: { ...this.$route.query, page: 1 } }).catch(() => {})
        return true
      }
      if (this.workListMode === WORK_LIST_MODES.WATERFALL && this.$route.query.page) {
        const query = { ...this.$route.query }
        delete query.page
        this.$router.replace({ query }).catch(() => {})
        return true
      }
      return false
    },

    // 将一些标签名称转换成可阅读的文字
    // 例如排序属性中，有release作为标记，release通常用来直接传递给服务器，
    // 通过这个函数可以将release转换成更加可阅读的文字标签“发售日期”
    humanReadableLabel(label) {
      switch(label) {
        case "release": return t('works.releaseDate');
        case "rating": return t('common.myRating');
        case "dl_count": return t('works.sales');
        case "price": return t('works.price');
        case "rate_average_2dp": return t('works.rating');
        case "review_count": return t('works.reviewCount');
        case "id": return t('works.workCode');
        case "created_at": return t('works.addedAt');
        case "random": return t('works.random');
        case "nsfw_0": return t('works.allRatings');
        case "nsfw_1": return t('works.allAges');
        case "nsfw_2": return t('works.adult');
        case "lyric_local": return t('common.localLyrics');
        default: return label;
      }
    },

    onWorkCardTouch(id) {
      this.touchedWorkId = id;
      console.log('touch on work id = ', id);
    },

    checkAdvanceSearchMode() {
      this.isAdvanceSearch = this.$route.name == "advance search";
    },

    consumeSearchKeyword () {
      if (!this.isAdvanceSearch || typeof this.$route.query.keyword !== 'string') return
      this.onAddAdvanceSearchKeyword(this.$route.query.keyword)
      const query = { ...this.$route.query }
      delete query.keyword
      delete query.page
      this.$router.replace({ query })
    },

    onAddAdvanceSearchKeyword(value) {
      const keyword = value.trim()
      if (keyword === "") {
        this.showErrNotif(t('works.emptyKeyword'));
        return;
      }

      for (let kw of this.advanceSearchKeywords) {
        if (kw.t == AdvanceSearchCondType.FUZZY && kw.d == keyword) {
          this.showErrNotif(t('works.duplicateKeyword'));
          return;
        }
      }


      this.advanceSearchKeywords.push({
        t: AdvanceSearchCondType.FUZZY,
        d: keyword,
      });
    },

    removeAdvanceSearchKeyword(index) {
      this.advanceSearchKeywords.splice(index, 1);
    }

  },
}
</script>

<style lang="scss" scoped>
.works-page { max-width: 1560px; margin: 0 auto; }
.works-results { margin: 0 16px; }
.works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(256px, 1fr));
  gap: 18px 16px;
  align-items: stretch;
}
.works-grid--compact {
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 14px;
}
.works-grid-item { min-width: 0; height: 100%; }
.works-skeleton-card {
  background: var(--kikoeru-surface);
  border-color: var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  overflow: hidden;
}
.works-empty { padding: 40px 20px; margin: 8px 0 32px; text-align: center; background: var(--kikoeru-surface); border: 1px solid var(--kikoeru-border); border-radius: var(--kikoeru-radius-md); }
.works-empty > .q-icon { color: var(--kikoeru-muted); }
.works-empty h3 { margin: 14px 0 8px; font-size: 20px; line-height: 28px; font-weight: 500; }
.works-empty p { margin: 0 auto; max-width: 480px; color: var(--kikoeru-muted); line-height: 1.6; }
.works-empty-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 20px; }
.works-empty-actions .q-btn { min-height: 40px; }
.works-toolbar {
  --toolbar-surface: var(--kikoeru-surface);
  --toolbar-border: var(--kikoeru-border);
  --toolbar-muted: var(--kikoeru-muted);
  --toolbar-inset: var(--kikoeru-inset);
  margin: 12px 16px 14px;
  padding: 12px 16px 14px;
  border: 1px solid var(--toolbar-border);
  border-radius: var(--kikoeru-radius-md);
  background: var(--toolbar-surface);
}
.works-toolbar-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.works-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.works-title > .q-icon { color: var(--kikoeru-accent-text); flex-shrink: 0; }
.works-title h2 { margin: 0; font-size: 18px; font-weight: 600; line-height: 26px; letter-spacing: 0; overflow-wrap: anywhere; }
.works-count { padding: 1px 8px; border-radius: 5px; color: var(--toolbar-muted); background: var(--toolbar-inset); border: 1px solid var(--toolbar-border); font-size: 12px; font-variant-numeric: tabular-nums; }
.works-display-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; max-width: 100%; }
.works-display-controls :deep(.q-btn) { height: 32px; min-height: 32px; padding: 0 10px; border-radius: var(--kikoeru-radius-sm); font-size: 12.5px; color: var(--kikoeru-text); background: var(--toolbar-inset); border: 1px solid var(--toolbar-border); transition: border-color .14s ease, background-color .14s ease, color .14s ease; }
.works-display-controls :deep(.q-btn:hover) { border-color: color-mix(in srgb, var(--kikoeru-text) 24%, transparent); }
.works-display-controls :deep(.q-btn__content) { flex-wrap: nowrap; gap: 5px; white-space: nowrap; }
.works-display-controls :deep(.q-icon) { font-size: 16px; margin: 0; color: var(--toolbar-muted); }
.works-view-options { display: flex; gap: 2px; padding: 2px; height: 32px; border-radius: var(--kikoeru-radius-sm); background: var(--toolbar-inset); border: 1px solid var(--toolbar-border); }
.works-view-options :deep(.q-btn) { flex: 1; height: 26px; min-height: 26px; padding: 0 9px; border: 0; border-radius: 4px; background: transparent; color: var(--toolbar-muted); }
.works-view-options :deep(.q-btn:hover) { color: var(--kikoeru-text); border: 0; }
.works-view-options :deep(.is-selected) { color: var(--kikoeru-accent-text); background: var(--kikoeru-active-bg); }
.works-view-options :deep(.is-selected .q-icon) { color: var(--kikoeru-accent-text); }
.works-filter-fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.works-filter-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.works-filter-label { font-size: 11.5px; font-weight: 500; color: var(--toolbar-muted); line-height: 1.2; padding-left: 2px; }
.works-filter-select {
  min-width: 0;
  width: 100%;
  border-radius: var(--kikoeru-radius-sm);
  background: var(--toolbar-inset);
  border: 1px solid var(--toolbar-border);
  padding: 0 8px 0 10px;
  transition: border-color .14s ease, background-color .14s ease;
}
.works-filter-select:hover:not(.q-field--disabled) { border-color: color-mix(in srgb, var(--kikoeru-text) 24%, transparent); }
.works-filter-select.q-field--focused { border-color: color-mix(in srgb, var(--q-primary) 55%, transparent); }
.works-filter-select.is-active { background: var(--kikoeru-active-bg); border-color: color-mix(in srgb, var(--q-primary) 38%, transparent); }
.works-filter-select :deep(.q-field__control) { min-height: 32px; height: 32px; padding: 0; }
.works-filter-select :deep(.q-field__control-container) { min-height: 32px; padding: 0; }
.works-filter-select :deep(.q-field__native) { min-height: 32px; padding: 0; font-size: 13px; font-weight: 500; color: var(--kikoeru-text); letter-spacing: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.works-filter-select :deep(.q-field__native > span) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.works-filter-select :deep(.q-field__append) { height: 32px; padding-left: 4px; color: var(--toolbar-muted); }
.works-filter-select :deep(.q-select__dropdown-icon) { font-size: 18px; }
.works-filter-select :deep(.q-field__marginal) { height: 32px; font-size: 16px; }
.works-search-chips { margin: 12px 0 0; }
.works-search-chip-list { display: flex; flex-wrap: wrap; gap: 8px; }
.works-search-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-text);
  font-size: 12.5px;
  line-height: 1.4;
}
.works-search-chip-close { color: var(--kikoeru-muted); margin-right: -4px; }
.works-search-chip-close:hover { color: var(--kikoeru-text); }
.works-toolbar--selecting { position: sticky; top: 56px; z-index: 20; background: var(--kikoeru-surface); }
.works-list {
  max-width: 1180px;
  margin: 0 auto;
  width: 100%;
  background: var(--kikoeru-surface);
  border-color: var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  overflow: hidden;
  box-shadow: none;
}
.works-list :deep(.q-separator) { background: var(--kikoeru-border); }
.works-end-note {
  padding: 28px 0 36px;
  color: var(--kikoeru-muted);
  font-size: 13px;
  text-align: center;
}
.works-toolbar .q-btn:focus-visible { outline: 2px solid var(--kikoeru-accent-text); outline-offset: 2px; }
@media (max-width: 699px) {
  .works-results { margin: 0 12px; }
  .works-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .works-grid--compact { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .works-toolbar { margin: 12px 12px 14px; padding: 12px; }
  .works-title h2 { font-size: 18px; }
  .works-toolbar-heading { gap: 12px; }
  .works-display-controls { flex-basis: 100%; gap: 8px; }
  .works-display-controls > :deep(.q-btn) { flex: 1 0 auto; }
  .works-view-options { flex-basis: 100%; }
  .works-filter-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
}

  .list {
    // 宽度 >= $breakpoint-sm-min
    @media (min-width: $breakpoint-sm-min) {
      padding: 0px 20px;
    }
  }

  .work-card {
    // 宽度 > $breakpoint-xl-min
    @media (min-width: $breakpoint-md-min) {
      width: 560px;
    }
  }
</style>
