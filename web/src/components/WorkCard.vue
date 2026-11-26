<template>
  <q-card class="card hover-show" :class="{ 'card--thumbnail': thumbnailMode, 'card--full': fullDetails }">
    <router-link :to="`/work/${metadata.id}`" class="work-card-cover" :aria-label="$privateText(metadata.title)">
      <CoverSFW
        :workid="metadata.id"
        :nsfw="false"
        :release="thumbnailMode ? metadata.release : ''"
        :lyric_status="metadata.lyric_status"
        :tags="fullDetails ? [] : visibleTags"
      />
    </router-link>

    <div v-if="!thumbnailMode" class="work-card-info">
      <!-- 第 1 行：社团 & 发售日 -->
      <div class="work-card-byline">
        <router-link :to="`/works?circleId=${metadata.circle.id}`" class="work-card-circle ellipsis">
          {{ $privateText(metadata.circle.name) }}
        </router-link>
        <time v-if="metadata.release">{{ metadata.release }}</time>
      </div>

      <!-- 第 2 行：标题 -->
      <h2 class="work-card-title">
        <router-link :to="`/work/${metadata.id}`" :class="fullDetails ? 'work-card-title-full' : 'ellipsis-2-lines'">
          {{ $privateText(metadata.title) }}
          <AppTooltip v-if="!fullDetails">{{ $privateText(metadata.title) }}</AppTooltip>
        </router-link>
      </h2>

      <!-- 第 3 行：评价 & 评论 -->
      <div v-show="metadata.title" class="work-card-rating-row">
        <div class="work-card-rating">
          <q-rating
            v-model="rating"
            size="18px"
            class="work-card-stars"
            :class="userMarked ? 'work-card-stars--user' : 'work-card-stars--community'"
            icon="star_border"
            icon-selected="star"
            icon-half="star_half"
          />

          <!-- 评价分布明细 -->
          <AppTooltip v-if="metadata.rate_count_detail">
            <div class="kikoeru-rating-tooltip">
              <div class="kikoeru-rating-tooltip__title">{{ $t('workCard.average', { rate_average_2dp: metadata.rate_average_2dp }) }}</div>
              <div v-for="(rate, index) in sortedRatings" :key="index" class="kikoeru-rating-tooltip__row">
                <span>{{ $t('workCard.stars', { count: rate.review_point }) }}</span>
                <q-linear-progress
                  :model-value="rate.ratio/100"
                  color="amber"
                  track-color="grey-8"
                  class="kikoeru-rating-tooltip__bar"
                />
                <span class="kikoeru-rating-tooltip__count">({{ rate.count }})</span>
              </div>
            </div>
          </AppTooltip>
        </div>

        <div class="work-card-score">
          <span class="work-card-score-num">{{ metadata.rate_average_2dp }}</span>
          <span class="work-card-muted">({{ metadata.rate_count }})</span>
        </div>

        <div class="work-card-reviews work-card-muted">
          <q-icon name="chat_bubble_outline" size="14px" />
          <span>{{ metadata.review_count }}</span>
          <AppTooltip>{{ $t('workCard.reviews') }}</AppTooltip>
        </div>
      </div>

      <!-- 第 4 行：价格 / 销量 / 分级 + DLsite 胶囊 -->
      <div v-show="metadata.title" class="work-card-commerce">
        <span class="work-card-price">¥{{ metadata.price }}</span>
        <span class="work-card-muted">{{ $t('workCard.sales', { count: metadata.dl_count }) }}</span>
        <span v-if="metadata.nsfw === false" class="work-card-age">{{ $t('workCard.allAges') }}</span>
        <a
          v-if="!dlsiteCode.startsWith('CC')"
          class="work-card-store"
          :href="`https://www.dlsite.com/home/work/=/product_id/${dlsiteCode}.html`"
          rel="noreferrer noopener"
          target="_blank"
        >
          <span>DLsite</span>
          <q-icon name="open_in_new" size="12px" />
        </a>
      </div>
    </div>

    <!-- 完整作品卡片模式下，所有标签平铺在正文下方、底栏上方 -->
    <div v-if="!thumbnailMode && fullDetails && visibleTags.length" class="work-card-tags">
      <router-link v-for="tag in visibleTags" :key="tag.id" :to="`/works?tagId=${tag.id}`" class="work-card-tag">
        {{ $privateText(tag.name) }}
      </router-link>
    </div>

    <WorkSearchMatch v-if="metadata.searchMatch" :match="metadata.searchMatch" class="q-mx-md q-mb-sm" />

    <div class="work-card-footer">
      <!-- 声优（对齐详情页淡蓝胶囊样式） -->
      <div
        v-if="!thumbnailMode"
        class="work-card-vas"
      >
        <router-link
          v-for="(va, index) in metadata.vas"
          :to="`/works?vaId=${va.id}`"
          :key="index"
          class="work-card-va"
        >
          <q-icon name="mic_none" size="13px" />
          <span class="ellipsis">{{ $privateText(va.name) }}</span>
        </router-link>
      </div>
      <LibraryActions class="work-card-actions" :work-id="Number(metadata.id)" :archived="Boolean(metadata.archived_at)" @changed="$emit('library-changed')" />
    </div>
  </q-card>
</template>

<script>
import CoverSFW from 'components/CoverSFW.vue'
import LibraryActions from 'components/LibraryActions.vue'
import WorkSearchMatch from 'components/WorkSearchMatch.vue'
import NotifyMixin from '../mixins/Notification.js'
import { idNumberToCode } from 'src/utils'

export default {
  name: 'WorkCard',

  mixins: [NotifyMixin],

  components: {
    CoverSFW,
    LibraryActions,
    WorkSearchMatch
  },

  props: {
    fullDetails: {
      type: Boolean,
      default: false
    },
    metadata: {
      type: Object,
      required: true
    },
    thumbnailMode: {
      type: Boolean,
      default: false
    }
  },

  data () {
    return {
      rating: 0,
      userMarked: false,
      showTags: true
    }
  },

  computed: {
    visibleTags () {
      return (this.metadata.tags || []).filter(tag => tag && tag.id != null && tag.name)
    },
    displayedTags () {
      return this.fullDetails ? this.visibleTags : this.visibleTags.slice(0, 3)
    },
    hiddenTagCount () {
      return Math.max(0, this.visibleTags.length - this.displayedTags.length)
    },
    hiddenTagNames () {
      return this.visibleTags.slice(this.displayedTags.length).map(tag => this.$privateText(tag.name)).join(' · ')
    },
    sortedRatings: function() {
      function compare(a, b) {
        return (a.review_point > b.review_point) ? -1 : 1;
      }

      return this.metadata.rate_count_detail.slice().sort(compare);
    },
    dlsiteCode() {
      return idNumberToCode(this.metadata.id)
    }
  },

  // TODO: Refactor with Vuex?
  mounted() {
    if (this.metadata.userRating) {
      this.userMarked = true;
      this.rating = this.metadata.userRating;
    } else {
      this.userMarked = false;
      this.rating = this.metadata.rate_average_2dp || 0;
    }

    // 极个别作品没有标签
    if (this.metadata.tags && this.metadata.tags.length > 0 && this.metadata.tags[0].name === null) {
      this.showTags = false;
    }
  },

  watch: {
    rating (newRating, oldRating) {
      if (oldRating) {
        const submitPayload = {
          'user_name': this.$store.state.User.name, // 用户名不会被后端使用
          'work_id': this.metadata.id,
          'rating': newRating
        };
        this.userMarked = true;
        this.submitRating(submitPayload);
      }
    }
  },

  methods: {
    submitRating (payload) {
      this.$axios.put('/api/review', payload)
        .then((response) => {
          this.showSuccNotif(response.data.message)
        })
        .catch((error) => {
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },
  }
}
</script>


<style scoped>
.card {
  --card-muted: var(--kikoeru-muted);
  --card-line: var(--kikoeru-border);
  --card-chip: rgba(0, 0, 0, 0.045);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: var(--kikoeru-surface);
  color: var(--kikoeru-text);
  border-radius: var(--kikoeru-radius-md);
  border: 1px solid var(--card-line);
  box-shadow: none;
  transition: transform .18s ease, box-shadow .18s ease;
  will-change: transform;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--kikoeru-shadow-card-hover);
}

.body--dark .card {
  --card-chip: rgba(255, 255, 255, 0.065);
}

.work-card-cover {
  display: block;
}

.work-card-cover :deep(.q-img__image:not([src*="blurNsfw=1"])) {
  transition: transform .3s ease;
}

.card:hover .work-card-cover :deep(.q-img__image:not([src*="blurNsfw=1"])) {
  transform: scale(1.04);
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .work-card-cover :deep(.q-img__image) {
    transition: none;
  }
  .card:hover {
    transform: none;
  }
}

.work-card-cover :deep(.q-img) {
  max-width: none !important;
}

.work-card-cover :deep(.bg-brown),
.work-card-cover :deep(.bg-blue-grey) {
  background: rgba(25, 25, 25, 0.8) !important;
}

.work-card-cover :deep(.bg-brown) {
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.work-card-cover :deep(.q-chip) {
  font-size: 12px;
  box-shadow: none;
}

.work-card-stars--community {
  color: var(--kikoeru-star);
}

.work-card-stars--user {
  color: var(--kikoeru-accent-text);
}

.work-card-info {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  padding: 12px 14px 10px;
}

.card--full .work-card-title {
  margin-bottom: auto;
  padding-bottom: 12px;
}

.work-card-byline {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--card-muted);
  font-size: 12px;
  line-height: 1.3;
}

.work-card-circle {
  min-width: 0;
  color: inherit;
  font-size: 12.5px;
}

.work-card-byline time {
  flex-shrink: 0;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.work-card-title {
  margin: 7px 0 10px;
  font-size: 15.5px;
  line-height: 1.48;
  font-weight: 600;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.work-card-title a {
  min-height: 2.96em;
  color: inherit;
}

.work-card-title a:hover,
.work-card-circle:hover {
  color: var(--kikoeru-accent-text);
}

.card a:focus-visible {
  outline: 2px solid var(--kikoeru-accent-text);
  outline-offset: -2px;
}

.work-card-rating-row,
.work-card-commerce {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px 8px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.work-card-score {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  white-space: nowrap;
}

.work-card-score-num {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--kikoeru-text);
}

.work-card-score .work-card-muted {
  font-size: 12px;
}

.work-card-muted {
  color: var(--card-muted);
  white-space: nowrap;
}

.work-card-reviews {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.work-card-commerce {
  margin-top: 8px;
  line-height: 20px;
}

.work-card-price {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--kikoeru-text);
  white-space: nowrap;
}

.work-card-age {
  color: var(--kikoeru-text);
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--card-line);
  background: var(--card-chip);
  border-radius: 4px;
  padding: 0 5px;
  line-height: 18px;
  white-space: nowrap;
}

.work-card-store {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  padding: 1px 7px;
  border-radius: 5px;
  background: var(--kikoeru-active-bg);
  border: 1px solid color-mix(in srgb, var(--q-primary) 26%, transparent);
  color: var(--kikoeru-accent-text);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  transition: background-color .14s ease, border-color .14s ease;
}

.work-card-store:hover {
  background: color-mix(in srgb, var(--q-primary) 22%, transparent);
  border-color: color-mix(in srgb, var(--q-primary) 45%, transparent);
}

.work-card-title-full {
  display: block;
}

.work-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 10px 14px;
  border-top: 1px solid var(--card-line);
  background: color-mix(in srgb, var(--kikoeru-inset) 45%, transparent);
}

.work-card-tag {
  max-width: 100%;
  padding: 2px 7px;
  border: 1px solid var(--card-line);
  border-radius: 4px;
  background: var(--card-chip);
  color: var(--kikoeru-muted);
  font-size: 11px;
  line-height: 17px;
  overflow-wrap: anywhere;
  transition: color .14s ease, border-color .14s ease;
}

.work-card-tag:hover {
  color: var(--kikoeru-accent-text);
  border-color: color-mix(in srgb, var(--q-primary) 45%, transparent);
}

.work-card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 6px 10px 6px 14px;
  border-top: 1px solid var(--card-line);
  margin-top: auto;
}

.work-card-vas {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.work-card-va {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  height: 22px;
  padding: 0 7px;
  background: var(--kikoeru-active-bg);
  border: 1px solid color-mix(in srgb, var(--q-primary) 24%, transparent);
  border-radius: 4px;
  color: var(--kikoeru-accent-text);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  transition: background-color .14s ease, border-color .14s ease;
}

.work-card-va:hover {
  background: color-mix(in srgb, var(--q-primary) 24%, transparent);
  border-color: color-mix(in srgb, var(--q-primary) 46%, transparent);
}

.work-card-va span {
  min-width: 0;
}

.work-card-actions {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--card-muted);
}

.card--thumbnail .work-card-footer {
  min-height: 40px;
  padding: 4px 8px;
}

.hover-show {
  --hover-work-card: 0; /* 桌面平台上，鼠标的hover状态 */
  --active-work-card: 0; /* 桌面平台上，组建被选中状态 */
}

.hover-show:hover {
  --hover-work-card: 1;
}

.hover-show:active {
  --active-work-card: 1;
}

</style>
