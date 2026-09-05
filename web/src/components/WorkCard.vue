<template>
  <q-card class="card hover-show" :class="{ 'card--thumbnail': thumbnailMode }">
    <router-link :to="`/work/${metadata.id}`" class="work-card-cover" :aria-label="metadata.title">
      <CoverSFW :workid="metadata.id" :nsfw="false" :release="thumbnailMode ? metadata.release : ''" :lyric_status="metadata.lyric_status" :tags="metadata.tags" />
    </router-link>

    <q-separator />

    <div v-if="!thumbnailMode" class="work-card-info">
      <div class="work-card-byline">
        <router-link :to="`/works?circleId=${metadata.circle.id}`" class="work-card-circle ellipsis">
          {{ metadata.circle.name }}
        </router-link>
        <time v-if="metadata.release">{{ metadata.release }}</time>
      </div>
      <!-- 标题 -->
      <h2 class="work-card-title">
        <router-link :to="`/work/${metadata.id}`" class="ellipsis-2-lines" :title="metadata.title">
          {{ metadata.title }}
        </router-link>
      </h2>

      <!-- 评价&评论 -->
      <div v-show="metadata.title" class="work-card-rating-row">
        <!-- 评价 -->
        <div class="work-card-rating">
          <q-rating
            v-model="rating"
            size="20px"
            :color="userMarked ? ($q.dark.isActive ? 'blue' : 'blue-8') : ($q.dark.isActive ? 'amber' : 'orange-10')"
            icon="star_border"
            icon-selected="star"
            icon-half="star_half"
          />

          <!-- 评价分布明细 -->
          <q-tooltip v-if=metadata.rate_count_detail class="text-subtitle1">
            <div>平均: {{ metadata.rate_average_2dp }}</div>
            <div v-for="(rate, index) in sortedRatings" :key=index class="row items-center">
              <div class="col">{{ rate.review_point }}星</div>

              <!-- 评价占比 -->
              <q-linear-progress
                :model-value="rate.ratio/100"
                color="amber"
                track-color="white"
                style="height: 15px; width: 100px"
                class="col-auto"
              />

              <div class="col q-mx-sm">({{ rate.count }})</div>
            </div>
          </q-tooltip>
        </div>

        <div class="work-card-score">
          <span class="text-weight-medium">{{ metadata.rate_average_2dp }}</span>
          <span class="work-card-muted"> ({{ metadata.rate_count }})</span>
        </div>

        <!-- 评论数量 -->
        <div class="work-card-reviews work-card-muted">
          <q-icon name="chat_bubble_outline" size="16px" />
          <span>{{ metadata.review_count }}</span>
          <q-tooltip>评论数</q-tooltip>
        </div>

        <!-- DLsite链接 -->
      </div>

      <!-- 价格&售出数 -->
      <div v-show="metadata.title" class="work-card-commerce">
        <span class="work-card-price">
          {{ metadata.price }}<small> 日元</small>
        </span>
        <span class="work-card-muted">售出 {{ metadata.dl_count }}</span>
        <span v-if="!metadata.nsfw" class="work-card-age">全年龄</span>
        <a v-if="!dlsiteCode.startsWith('CC')" class="work-card-store" :href="`https://www.dlsite.com/home/work/=/product_id/${dlsiteCode}.html`" rel="noreferrer noopener" target="_blank">DLsite <q-icon name="open_in_new" size="14px" /></a>
      </div>
    </div>

    <div class="work-card-footer">
      <!-- 声优 -->
      <div
        v-if="!thumbnailMode"
        class="work-card-vas"
      >
        <router-link
          v-for="(va, index) in metadata.vas"
          :to="`/works?vaId=${va.id}`"
          :key=index
          class="work-card-va"
        >
          <q-icon name="mic_none" size="16px" />
          <span>{{ va.name }}</span>
        </router-link>
      </div>
      <LibraryActions class="work-card-actions" :work-id="Number(metadata.id)" :archived="Boolean(metadata.archived_at)" @changed="$emit('library-changed')" />
    </div>
  </q-card>
</template>

<script>
import CoverSFW from 'components/CoverSFW.vue'
import LibraryActions from 'components/LibraryActions.vue'
import NotifyMixin from '../mixins/Notification.js'
import { idNumberToCode } from 'src/utils'

export default {
  name: 'WorkCard',

  mixins: [NotifyMixin],

  components: {
    CoverSFW,
    LibraryActions
  },

  props: {
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
  --card-muted: #616161;
  --card-line: rgba(0, 0, 0, 0.1);
  --card-chip: rgba(0, 0, 0, 0.045);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--card-line);
  box-shadow: none;
}

.body--dark .card {
  --card-muted: #b0b0b0;
  --card-line: rgba(255, 255, 255, 0.12);
  --card-chip: rgba(255, 255, 255, 0.065);
}

.work-card-cover {
  display: block;
}

.work-card-cover :deep(.q-img) {
  max-width: none !important;
}

.work-card-cover :deep(.bg-brown),
.work-card-cover :deep(.bg-blue-grey) {
  background: rgba(25, 25, 25, 0.8) !important;
}

.work-card-cover :deep(.q-chip) {
  font-size: 12px;
  box-shadow: none;
}

.work-card-info {
  padding: 14px 16px 12px;
}

.work-card-byline {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--card-muted);
  font-size: 12px;
}

.work-card-circle {
  min-width: 0;
  color: inherit;
  font-size: 13px;
}

.work-card-byline time {
  flex-shrink: 0;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.work-card-title {
  margin: 8px 0 12px;
  font-size: 18px;
  line-height: 1.55;
  font-weight: 600;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.work-card-title a {
  min-height: 3.1em;
  color: inherit;
}

.work-card-title a:hover,
.work-card-circle:hover,
.work-card-va:hover {
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
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 12px;
}

.work-card-score {
  white-space: nowrap;
  font-size: 14px;
}

.work-card-score .work-card-muted {
  font-size: 12px;
}

.work-card-muted {
  color: var(--card-muted);
}

.work-card-reviews {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
}

.work-card-commerce {
  align-items: baseline;
  margin-top: 10px;
  line-height: 20px;
}

.work-card-price {
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.work-card-price small {
  color: var(--card-muted);
  font-size: 12px;
  font-weight: 400;
}

.work-card-age {
  color: var(--card-muted);
  border: 1px solid var(--card-line);
  border-radius: 4px;
  padding: 1px 5px;
  line-height: 20px;
}

.work-card-store {
  color: var(--kikoeru-accent-text);
  margin-left: auto;
  white-space: nowrap;
}

.work-card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 8px 12px 8px 16px;
  border-top: 1px solid var(--card-line);
  margin-top: auto;
}

.work-card-vas {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.work-card-va {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-height: 28px;
  padding: 3px 8px;
  background: var(--card-chip);
  border-radius: 4px;
  color: inherit;
  font-size: 13px;
  line-height: 20px;
}

.work-card-va span {
  min-width: 0;
  overflow-wrap: anywhere;
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
