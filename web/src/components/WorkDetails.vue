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
            {{metadata.circle.name}}
          </router-link>
          <span v-if="metadata.archived_at" class="work-archived"><q-icon name="archive" size="14px" />{{ $t('workDetails.archived') }}</span>
          <span v-if="metadata.files_missing" class="work-archived" :class="$q.dark.isActive ? 'text-red-4' : 'text-negative'"><q-icon name="folder_off" size="14px" />{{ $t('common.filesMissing') }}</span>
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
          <span class="work-field-label">{{ $t('workDetails.workRating') }}</span>
          <div class="work-rating-value">
            <span class="work-score">{{metadata.rate_average_2dp}}</span>
            <q-rating
              :model-value="Number(metadata.rate_average_2dp) || 0"
              :aria-label="$t('workDetails.workRating')"
              readonly
              size="18px"
              :color="$q.dark.isActive ? 'amber' : 'orange-10'"
              icon="star_border"
              icon-selected="star"
              icon-half="star_half"
            />

            <!-- 评价分布明细 -->
            <q-tooltip v-if=metadata.rate_count_detail class="text-subtitle1">
              <div>{{ $t('workDetails.average', { rate_average_2dp: metadata.rate_average_2dp }) }}</div>
              <div v-for="(rate, index) in sortedRatings" :key=index class="row items-center">
                <div class="col"> {{ $t('workDetails.stars', { count: rate.review_point }) }}</div>

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
              {{va.name}}
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
              {{tag.name}}
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

        <div class="work-personal-tools">
          <div class="work-personal-rating">
          <span id="work-rating-label" class="work-field-label">{{ $t('workDetails.myRating') }}</span>
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
            <span class="work-field-label">{{ $t('workDetails.actions') }}</span>
            <div class="work-tools">
          <q-btn
            v-if="metadata.state && !metadata.files_missing && playWorkId !== metadata.id"
            flat
            round
            icon="history"
            :aria-label="$t('workDetails.resume')"
            @click="resumeThisHistroy"
          ><q-tooltip>{{ $t('workDetails.resume') }}</q-tooltip></q-btn>
          <q-btn flat round icon="rate_review" :aria-label="$t('workDetails.writeReview')" @click="showReviewDialog = true">
            <q-tooltip>{{ $t('workDetails.writeReview') }}</q-tooltip>
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
            <q-tooltip>{{ $t('workDetails.moreActions') }}</q-tooltip>
            <q-menu anchor="bottom right" self="top right">
              <q-list class="work-manage-menu">
                <q-item v-if="isAdministrator" clickable v-close-popup @click="showEditMetaDialog = true">
                  <q-item-section avatar><q-icon name="edit" /></q-item-section>
                  <q-item-section>{{ $t('workDetails.editMetadata') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="scanWorkFile">
                  <q-item-section avatar><q-icon name="sync" /></q-item-section>
                  <q-item-section>{{ $t('workDetails.scanFiles') }}</q-item-section>
                </q-item>
                <q-separator v-if="metadata.state" class="q-my-xs" />
                <q-item v-if="metadata.state" clickable v-close-popup class="work-danger" @click="clearThisHistroy">
                  <q-item-section avatar><q-icon name="delete_sweep" /></q-item-section>
                  <q-item-section>{{ $t('workDetails.deleteHistory') }}</q-item-section>
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
import { appDialog } from '../utils/appDialog'
import { t } from '../i18n'
import CoverSFW from 'components/CoverSFW.vue'
import WriteReview from './WriteReview.vue'
import EditMeta from './EditMeta.vue'
import LibraryActions from './LibraryActions.vue'
import NotifyMixin from '../mixins/Notification.js'
import { mapState } from 'vuex'
import { idNumberToCode } from 'src/utils'
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
      appDialog(this.$q, {
        title: t('workDetails.notice'),
        message: t('workDetails.deleteHistoryPrompt'),
        cancel: t('common.cancel'),
        ok: t('common.ok')
      }).onOk(async () => {
        this.$axios.delete('/api/histroy', { data: { work_id: this.metadata.id } })
          .then((_) => {
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
  max-width: 100%;
  flex: 0 0 auto;
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
