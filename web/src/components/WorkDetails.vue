<template>
  <div class="work-details">
    <CoverSFW
      v-cover-transition="metadata.id"
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
            {{ $privateText(metadata.circle.name) }}
          </router-link>
          <span v-if="metadata.archived_at" class="work-archived"><q-icon name="archive" size="14px" />{{ $t('workDetails.archived') }}</span>
          <span v-if="metadata.files_missing" class="work-archived" :class="$q.dark.isActive ? 'text-red-4' : 'text-negative'"><q-icon name="folder_off" size="14px" />{{ $t('common.filesMissing') }}</span>
        </div>

        <!-- 标题 -->
        <h1 class="work-title">
          <router-link :to="`/work/${metadata.id}`">
            {{ $privateText(metadata.title) }}
          </router-link>
        </h1>

      </div>

      <div class="work-facts">
        <div class="work-community-rating">
          <div class="work-rating-header">
            <span class="work-field-label">{{ $t('workDetails.workRating') }}</span>
            <span v-if="rating > 0" class="work-my-rating-tag">{{ $t('workDetails.myRating') }} {{ rating }}</span>
          </div>
          <div class="work-rating-value">
            <q-rating
              :model-value="displayRating"
              @update:model-value="onRatingChange"
              :no-reset="rating === 0"
              :aria-label="$t('workDetails.myRating')"
              name="rating"
              size="22px"
              class="work-rating-stars"
              :class="rating > 0 ? 'work-rating-stars--user' : 'work-rating-stars--community'"
              icon="star_border"
              icon-selected="star"
              icon-half="star_half"
            />
            <span class="work-score" tabindex="0">
              {{ metadata.rate_average_2dp }}
              <!-- 评价分布明细 -->
              <AppTooltip v-if="metadata.rate_count_detail">
                <div class="kikoeru-rating-tooltip">
                  <div class="kikoeru-rating-tooltip__title">{{ $t('workDetails.average', { rate_average_2dp: metadata.rate_average_2dp }) }}</div>
                  <div v-for="(rate, index) in sortedRatings" :key="index" class="kikoeru-rating-tooltip__row">
                    <span>{{ $t('workDetails.stars', { count: rate.review_point }) }}</span>
                    <q-linear-progress
                      :model-value="rate.ratio/100"
                      color="amber"
                      track-color="grey-8"
                      class="kikoeru-rating-tooltip__bar"
                    />
                    <span class="kikoeru-rating-tooltip__count">({{rate.count}})</span>
                  </div>
                </div>
              </AppTooltip>
            </span>
          </div>

          <span class="work-muted work-fact-note">{{ $t('workDetails.reviewCounts', { rate_count: metadata.rate_count, review_count: metadata.review_count }) }}</span>
        </div>
        <div class="work-commerce">
          <span class="work-field-label">{{ $t('workDetails.price') }}</span>
          <span class="work-price">{{metadata.price}} <span class="work-muted">{{ $t('workDetails.yen') }}</span></span>
          <div class="work-fact-note work-store-row">
            <span class="work-muted">{{ $t('workDetails.sales', { count: metadata.dl_count }) }}</span>
            <a v-if="!dlsiteCode.startsWith('CC')" class="work-store" :href="`https://www.dlsite.com/home/work/=/product_id/${dlsiteCode}.html`" rel="noreferrer noopener" target="_blank">DLsite <q-icon name="open_in_new" size="13px" /></a>
          </div>
        </div>
      </div>

      <!-- 声优 -->
      <div v-if="metadata.vas && metadata.vas.length" class="work-detail-row">
        <span class="work-field-label">{{ $t('common.voiceActors') }}</span>
        <div class="work-facets work-voices">
          <router-link
            v-for="(va, index) in metadata.vas"
            :to="`/works?vaId=${va.id}`"
            :key=index
          >
            <q-chip square size="md" class="work-voice" icon="mic">
              {{ $privateText(va.name) }}
            </q-chip>
          </router-link>
        </div>
      </div>

      <!-- 标签 -->
      <div class="work-detail-row" v-if="showTags && metadata.tags && metadata.tags.length">
        <span class="work-field-label">{{ $t('common.tags') }}</span>
        <div class="work-facets work-tags">
          <router-link
            v-for="(tag, index) in metadata.tags"
            :to="`/works?tagId=${tag.id}`"
            :key=index
          >
            <q-chip square size="md">
              {{ $privateText(tag.name) }}
            </q-chip>
          </router-link>
        </div>
      </div>

    </div>

      <div class="work-actions">
        <div class="work-progress">
          <span id="work-progress-label" class="work-field-label">{{ $t('workDetails.listeningStatus') }}</span>
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

        <div class="work-tools-group">
          <span class="work-field-label">{{ $t('workDetails.actions') }}</span>
          <div class="work-tools">
          <q-btn
            v-if="metadata.state && !metadata.files_missing && playWorkId !== metadata.id"
            flat
            round
            color="primary"
            icon="history"
            :aria-label="$t('workDetails.resume')"
            @click="resumeThisHistroy"
          >
            <AppTooltip>
              <span>{{ $t('workDetails.resume') }}</span>
              <span v-if="lastPlayedInfo && lastPlayedInfo.title">：{{ $privateText(lastPlayedInfo.title) }}</span>
              <span v-if="lastPlayedInfo && lastPlayedInfo.seconds !== null"> ({{ formatSeconds(lastPlayedInfo.seconds) }})</span>
            </AppTooltip>
          </q-btn>
          <q-btn flat round icon="rate_review" :aria-label="$t('workDetails.writeReview')" @click="showReviewDialog = true">
            <AppTooltip>{{ $t('workDetails.writeReview') }}</AppTooltip>
          </q-btn>

          <LibraryActions
            inline
            flat
            compact
            :work-id="Number(metadata.id)"
            :archived="Boolean(metadata.archived_at)"
            @changed="$emit('reset')"
          />

          <slot name="folder-action" />
          <q-btn flat round icon="more_horiz" :aria-label="$t('workDetails.moreActions')">
            <AppTooltip>{{ $t('workDetails.moreActions') }}</AppTooltip>
            <q-menu anchor="bottom right" self="top right">
              <q-list dense class="work-manage-menu">
                <q-item v-if="isAdministrator" clickable v-close-popup @click="showEditMetaDialog = true">
                  <q-item-section avatar><q-icon name="edit" /></q-item-section>
                  <q-item-section>{{ $t('workDetails.editMetadata') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="scanWorkFile">
                  <q-item-section avatar><q-icon name="sync" /></q-item-section>
                  <q-item-section>{{ $t('workDetails.scanFiles') }}</q-item-section>
                </q-item>
                <q-separator v-if="metadata.state" />
                <q-item v-if="metadata.state" clickable v-close-popup class="kikoeru-danger-text" @click="clearThisHistroy">
                  <q-item-section avatar><q-icon name="delete_sweep" /></q-item-section>
                  <q-item-section>{{ $t('workDetails.deleteHistory') }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
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
import { appDialog } from '../utils/appDialog'
import { t } from '../i18n'
import CoverSFW from 'components/CoverSFW.vue'
import WriteReview from './WriteReview.vue'
import EditMeta from './EditMeta.vue'
import LibraryActions from './LibraryActions.vue'
import NotifyMixin from '../mixins/Notification.js'
import { mapState } from 'vuex'
import { formatSeconds, idNumberToCode } from 'src/utils'
import { coverTransition } from '../coverTransition'

export default {
  name: 'WorkDetails',
  directives: { coverTransition },

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
      showReviewDialog: false,
      showEditMetaDialog: false,
      showTags: true
    }
  },

  computed: {
    progressOptions () {
      return [
        { label: t('workDetails.marked'), value: 'marked' },
        { label: t('workDetails.listening'), value: 'listening' },
        { label: t('workDetails.listened'), value: 'listened' },
        { label: t('workDetails.replay'), value: 'replay' },
        { label: t('workDetails.postponed'), value: 'postponed' }
      ]
    },
    sortedRatings: function() {
      function compare(a, b) {
        return (a.review_point > b.review_point) ? -1 : 1;
      }
      return this.metadata.rate_count_detail.slice().sort(compare);
    },
    dlsiteCode() {
      return idNumberToCode(this.metadata.id)
    },

    displayRating () {
      return this.rating > 0 ? this.rating : (Number(this.metadata.rate_average_2dp) || 0)
    },

    lastPlayedInfo () {
      const state = this.metadata.state
      const index = Number(state?.index)
      const track = Array.isArray(state?.queue) && Number.isInteger(index) ? state.queue[index] : null
      if (!track) return null
      return {
        title: track.title || '',
        seconds: Number.isFinite(Number(state?.seconds)) ? Number(state.seconds) : null
      }
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
    metadata: {
      immediate: true,
      handler (newMetaData) {
        this.rating = newMetaData.userRating || 0;
        this.progress = newMetaData.progress;

        // 极个别作品没有标签
        if (newMetaData.tags && newMetaData.tags.length > 0 && newMetaData.tags[0].name === null) {
          this.showTags = false;
        }
      },
    },
  },

  methods: {
    setProgress (newProgress) {
      const previousProgress = this.progress;
      this.progress = newProgress;
      const submitPayload = {
        'user_name': this.$store.state.User.name, // 用户名不会被后端使用
        'work_id': this.metadata.id,
        'progress': newProgress
      };
      this.submitProgress(submitPayload, previousProgress);
    },

    submitProgress (payload, previousProgress = this.progress) {
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
          this.progress = previousProgress;
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    onRatingChange (newRating) {
      const previousRating = this.rating;
      this.rating = newRating;
      this.setRating(newRating, previousRating);
    },

    setRating (newRating, previousRating = this.rating) {
      const submitPayload = {
        'user_name': this.$store.state.User.name, // 用户名不会被后端使用
        'work_id': this.metadata.id,
        'rating': newRating
      };
      this.submitRating(submitPayload, previousRating);
    },

    submitRating (payload, previousRating = this.rating) {
      this.$axios.put('/api/review', payload)
        .then((response) => {
          this.showSuccNotif(response.data.message);
          this.$emit('reset');
        })
        .catch((error) => {
          this.rating = previousRating;
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

    formatSeconds,

    clearThisHistroy() {
      const workId = this.metadata.id
      appDialog(this.$q, {
        title: t('workDetails.notice'),
        message: t('workDetails.deleteHistoryPrompt'),
        cancel: t('common.cancel'),
        ok: t('common.ok')
      }).onOk(async () => {
        this.$axios.delete('/api/histroy', { data: { work_id: workId } })
          .then((_) => {
            this.$emit('history-cleared', workId)
            this.$q.notify(t('workDetails.historyDeleted'))
          })
          .catch((err) => {
            this.$q.notify(t('workDetails.deleteHistoryFailed'), err.message)
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
  --work-muted: var(--kikoeru-muted);
  --work-divider: var(--kikoeru-border);
  --work-chip: var(--kikoeru-inset);
  display: grid;
  grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
  align-items: start;
  gap: 18px 24px;
  padding: 20px;
  background: var(--kikoeru-surface);
  border: 1px solid var(--work-divider);
  border-radius: var(--kikoeru-radius-md);
}

.work-rating-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.work-my-rating-tag {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(var(--kikoeru-accent-rgb), 0.14);
  color: var(--kikoeru-accent-text);
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.work-rating-stars :deep(.q-rating__icon) {
  color: var(--work-muted);
  opacity: 0.72;
  text-shadow: none;
}

.work-rating-stars--community :deep(.q-rating__icon--active) {
  color: var(--kikoeru-star);
  opacity: 1;
}

.work-rating-stars--user :deep(.q-rating__icon--active),
.work-rating-stars :deep(.q-rating__icon--hovered) {
  color: var(--kikoeru-accent-text);
  opacity: 1;
}

.work-cover {
  width: 100%;
}

.work-info {
  min-width: 0;
}

.work-title {
  margin: 6px 0 0;
  font-size: 19px;
  font-weight: 500;
  line-height: 1.42;
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
  align-items: center;
  gap: 14px 24px;
  margin: 16px 0;
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
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  font-variant-numeric: tabular-nums;
  cursor: help;
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
  justify-content: space-between;
  gap: 12px 20px;
  border-top: 1px solid var(--work-divider);
  padding: 16px 0 0;
}

.work-progress {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
  flex: 0 0 auto;
}

.work-progress > .work-field-label {
  flex-shrink: 0;
}

.work-tools-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.work-tools-group > .work-field-label {
  display: none;
}

.work-progress-toggle {
  flex: 0 0 auto;
  padding: 3px;
  background: var(--work-chip);
  border-radius: 6px;
  box-shadow: none;
}

.work-progress-toggle :deep(.q-btn) {
  flex: 0 0 auto;
  min-width: 52px;
  min-height: 34px;
  padding: 4px 10px;
  border-radius: 4px !important;
  font-size: 13.5px;
}

.work-progress-toggle :deep(.q-btn[aria-pressed='true']) {
  box-shadow: inset 0 0 0 1px var(--kikoeru-accent-text);
  font-weight: 600;
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
  min-width: 200px;
}

@media (min-width: 700px) and (max-width: 959px) {
  .work-details {
    grid-template-columns: minmax(0, 280px) minmax(0, 1fr);
    gap: 18px 20px;
  }
}

@media (max-width: 699px) {
  .work-details {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding: 14px;
  }

  .work-cover {
    max-width: 360px;
    justify-self: center;
  }

  .work-title {
    font-size: 18px;
    margin-top: 6px;
  }

  .work-facts {
    margin: 14px 0;
    gap: 14px 16px;
  }

  .work-commerce {
    padding-left: 16px;
  }

  .work-progress {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .work-progress-toggle {
    flex: 1;
  }

  .work-progress-toggle :deep(.q-btn) {
    flex: 1 1 0;
    min-width: 0;
  }

  .work-tools-group {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-left: 0;
  }

  .work-tools-group > .work-field-label {
    display: block;
  }

  .work-actions {
    row-gap: 14px;
    padding: 14px 0 0;
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
