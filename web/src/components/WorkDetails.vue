<template>
  <div class="work-details">
    <CoverSFW
      class="work-cover"
      :workid="metadata.id"
      :nsfw="false"
      :release="metadata.release"
      :lyric_status="metadata.lyric_status"
      style="border-radius: 8px; overflow: hidden;"
    />

    <div class="work-info">
      <div class="work-heading">
        <div class="work-circle">
          <q-icon name="album" size="16px" />
          <router-link :to="`/works?circleId=${metadata.circle.id}`">
            {{metadata.circle.name}}
          </router-link>
          <span v-if="metadata.archived_at" class="work-archived"><q-icon name="archive" size="14px" /> 已归档</span>
        </div>

        <!-- 标题 -->
        <h1 class="work-title">
          <router-link :to="`/work/${metadata.id}`">
            {{metadata.title}}
          </router-link>
        </h1>

      </div>

      <div class="work-facts">
        <div class="work-community-rating">
          <span class="work-field-label">作品评分</span>
          <div class="work-rating-value">
            <span class="work-score">{{metadata.rate_average_2dp}}</span>
            <q-rating
              :model-value="Number(metadata.rate_average_2dp) || 0"
              aria-label="作品评分"
              readonly
              size="18px"
              :color="$q.dark.isActive ? 'amber' : 'orange-10'"
              icon="star_border"
              icon-selected="star"
              icon-half="star_half"
            />

            <!-- 评价分布明细 -->
            <q-tooltip v-if=metadata.rate_count_detail class="text-subtitle1">
              <div>平均: {{metadata.rate_average_2dp}}</div>
              <div v-for="(rate, index) in sortedRatings" :key=index class="row items-center">
                <div class="col"> {{rate.review_point}}星 </div>

                <!-- 评价占比 -->
                <q-linear-progress
                  :model-value="rate.ratio/100"
                  color="amber"
                  track-color="white"
                  style="height: 15px; width: 100px"
                  class="col-auto"
                />

                <div class="col q-mx-sm"> ({{rate.count}}) </div>
              </div>
            </q-tooltip>
          </div>

          <span class="work-muted work-fact-note">{{metadata.rate_count}} 个评价 · {{metadata.review_count}} 条评论</span>
        </div>
        <div class="work-commerce">
          <span class="work-field-label">售价</span>
          <span class="work-price">{{metadata.price}} <span class="work-muted">日元</span></span>
          <div class="work-fact-note work-store-row">
            <span class="work-muted">售出 {{metadata.dl_count}}</span>
            <a v-if="!dlsiteCode.startsWith('CC')" class="work-store" :href="`https://www.dlsite.com/home/work/=/product_id/${dlsiteCode}.html`" rel="noreferrer noopener" target="_blank">DLsite <q-icon name="open_in_new" size="13px" /></a>
          </div>
        </div>
      </div>

      <!-- 声优 -->
      <div v-if="metadata.vas && metadata.vas.length" class="work-detail-row">
        <span class="work-field-label">声优</span>
        <div class="work-facets work-voices">
          <router-link
            v-for="(va, index) in metadata.vas"
            :to="`/works?vaId=${va.id}`"
            :key=index
          >
            <q-chip square size="md" class="work-voice" icon="mic">
              {{va.name}}
            </q-chip>
          </router-link>
        </div>
      </div>

      <!-- 标签 -->
      <div class="work-detail-row" v-if="showTags && metadata.tags && metadata.tags.length">
        <span class="work-field-label">标签</span>
        <div class="work-facets work-tags">
          <router-link
            v-for="(tag, index) in metadata.tags"
            :to="`/works?tagId=${tag.id}`"
            :key=index
          >
            <q-chip square size="md">
              {{tag.name}}
            </q-chip>
          </router-link>
        </div>
      </div>

    </div>

      <div class="work-actions">
        <div class="work-progress">
          <span id="work-progress-label" class="work-field-label">收听状态</span>
          <q-btn-toggle
            :model-value="progress"
            @update:model-value="setProgress"
            :options="progressOptions"
            class="work-progress-toggle"
            aria-labelledby="work-progress-label"
            unelevated
            no-caps
            toggle-color="primary"
          />
        </div>

        <div class="work-personal-tools">
          <div class="work-personal-rating">
          <span id="work-rating-label" class="work-field-label">我的评分</span>
          <q-rating
            v-model="rating"
            @update:model-value="setRating"
            aria-labelledby="work-rating-label"
            name="rating"
            size="22px"
            icon="star_border"
            icon-selected="star"
            icon-half="star_half"
          />
        </div>

          <div class="work-tools-group">
            <span class="work-field-label">作品操作</span>
            <div class="work-tools">
          <q-btn
            v-if="metadata.state && playWorkId !== metadata.id"
            flat
            round
            icon="history"
            aria-label="恢复播放进度"
            @click="resumeThisHistroy"
          ><q-tooltip>恢复播放进度</q-tooltip></q-btn>
          <q-btn flat round icon="rate_review" aria-label="写评论" @click="showReviewDialog = true">
            <q-tooltip>写评论</q-tooltip>
          </q-btn>

          <LibraryActions
            inline
            flat
            compact
            :work-id="Number(metadata.id)"
            :archived="Boolean(metadata.archived_at)"
            @changed="$emit('reset')"
          />

          <q-btn flat round icon="more_horiz" aria-label="更多作品操作">
            <q-tooltip>更多作品操作</q-tooltip>
            <q-menu anchor="bottom right" self="top right">
              <q-list class="work-manage-menu">
                <q-item v-if="isAdministrator" clickable v-close-popup @click="showEditMetaDialog = true">
                  <q-item-section avatar><q-icon name="edit" /></q-item-section>
                  <q-item-section>修改作品信息</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="scanWorkFile">
                  <q-item-section avatar><q-icon name="sync" /></q-item-section>
                  <q-item-section>扫描本地文件</q-item-section>
                </q-item>
                <q-separator v-if="metadata.state" class="q-my-xs" />
                <q-item v-if="metadata.state" clickable v-close-popup class="work-danger" @click="clearThisHistroy">
                  <q-item-section avatar><q-icon name="delete_sweep" /></q-item-section>
                  <q-item-section>删除播放记录</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
            </div>
          </div>
        </div>
      </div>

      <WriteReview v-if="showReviewDialog" @closed="processReview" :workid="metadata.id" :metadata="metadata"></WriteReview>
      <q-dialog v-model="showEditMetaDialog">
        <EditMeta
          v-if="showEditMetaDialog"
          :workid="metadata.id"
          :metadata="metadata"
          @saved="processEditMeta"
        />
      </q-dialog>
  </div>
</template>

<script>
import CoverSFW from 'components/CoverSFW.vue'
import WriteReview from './WriteReview.vue'
import EditMeta from './EditMeta.vue'
import LibraryActions from './LibraryActions.vue'
import NotifyMixin from '../mixins/Notification.js'
import { mapState } from 'vuex'
import { idNumberToCode } from 'src/utils'

export default {
  name: 'WorkDetails',

  mixins: [NotifyMixin],

  components: {
    CoverSFW,
    WriteReview,
    EditMeta,
    LibraryActions
  },

  props: {
    metadata: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      rating: 0,
      progress: '',
      progressOptions: [
        { label: '想听', value: 'marked' },
        { label: '在听', value: 'listening' },
        { label: '听过', value: 'listened' },
        { label: '重听', value: 'replay' },
        { label: '搁置', value: 'postponed' }
      ],
      showReviewDialog: false,
      showEditMetaDialog: false,
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
    },

    isAdministrator () {
      return this.$store.state.User.canManage === true
    },

    ...mapState('AudioPlayer', [
      'playing',
      'playWorkId'
    ]),
  },

  watch: {
    // 需要用watch因为父component pages/work.vue是先用空值初始化的
    metadata (newMetaData) {
      this.rating = newMetaData.userRating || 0;
      this.progress = newMetaData.progress;

      // 极个别作品没有标签
      if (newMetaData.tags && newMetaData.tags.length > 0 && newMetaData.tags[0].name === null) {
        this.showTags = false;
      }
    },
  },

  methods: {
    setProgress (newProgress) {
      this.progress = newProgress;
      const submitPayload = {
        'user_name': this.$store.state.User.name, // 用户名不会被后端使用
        'work_id': this.metadata.id,
        'progress': newProgress
      };
      this.submitProgress(submitPayload);
    },

    submitProgress (payload) {
      const params = {
        starOnly: false,
        progressOnly: true
      }
      this.$axios.put('/api/review', payload, {params})
        .then((response) => {
          this.showSuccNotif(response.data.message);
          this.$emit('reset');
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

    setRating (newRating) {
      const submitPayload = {
        'user_name': this.$store.state.User.name, // 用户名不会被后端使用
        'work_id': this.metadata.id,
        'rating': newRating
      };
      this.submitRating(submitPayload);
    },

    submitRating (payload) {
      this.$axios.put('/api/review', payload)
        .then((response) => {
          this.showSuccNotif(response.data.message);
          this.$emit('reset');
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

    processReview () {
      this.showReviewDialog = false;
    },

    processEditMeta () {
      this.showEditMetaDialog = false
      this.$emit('reset')
    },

    resumeThisHistroy() {
      this.$emit("resumeHistroy")
    },

    clearThisHistroy() {
      this.$q.dialog({
        title: '注意',
        message: '确定要删除这个作品的播放历史吗？',
        cancel: "取消",
        ok: "确定"
      }).onOk(async () => {
        this.$axios.delete('/api/histroy', { data: { work_id: this.metadata.id } })
          .then((_) => {
            this.$q.notify("删除历史成功")
          })
          .catch((err) => {
            this.$q.notify("删除历史失败：", err.message)
            console.error(err)
          })
      })
    },

    async scanWorkFile() {
      try {
        const response = await this.$axios.post(`/api/work/scan/${this.metadata.id}`);
        if (response.data.memo) {
          this.$router.go(0);
        }
      } catch(err) {
        console.error(err);
        this.showErrNotif(err.message || err);
      }
    }
  }
}
</script>

<style scoped>
.work-details {
  --work-muted: #666;
  --work-divider: rgba(0, 0, 0, 0.12);
  --work-chip: #ededed;
  display: grid;
  grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
  align-items: start;
  gap: 20px 28px;
  padding: 16px 16px 0;
}

.body--dark .work-details {
  --work-muted: #aaa;
  --work-divider: rgba(255, 255, 255, 0.12);
  --work-chip: #252525;
}

.work-cover {
  width: 100%;
}

.work-info {
  min-width: 0;
}

.work-title {
  margin: 10px 0 0;
  font-size: 24px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.work-title a {
  color: inherit;
}

.work-circle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--work-muted);
  font-size: 14px;
}

.work-circle a {
  color: inherit;
  overflow-wrap: anywhere;
}

.work-archived {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  color: var(--kikoeru-accent-text);
}

.work-field-label,
.work-muted {
  color: var(--work-muted);
}

.work-field-label {
  font-size: 13px;
  line-height: 20px;
}

.work-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin: 18px 0;
}

.work-community-rating,
.work-commerce {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.work-community-rating {
  padding-right: 0;
}

.work-commerce {
  border-left: 1px solid var(--work-divider);
  padding-left: 24px;
}

.work-rating-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 30px;
}

.work-score {
  font-size: 22px;
  font-weight: 500;
  line-height: 30px;
}

.work-price {
  font-size: 18px;
  font-weight: 500;
  line-height: 30px;
}

.work-price .work-muted {
  font-size: 13px;
  font-weight: 400;
}

.work-fact-note {
  font-size: 13px;
  line-height: 20px;
}

.work-store-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}

.work-store {
  color: var(--kikoeru-accent-text);
}

.work-detail-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  margin-top: 10px;
}

.work-detail-row > .work-field-label {
  padding-top: 5px;
}

.work-facets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.work-facets a {
  max-width: 100%;
}

.work-facets .q-chip {
  min-height: 30px;
  height: auto;
  max-width: 100%;
  margin: 0;
  padding: 4px 10px;
  border-radius: 4px;
  background: var(--work-chip);
  font-size: 14px;
}

.work-facets :deep(.q-chip__content) {
  white-space: normal;
  overflow-wrap: anywhere;
}

.work-facets .work-voice {
  color: var(--kikoeru-accent-text);
  background: rgba(var(--kikoeru-accent-rgb), 0.12);
}

.work-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 28px;
  border-top: 1px solid var(--work-divider);
  border-bottom: 1px solid var(--work-divider);
  padding: 14px 0;
}

.work-progress,
.work-personal-rating {
  display: flex;
  align-items: center;
  gap: 12px;
}

.work-progress {
  min-width: 0;
  flex: 0 1 350px;
}

.work-progress > .work-field-label,
.work-personal-rating > .work-field-label {
  flex-shrink: 0;
}

.work-personal-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
  min-width: 0;
  flex: 1 1 350px;
}

.work-tools-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.work-tools-group > .work-field-label {
  display: none;
}

.work-progress-toggle {
  flex: 1;
  padding: 3px;
  background: var(--work-chip);
  border-radius: 6px;
  box-shadow: none;
}

.work-progress-toggle :deep(.q-btn) {
  flex: 1 1 0;
  min-width: 0;
  min-height: 36px;
  padding: 4px 10px;
  border-radius: 4px !important;
  font-size: 14px;
}

.work-progress-toggle :deep(.q-btn[aria-pressed='true']) {
  box-shadow: inset 0 0 0 1px var(--kikoeru-accent-text);
  font-weight: 600;
}

.work-personal-rating > .q-rating {
  height: 40px;
  color: var(--kikoeru-accent-text);
}

.work-personal-rating :deep(.q-rating__icon) {
  color: var(--work-muted);
  opacity: 1;
  text-shadow: none;
}

.work-personal-rating :deep(.q-rating__icon--active),
.work-personal-rating :deep(.q-rating__icon--hovered) {
  color: var(--kikoeru-accent-text);
}

.work-tools {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--work-muted);
}

.work-tools :deep(.library-actions) {
  gap: 4px;
}

.work-tools :deep(.q-btn) {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
}

.work-tools :deep(.q-icon) {
  font-size: 21px;
}

.work-tools :deep(.q-btn:hover),
.work-tools :deep(.q-btn:focus-visible) {
  color: var(--kikoeru-accent-text);
}

.work-manage-menu {
  min-width: 210px;
  padding: 6px 0;
}

.work-manage-menu .q-item__section--avatar {
  min-width: 36px;
}

.work-danger {
  color: #c62828;
}

.body--dark .work-danger {
  color: #ff7676;
}

@media (min-width: 700px) and (max-width: 899px) {
  .work-details {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    gap: 24px;
  }

  .work-progress {
    flex-basis: 100%;
  }

  .work-personal-tools {
    justify-content: space-between;
  }
}

@media (max-width: 699px) {
  .work-details {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
    padding: 8px 8px 0;
  }

  .work-cover {
    justify-self: center;
  }

  .work-title {
    font-size: 20px;
    margin-top: 8px;
  }

  .work-facts {
    margin: 20px 0;
    gap: 16px;
  }

  .work-commerce {
    padding-left: 16px;
  }

  .work-progress {
    flex-basis: 100%;
  }

  .work-progress,
  .work-personal-rating {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .work-personal-tools {
    align-items: end;
  }

  .work-tools-group {
    flex-direction: column;
    align-items: start;
    gap: 8px;
  }

  .work-tools-group > .work-field-label {
    display: block;
  }

  .work-actions {
    row-gap: 16px;
    padding: 16px 0;
  }

  .work-tools,
  .work-tools :deep(.library-actions) {
    gap: 0;
  }
}

@media (max-width: 359px) {
  .work-tools :deep(.q-btn) {
    width: 36px;
    min-width: 36px;
  }
}
</style>
