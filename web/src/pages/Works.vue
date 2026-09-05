<template>
  <div>
    <!--没有搜索的情况下，显示最近播放作品-->
    <RecentWorks v-if="enableShowRecent && !isAdvanceSearch && searchMetas.length == 0 && !collectionId" />

    <!--
      TODO: 当前版本的quasar的input在iOSsafari中输入中文时有bug，
      拼音也会被更新到data中，看了一下quasar官网的demo是没有这个问题的（版本不明），
      用原生的input组件也没有问题，应该是这个项目里quasar版本太老，有些bug，
      以后升级quasar版本试试能不能解决这个问题
    -->
    <div v-if="isAdvanceSearch" class="q-pa-md q-full-width">
      <q-input
        outlined
        autofocus
        label="关键字搜索"
        :hint="advanceSearchBarHint"
        v-model="editKeyword"
        @keyup.enter="onAddAdvanceSearchKeyword"
      >
        <template v-slot:append>
          <q-btn round dense flat icon="add" @click="onAddAdvanceSearchKeyword"/>
        </template>
      </q-input>
    </div>
    
    <div class="q-mt-lg q-ml-md row items-center">
      <span class="text-h5 text-weight-regular q-pa-xs relative-position">
        {{pageTitle}}
        <q-badge color="secondary" floating>{{pagination.totalCount}}</q-badge>
      </span>
      <div v-if="isAdvanceSearch"><!--高级搜索模式的多关键字展示-->
        <q-badge class="q-ma-xs" v-for="meta,index in advanceSearchKeywords" :key="meta.t+meta.d">
          {{ meta.d }}
          <q-btn
            class="q-ml-sm search-tag-close-btn"
            padding="xs"
            round
            flat 
            size="xs"
            icon="close"
            @click="removeAdvanceSearchKeyword(index)"
          />
        </q-badge>
      </div>
      <div v-else> <!--普通搜索模式的信息展示-->
        <q-badge class="q-ma-xs" v-for="meta, index in searchMetas" :key="meta">{{ index == 0 ? "":"," }} {{ meta }}</q-badge>
      </div>
    </div>

    <div class="works-filters row justify-between q-mb-md q-mx-sm">
      <div class="works-filter-fields">
      <!-- 排序属性 -->
      <q-select
        dense
        rounded
        outlined
        bg-color=""
        transition-show="scale"
        transition-hide="scale"
        v-model="sortCategoryOption"
        :options="sortCategoryOptions"
        :option-label="humanReadableLabel"
        label="排序属性"
        class="col-auto"
      />

      <!-- 年龄分级 -->
      <q-select
        dense
        rounded
        outlined
        bg-color=""
        transition-show="scale"
        transition-hide="scale"
        v-model="nsfwOption"
        :options="nsfwOptions"
        :option-label="humanReadableLabel"
        label="年龄分级"
        class="col-auto"
      />

      <!-- 字幕筛选 -->
      <q-select
        dense
        rounded
        outlined
        bg-color=""
        transition-show="scale"
        transition-hide="scale"
        v-model="lyricOption"
        :options="lyricOptions"
        :option-label="humanReadableLabel"
        label="字幕筛选"
        clearable
        multiple
        class="col-auto works-filter-lyrics"
      />

      <q-select
        dense
        rounded
        outlined
        :model-value="collectionId"
        @update:model-value="setCollectionFilter"
        :options="collectionOptions"
        :loading="loadingCollections"
        emit-value
        map-options
        clearable
        label="作品分组"
        :display-value="collectionId ? (collections.find(item => String(item.id) === collectionId)?.name || '分组不可用') : '全部分组'"
        @popup-show="loadCollections"
      >
        <template #no-option>
          <q-item><q-item-section class="text-grey">暂无作品分组</q-item-section></q-item>
        </template>
      </q-select>
      </div>

      <div class="works-display-controls">
      <!-- 排序顺序 -->
      <q-toggle v-model="sortInDesc" :label="sortInDesc ? '降序' : '升序'" />

      <!-- 切换显示模式按钮 -->
      <q-btn-toggle
        dense
        spread
        rounded
        v-model="listMode"
        toggle-color="primary"
        color="white"
        text-color="primary"
        :options="[
          { icon: 'apps', value: false },
          { icon: 'list', value: true }
        ]"
        style="width: 85px;"
        class="col-auto works-view-toggle"
      />

      <q-btn-toggle
        dense
        spread
        rounded
        v-model="showLabel"
        toggle-color="primary"
        color="white"
        text-color="primary"
        :options="[
          { icon: 'label', value: true },
          { icon: 'label_off', value: false }
        ]"
        style="width: 85px;"
        class="col-auto"
        v-if="$q.screen.width > 700 && listMode"
      />

      <q-btn-toggle
        dense
        spread
        rounded
        :disable="$q.screen.width < 1120"
        v-model="detailMode"
        toggle-color="primary"
        color="white"
        text-color="primary"
        :options="[
          { icon: 'zoom_in', value: true },
          { icon: 'zoom_out', value: false },
        ]"
        style="width: 85px;"
        class="col-auto"
        v-if="$q.screen.width > 700 && !listMode"
      />

      </div>
    </div>

    <div :class="`row justify-center ${listMode ? 'list' : 'q-mx-md'}`">
      <q-infinite-scroll ref="infiniteScroller" @load="onLoad" :offset="250" :disable="stopLoad || workListMode === WORK_LIST_MODES.PAGINATION" class="col">

        <div v-if="workListMode === WORK_LIST_MODES.PAGINATION" class="row justify-center q-pb-lg">
          <q-pagination :model-value="displayPage" :max="maxPages" :max-pages="7" boundary-links direction-links color="primary" @update:model-value="gotoPage" />
        </div>

        <div v-if="workListMode === WORK_LIST_MODES.PAGINATION && isLoading" class="row justify-center q-py-xl">
          <q-spinner-dots color="primary" size="40px" />
        </div>

        <q-virtual-scroll
          v-if="listMode && workListMode === WORK_LIST_MODES.WATERFALL"
          ref="virtualList"
          :items="works"
          scroll-target="body"
          :virtual-scroll-item-size="90"
          bordered separator class="shadow-2"
        >
          <template #default="{ item }">
            <WorkListItem :key="item.id" :metadata="item" :showLabel="showLabel && $q.screen.width > 700" />
          </template>
        </q-virtual-scroll>
        <q-list v-else-if="listMode" bordered separator class="shadow-2">
          <WorkListItem v-for="work in works" :key="work.id" :metadata="work" :showLabel="showLabel && $q.screen.width > 700" />
        </q-list>

        <!--旧式的workCard展示-->
        <div v-if="!listMode && oldWorkCardUIStyle" class="row q-col-gutter-x-md q-col-gutter-y-lg">
          <div class="col-xs-12 col-sm-6 col-md-4" v-for="work in works" :key="work.id"
            :class="detailMode ? 'col-lg-3 col-xl-2': 'col-lg-2 col-xl-2'"
          >
            <OldWorkCard :metadata="work" :thumbnailMode="!detailMode" class="fit"/>
          </div>
        </div>

        <!--解决android平台hover事件不像safari那样及时响应的问题，需要手动添加触摸响应时间-->
        <div v-else-if="!listMode && $q.platform.is.android && $q.platform.has.touch" class="row q-col-gutter-x-md q-col-gutter-y-lg">
          <div class="col-xs-12 col-sm-6 col-md-4" v-for="work in works" :key="work.id"
            @touchstart="()=>onWorkCardTouch(work.id)"
            :class="detailMode ? 'col-lg-3 col-xl-2': 'col-lg-2 col-xl-2'"
            :style="{ '--sim-hover-work-card': work.id === touchedWorkId ? '1' : '0'}"
          >
            <WorkCard :metadata="work" :thumbnailMode="!detailMode" class="fit" @library-changed="reset()"/>
          </div>
        </div>

        <!--正常的workCard展示-->
        <div v-else-if="!listMode" class="row q-col-gutter-x-md q-col-gutter-y-lg">
          <div class="col-xs-12 col-sm-6 col-md-4" v-for="work in works" :key="work.id"
            :class="detailMode ? 'col-lg-3 col-xl-2': 'col-lg-2 col-xl-2'"
            style="--sim-hover-work-card: 0"
          >
            <WorkCard :metadata="work" :thumbnailMode="!detailMode" class="fit" @library-changed="reset()"/>
          </div>
        </div>

        <div v-if="workListMode === WORK_LIST_MODES.PAGINATION && !isLoading && works.length > 4" class="row justify-center q-py-lg">
          <q-pagination :model-value="displayPage" :max="maxPages" :max-pages="7" boundary-links direction-links color="primary" @update:model-value="gotoPage" />
        </div>

        <div v-show="workListMode === WORK_LIST_MODES.WATERFALL && stopLoad" class="q-mt-lg q-mb-xl text-h6 text-bold text-center">无更多作品</div>

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
import WorkCard from 'components/WorkCard.vue'
import WorkListItem from 'components/WorkListItem.vue'
import NotifyMixin from '../mixins/Notification.js'
import RecentWorks from 'src/components/RecentWorks.vue'
import { mapState } from 'vuex'
import OldWorkCard from 'src/components/OldWorkCard.vue'
import { AdvanceSearchCondType } from '../utils.js'
import { WORK_LIST_MODES } from '../store/module-AudioPlayer/state'

export default {
  name: 'Works',

  mixins: [NotifyMixin],

  components: {
    WorkCard,
    OldWorkCard,
    WorkListItem,
    RecentWorks,
  },

  data () {
    return {
      listMode: false,
      showLabel: true,
      detailMode: true,
      stopLoad: false,
      isLoading: false,
      worksRequestId: 0,
      titleRequestId: 0,
      activeWorkListMode: null,
      savedScrollPosition: 0,
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
      editKeyword: "",
      advanceSearchKeywords: [],
      isAdvanceSearch: false,
    }
  },

  created () {
    this.refreshPageTitle();
    this.seed = Math.floor(Math.random() * 100);
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
    this.activeWorkListMode = this.workListMode
    if (this.workListMode === WORK_LIST_MODES.PAGINATION && !this.polishPageQuery()) {
      this.reset(this.requestedPage)
    }
  },

  computed: {
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

    advanceSearchBarHint() {
      if (this.editKeyword === "") return "模糊关键字，可搜索作品名、声优名、标签名、社团名"
      else return "按回车或者右侧加号添加"
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
      'oldWorkCardUIStyle',
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

    this.$nextTick(() => {
      setTimeout(() => {
        requestAnimationFrame(() => window.scrollTo(0, this.savedScrollPosition))
      }, 0)
    })
  },

  beforeRouteLeave (to, from, next) {
    this.savedScrollPosition = window.scrollY
    next()
  },

  deactivated () {
    this.stopLoad = true
  },

  beforeUnmount () {
    this.worksRequestId++
    this.titleRequestId++
  },

  watch: {
    url () {
      this.reset()
    },

    sortCategoryOption (v) {
      localStorage.sortCategoryOption = v;
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

    '$route.query.keyword'() {
      this.reset()
    },

    '$route.query.collectionId'() {
      this.reset(this.requestedPage)
    },

    '$route.query.page'() {
      if (this.workListMode === WORK_LIST_MODES.PAGINATION) this.reset(this.requestedPage)
    },
  },

  methods: {
    async loadCollections () {
      if (this.loadingCollections) return
      this.loadingCollections = true
      try {
        const response = await this.$axios.get('/api/library/collections')
        this.collections = response.data.collections || []
      } catch (error) {
        this.showErrNotif(error.response?.data?.error || '读取作品分组失败')
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

          this.stopLoad = this.works.length >= this.pagination.totalCount
          return true
        })
        .catch((error) => {
          if (requestId !== this.worksRequestId) return false
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
                pageTitle = '搜索标签：'
                break
              case 'vas':
                pageTitle = '搜索声优：'
                break
              case 'circles':
                pageTitle = '社团作品：'
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
      } else if (this.$route.query.keyword) {
        this.pageTitle = '搜索关键字：';
        this.searchMetas = [this.$route.query.keyword];
      } else if (this.isAdvanceSearch) {
        this.pageTitle = '聚合搜索：'

      } else {
        this.pageTitle = '所有作品'
        this.searchMetas = [];
      }
    },

    reset (page = 1) {
      this.seed = Math.floor(Math.random() * 100);
      this.stopLoad = true
      this.refreshPageTitle()
      this.pagination = { currentPage: page - 1, pageSize: this.pagination.pageSize || 12, totalCount: this.pagination.totalCount || 0 }
      this.works = []
      this.requestWorksQueue(this.workListMode === WORK_LIST_MODES.PAGINATION ? page : 1)
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
        case "release": return "发售日期";
        case "rating": return "我的评价";
        case "dl_count": return "售出数量";
        case "price": return "售出价格";
        case "rate_average_2dp": return "听众评分";
        case "review_count": return "评论数量";
        case "id": return "作品番号";
        case "created_at": return "添加时间";
        case "random": return "随机排序";
        case "nsfw_0": return "所有分级";
        case "nsfw_1": return "全年龄";
        case "nsfw_2": return "十八禁";
        case "lyric_local": return "本地歌词";
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

    onAddAdvanceSearchKeyword() {
      const keyword = this.editKeyword.trim()
      if (keyword === "") {
        this.showErrNotif("无法添加空白的关键字");
        return;
      }

      for (let kw of this.advanceSearchKeywords) {
        if (kw.t == AdvanceSearchCondType.FUZZY && kw.d == keyword) {
          this.showErrNotif("关键字重复，添加失败");
          return;
        }
      }


      this.advanceSearchKeywords.push({
        t: AdvanceSearchCondType.FUZZY,
        d: keyword,
      });
      this.editKeyword = "";
      this.reset();
    },

    removeAdvanceSearchKeyword(index) {
      this.advanceSearchKeywords.splice(index, 1);
    }

  },
}
</script>

<style lang="scss" scoped>
.works-filters {
  align-items: center;
  gap: 12px;
}

.works-filter-lyrics {
  min-width: 0;
}

.works-filter-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  flex: 1 1 540px;
}

.works-filter-fields > .q-field {
  min-width: 0;
  width: 100%;
}

.works-display-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex: 1 0 auto;
}

.works-filters :deep(.q-btn.bg-white.text-primary) {
  color: var(--kikoeru-accent-text-light) !important;
}

@media (max-width: 700px) {
  .works-filters {
    margin: 12px 16px 20px;
  }

  .works-filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    flex-basis: 100%;
  }

  .works-display-controls {
    justify-content: space-between;
    flex-basis: 100%;
  }
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
.search-tag-close-btn {
  background: rgba(144, 144, 144, 0.4);
  color: white
}
</style>
