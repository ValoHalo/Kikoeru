<template>
  <section class="work-details">
    <div
      v-if="showBackdrop"
      class="work-details-backdrop"
      :style="{ backgroundImage: `url(${coverUrl})` }"
      aria-hidden="true"
    />

    <div class="work-details-grid">
      <!-- 封面与唯一主播放控制列 -->
      <div class="work-media-col">
        <div class="work-cover-frame">
          <CoverSFW
            v-cover-transition="metadata.id"
            class="work-cover"
            :workid="metadata.id"
            :nsfw="false"
            release=""
            :lyric_status="metadata.lyric_status || ''"
            :show-badges="false"
          />
        </div>

        <div v-if="loading || (tracksLoading && !metadata.files_missing && !isCurrentPlayingWork && !hasResumeHistory)" class="work-playback-panel">
          <q-skeleton height="42px" class="work-skeleton-pill" />
        </div>

        <div v-else-if="metadata.files_missing" class="work-missing-banner" role="status">
          <q-icon name="folder_off" size="18px" />
          <span>{{ $t('workTree.filesMissingNotice') }}</span>
        </div>

        <div v-else-if="isCurrentPlayingWork || hasResumeHistory || canPlay" class="work-playback-panel">
          <q-btn
            v-if="isCurrentPlayingWork"
            unelevated
            no-caps
            color="primary"
            class="work-play-btn"
            :icon="playing ? 'pause' : 'play_arrow'"
            :label="$t(playing ? 'workDetails.pause' : 'workDetails.resume')"
            @click="$emit('play')"
          />
          <q-btn
            v-else-if="hasResumeHistory"
            unelevated
            no-caps
            color="primary"
            class="work-play-btn"
            icon="play_arrow"
            :label="$t('workDetails.resume')"
            @click="resumeThisHistroy"
          />
          <q-btn
            v-else
            unelevated
            no-caps
            color="primary"
            class="work-play-btn"
            icon="play_arrow"
            :label="$t('workDetails.play')"
            @click="$emit('play')"
          />

          <div
            v-if="isCurrentPlayingWork && currentPlayingFile && currentPlayingFile.title"
            class="work-playback-caption"
            :class="{ 'work-playback-caption--active': playing }"
          >
            <span v-if="playing" class="work-live-dot" aria-hidden="true" />
            <q-icon v-else name="pause_circle_outline" size="15px" class="work-playback-caption-icon" />
            <span v-if="playing" class="work-playback-caption-label">{{ $t('workDetails.playing') }}</span>
            <span class="work-playback-caption-track">{{ $privateText(currentPlayingFile.title) }}</span>
          </div>

          <div v-else-if="hasResumeHistory && lastPlayedInfo" class="work-playback-caption">
            <q-icon name="history" size="15px" class="work-playback-caption-icon" />
            <span class="work-playback-caption-label">{{ $t('workDetails.lastPlayedTrack') }}</span>
            <span v-if="lastPlayedInfo.title" class="work-playback-caption-track">{{ $privateText(lastPlayedInfo.title) }}</span>
            <span v-if="lastPlayedInfo.seconds !== null" class="work-playback-caption-time">{{ formatSeconds(lastPlayedInfo.seconds) }}</span>
          </div>
        </div>
      </div>

      <!-- 右侧：标题、基础属性、统计指标、可索引分类与个人操作 -->
      <div v-if="loading" class="work-info work-info--skeleton">
        <q-skeleton type="text" width="90%" height="32px" />
        <q-skeleton type="text" width="56%" height="22px" />
        <q-skeleton type="text" width="68%" height="24px" />
        <q-skeleton type="text" width="44%" height="28px" />
        <q-skeleton type="text" width="76%" height="28px" />
        <div class="work-actions">
          <q-skeleton height="36px" width="100%" class="work-skeleton-pill" />
        </div>
      </div>

      <div v-else class="work-info">
        <!-- 第一行：完整标题 -->
        <h1 class="work-title">
          <router-link :to="`/work/${metadata.id}`">
            {{ $privateText(metadata.title) }}
          </router-link>
        </h1>

        <!-- 交互行（星级评分 + RJ 复制 / DLsite）与纯只读档案行分离 -->
        <div class="work-info-meta">
          <div class="work-interactive-row">
            <div class="work-stats-group">
              <q-rating
                :model-value="displayRating"
                @update:model-value="onRatingChange"
                :no-reset="rating === 0"
                :aria-label="$t('workDetails.myRating')"
                name="rating"
                size="18px"
                class="work-rating-stars"
                :class="rating > 0 ? 'work-rating-stars--user' : 'work-rating-stars--community'"
                icon="star_border"
                icon-selected="star"
                icon-half="star_half"
              />
              <span class="work-score" tabindex="0">
                {{ metadata.rate_average_2dp }}
                <AppTooltip v-if="sortedRatings.length">
                  <div class="kikoeru-rating-tooltip">
                    <div class="kikoeru-rating-tooltip__title">{{ $t('workDetails.average', { rate_average_2dp: metadata.rate_average_2dp }) }}</div>
                    <div v-for="(rate, index) in sortedRatings" :key="index" class="kikoeru-rating-tooltip__row">
                      <span>{{ $t('workDetails.stars', { count: rate.review_point }) }}</span>
                      <q-linear-progress
                        :model-value="rate.ratio / 100"
                        color="amber"
                        track-color="grey-8"
                        class="kikoeru-rating-tooltip__bar"
                      />
                      <span class="kikoeru-rating-tooltip__count">({{ rate.count }})</span>
                    </div>
                  </div>
                </AppTooltip>
              </span>
              <span class="work-rating-count work-tabular">({{ formatCount(metadata.rate_count) }})</span>
            </div>

            <div class="work-interactive-links">
              <button
                v-if="!$store.state.AudioPlayer.privacyMode"
                type="button"
                class="work-link-pill work-code-pill"
                :aria-label="$t('workDetails.copyCode')"
                @click="copyWorkCode"
              >
                <span>{{ dlsiteCode }}</span>
                <q-icon name="content_copy" size="12px" />
                <AppTooltip>{{ $t('workDetails.copyCode') }}</AppTooltip>
              </button>

              <a
                v-if="!dlsiteCode.startsWith('CC')"
                class="work-link-pill work-store-pill"
                :href="`https://www.dlsite.com/home/work/=/product_id/${dlsiteCode}.html`"
                rel="noreferrer noopener"
                target="_blank"
              >
                <span>DLsite</span>
                <q-icon name="open_in_new" size="12px" />
              </a>
            </div>
          </div>

          <div class="work-archive-row">
            <span class="work-kv-item">
              <span class="work-kv-key">{{ $t('workDetails.reviewsCount') }}</span>
              <span class="work-kv-val work-tabular">{{ formatCount(metadata.review_count) }}</span>
            </span>
            <span class="work-kv-item">
              <span class="work-kv-key">{{ $t('workDetails.price') }}</span>
              <span class="work-kv-val work-tabular">¥{{ formatCount(metadata.price) }}</span>
            </span>
            <span class="work-kv-item">
              <span class="work-kv-key">{{ $t('workDetails.salesLabel') }}</span>
              <span class="work-kv-val work-tabular">{{ formatCount(metadata.dl_count) }}</span>
            </span>
            <span v-if="metadata.release" class="work-kv-item">
              <span class="work-kv-key">{{ $t('workDetails.releaseDate') }}</span>
              <span class="work-kv-val work-tabular">{{ metadata.release }}</span>
            </span>
            <span v-if="metadata.nsfw === false" class="work-kv-item">
              <span class="work-kv-key">{{ $t('workDetails.ageRating') }}</span>
              <span class="work-kv-val">{{ $t('workCard.allAges') }}</span>
            </span>
            <span v-if="metadata.archived_at" class="work-kv-item">
              <span class="work-kv-key">{{ $t('workDetails.statusLabel') }}</span>
              <span class="work-kv-val work-kv-val--accent">{{ $t('workDetails.archived') }}</span>
            </span>
            <span v-if="metadata.files_missing" class="work-kv-item">
              <span class="work-kv-key">{{ $t('workDetails.statusLabel') }}</span>
              <span class="work-kv-val work-kv-val--danger">{{ $t('common.filesMissing') }}</span>
            </span>
          </div>
        </div>

        <!-- 统一可索引分类区：社团与声优同行 / 标签 -->
        <div class="work-facets-section">
          <div v-if="hasCreators" class="work-creators-row">
            <div v-if="metadata.circle && metadata.circle.id != null" class="work-creator-group">
              <span class="work-row-label">{{ $t('common.circles') }}</span>
              <div class="work-facets">
                <router-link
                  :to="`/works?circleId=${metadata.circle.id}`"
                  class="work-chip work-chip--creator"
                >
                  <q-icon name="album" size="14px" />
                  <span>{{ $privateText(metadata.circle.name) }}</span>
                </router-link>
              </div>
            </div>

            <div v-if="metadata.vas && metadata.vas.length" class="work-creator-group">
              <span class="work-row-label work-row-label--inline">{{ $t('common.voiceActors') }}</span>
              <div class="work-facets">
                <router-link
                  v-for="va in metadata.vas"
                  :to="`/works?vaId=${va.id}`"
                  :key="va.id"
                  class="work-chip work-chip--creator"
                >
                  <q-icon name="mic" size="14px" />
                  <span>{{ $privateText(va.name) }}</span>
                </router-link>
              </div>
            </div>
          </div>

          <div v-if="visibleTags.length" class="work-detail-row">
            <span class="work-row-label">{{ $t('common.tags') }}</span>
            <div class="work-facets">
              <router-link
                v-for="tag in visibleTags"
                :to="`/works?tagId=${tag.id}`"
                :key="tag.id"
                class="work-chip work-chip--tag"
              >
                <span>{{ $privateText(tag.name) }}</span>
              </router-link>
            </div>
          </div>
        </div>

        <!-- 个人评论摘要（已填写时显示） -->
        <div v-if="hasReviewText" class="work-review-note">
          <div class="work-review-note-head">
            <span class="work-review-note-title">
              <q-icon name="rate_review" size="14px" />
              <span>{{ $t('workDetails.myReview') }}</span>
            </span>
            <q-btn
              flat
              dense
              no-caps
              size="sm"
              class="work-review-edit-btn"
              :label="$t('workDetails.editReview')"
              @click="showReviewDialog = true"
            />
          </div>
          <p class="work-review-note-body">{{ $privateText(metadata.review_text) }}</p>
        </div>

        <!-- 收拢至右侧底部的收听状态与作品功能按钮 -->
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

          <div class="work-tools">
            <q-btn
              flat
              dense
              no-caps
              icon="bookmarks"
              :label="$t('bookmark.currentWork')"
              class="work-tool-pill"
              @click="$emit('open-bookmarks')"
            />

            <q-btn
              flat
              dense
              no-caps
              icon="rate_review"
              :label="$t(hasReviewText ? 'workDetails.editReview' : 'workDetails.writeReview')"
              class="work-tool-pill"
              :class="{ 'work-tool-pill--active': hasReviewText }"
              @click="showReviewDialog = true"
            />

            <q-btn
              flat
              dense
              no-caps
              icon="collections_bookmark"
              :label="$t('workDetails.collections')"
              class="work-tool-pill"
              @click="openCollectionCard"
            />

            <q-btn
              flat
              dense
              no-caps
              icon="tune"
              :label="$t('workDetails.manageWork')"
              class="work-tool-pill"
              :class="{ 'work-tool-pill--active': Boolean(metadata.archived_at) }"
              @click="showManageDialog = true"
            />
          </div>
        </div>
      </div>
    </div>

    <LibraryActions
      ref="libraryActions"
      dialog-only
      :work-id="Number(metadata.id)"
      :archived="Boolean(metadata.archived_at)"
      @changed="$emit('reset')"
    />

    <!-- 管理作品子功能卡 -->
    <q-dialog v-model="showManageDialog">
      <q-card class="app-form-dialog work-manage-card">
        <q-card-section class="kikoeru-dialog-header">
          <div class="kikoeru-dialog-title-group">
            <span class="kikoeru-dialog-icon">
              <q-icon name="tune" size="18px" />
            </span>
            <div class="kikoeru-dialog-title-text">
              <div class="kikoeru-dialog-title">{{ $t('workDetails.manageWork') }}</div>
              <div class="kikoeru-dialog-subtitle">{{ $t('workDetails.manageWorkDesc') }}</div>
            </div>
          </div>
          <q-btn flat round dense icon="close" class="kikoeru-dialog-close" :aria-label="$t('common.close')" v-close-popup />
        </q-card-section>

        <q-card-section class="kikoeru-dialog-body work-manage-body">
          <div class="work-manage-actions-list">
            <button
              v-if="isAdministrator"
              type="button"
              class="work-manage-item"
              @click="openEditMetaFromManage"
            >
              <span class="work-manage-item-icon">
                <q-icon name="edit" size="19px" />
              </span>
              <span class="work-manage-item-content">
                <span class="work-manage-item-title">{{ $t('workDetails.editMetadata') }}</span>
                <span class="work-manage-item-desc">{{ $t('workDetails.editMetadataDesc') }}</span>
              </span>
              <q-icon name="chevron_right" size="18px" class="work-manage-item-arrow" />
            </button>

            <button
              type="button"
              class="work-manage-item"
              :disabled="scanningFiles"
              @click="scanWorkFile"
            >
              <span class="work-manage-item-icon">
                <q-spinner v-if="scanningFiles" size="18px" color="primary" />
                <q-icon v-else name="sync" size="19px" />
              </span>
              <span class="work-manage-item-content">
                <span class="work-manage-item-title">{{ $t('workDetails.scanFiles') }}</span>
                <span class="work-manage-item-desc">{{ $t('workDetails.scanFilesDesc') }}</span>
              </span>
              <q-icon name="chevron_right" size="18px" class="work-manage-item-arrow" />
            </button>

            <button
              type="button"
              class="work-manage-item"
              :class="{ 'work-manage-item--active': Boolean(metadata.archived_at) }"
              :disabled="togglingArchive"
              @click="toggleArchiveFromManage"
            >
              <span class="work-manage-item-icon">
                <q-spinner v-if="togglingArchive" size="18px" color="primary" />
                <q-icon v-else :name="metadata.archived_at ? 'unarchive' : 'archive'" size="19px" />
              </span>
              <span class="work-manage-item-content">
                <span class="work-manage-item-title-row">
                  <span class="work-manage-item-title">{{ $t(metadata.archived_at ? 'libraryActions.unarchive' : 'libraryActions.archive') }}</span>
                  <span v-if="metadata.archived_at" class="work-manage-status-pill">{{ $t('workDetails.archived') }}</span>
                </span>
                <span class="work-manage-item-desc">{{ $t(metadata.archived_at ? 'workDetails.unarchiveDesc' : 'workDetails.archiveDesc') }}</span>
              </span>
              <q-icon name="chevron_right" size="18px" class="work-manage-item-arrow" />
            </button>
          </div>

          <div v-if="metadata.state" class="work-manage-danger-section">
            <button
              type="button"
              class="work-manage-item work-manage-item--danger"
              @click="clearHistoryFromManage"
            >
              <span class="work-manage-item-icon work-manage-item-icon--danger">
                <q-icon name="delete_sweep" size="19px" />
              </span>
              <span class="work-manage-item-content">
                <span class="work-manage-item-title">{{ $t('workDetails.deleteHistory') }}</span>
                <span class="work-manage-item-desc">{{ $t('workDetails.deleteHistoryDesc') }}</span>
              </span>
              <q-icon name="chevron_right" size="18px" class="work-manage-item-arrow" />
            </button>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <WriteReview v-if="showReviewDialog" @closed="processReview" :workid="metadata.id" :metadata="metadata" />
    <q-dialog v-model="showEditMetaDialog">
      <EditMeta
        v-if="showEditMetaDialog"
        :workid="metadata.id"
        :metadata="metadata"
        @saved="processEditMeta"
      />
    </q-dialog>
  </section>
</template>

<script>
import { copyToClipboard } from 'quasar'
import { appDialog } from '../utils/appDialog'
import { t } from '../i18n'
import CoverSFW from 'components/CoverSFW.vue'
import WriteReview from './WriteReview.vue'
import EditMeta from './EditMeta.vue'
import LibraryActions from './LibraryActions.vue'
import NotifyMixin from '../mixins/Notification.js'
import { mapGetters, mapState } from 'vuex'
import { formatSeconds, getLastPlayedTrack, idNumberToCode } from 'src/utils'
import { coverTransition } from '../coverTransition'

export default {
  name: 'WorkDetails',
  directives: { coverTransition },
  emits: ['reset', 'resumeHistroy', 'play', 'open-bookmarks', 'history-cleared'],

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
    },
    loading: {
      type: Boolean,
      default: false
    },
    tracksLoading: {
      type: Boolean,
      default: false
    },
    canPlay: {
      type: Boolean,
      default: false
    }
  },

  data () {
    return {
      rating: 0,
      progress: '',
      showReviewDialog: false,
      showEditMetaDialog: false,
      showManageDialog: false,
      scanningFiles: false,
      togglingArchive: false
    }
  },

  computed: {
    coverUrl () {
      return this.$store.getters['AudioPlayer/coverUrl'](this.metadata.id)
    },
    showBackdrop () {
      return !this.$store.state.AudioPlayer.privacyMode && Boolean(this.coverUrl)
    },
    hasCreators () {
      return Boolean(this.metadata.circle?.id != null || this.metadata.vas?.length)
    },
    visibleTags () {
      return (this.metadata.tags || []).filter(tag => tag.id != null && tag.name)
    },
    hasReviewText () {
      return Boolean(this.metadata.review_text?.trim())
    },
    isCurrentPlayingWork () {
      return Number(this.playWorkId) === Number(this.metadata.id)
    },
    hasResumeHistory () {
      return Boolean(this.metadata.state?.queue?.length)
    },
    progressOptions () {
      return [
        { label: t('workDetails.marked'), value: 'marked' },
        { label: t('workDetails.listening'), value: 'listening' },
        { label: t('workDetails.listened'), value: 'listened' },
        { label: t('workDetails.replay'), value: 'replay' },
        { label: t('workDetails.postponed'), value: 'postponed' }
      ]
    },
    sortedRatings () {
      return (this.metadata.rate_count_detail || []).slice().sort((a, b) => (a.review_point > b.review_point ? -1 : 1))
    },
    dlsiteCode () {
      return idNumberToCode(this.metadata.id)
    },
    displayRating () {
      return this.rating > 0 ? this.rating : (Number(this.metadata.rate_average_2dp) || 0)
    },
    lastPlayedInfo () {
      const state = this.metadata.state
      const track = getLastPlayedTrack(state)
      if (!track) return null
      return {
        title: track.title || '',
        seconds: state.seconds != null ? Number(state.seconds) : null
      }
    },
    isAdministrator () {
      return this.$store.state.User.canManage === true
    },
    ...mapState('AudioPlayer', [
      'playing',
      'playWorkId'
    ]),
    ...mapGetters('AudioPlayer', [
      'currentPlayingFile'
    ])
  },

  watch: {
    metadata: {
      immediate: true,
      handler (newMetaData) {
        this.rating = newMetaData.userRating || 0
        this.progress = newMetaData.progress
      },
    },
  },

  methods: {
    formatSeconds,
    formatCount (value) {
      return value == null ? '' : Number(value).toLocaleString()
    },

    async copyWorkCode () {
      try {
        await copyToClipboard(this.dlsiteCode)
        this.showSuccNotif(t('workDetails.codeCopied', { code: this.dlsiteCode }))
      } catch {
        // Ignore clipboard denial silently.
      }
    },

    setProgress (newProgress) {
      const previousProgress = this.progress
      this.progress = newProgress
      const submitPayload = {
        user_name: this.$store.state.User.name, // 用户名不会被后端使用
        work_id: this.metadata.id,
        progress: newProgress
      }
      this.submitProgress(submitPayload, previousProgress)
    },

    submitProgress (payload, previousProgress = this.progress) {
      const params = {
        starOnly: false,
        progressOnly: true
      }
      this.$axios.put('/api/review', payload, { params })
        .then((response) => {
          this.showSuccNotif(response.data.message)
          this.$emit('reset')
        })
        .catch((error) => {
          this.progress = previousProgress
          if (error.response) {
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    onRatingChange (newRating) {
      const previousRating = this.rating
      this.rating = newRating
      this.setRating(newRating, previousRating)
    },

    setRating (newRating, previousRating = this.rating) {
      const submitPayload = {
        user_name: this.$store.state.User.name, // 用户名不会被后端使用
        work_id: this.metadata.id,
        rating: newRating
      }
      this.submitRating(submitPayload, previousRating)
    },

    submitRating (payload, previousRating = this.rating) {
      this.$axios.put('/api/review', payload)
        .then((response) => {
          this.showSuccNotif(response.data.message)
          this.$emit('reset')
        })
        .catch((error) => {
          this.rating = previousRating
          if (error.response) {
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    processReview (modified) {
      this.showReviewDialog = false
      if (modified) this.$emit('reset')
    },

    processEditMeta () {
      this.showEditMetaDialog = false
      this.$emit('reset')
    },

    resumeThisHistroy () {
      this.$emit('resumeHistroy')
    },

    clearThisHistroy () {
      const workId = this.metadata.id
      appDialog(this.$q, {
        title: t('workDetails.notice'),
        message: t('workDetails.deleteHistoryPrompt'),
        cancel: t('common.cancel'),
        ok: t('common.ok')
      }).onOk(async () => {
        this.$axios.delete('/api/histroy', { data: { work_id: workId } })
          .then(() => {
            this.$emit('history-cleared', workId)
            this.$q.notify(t('workDetails.historyDeleted'))
          })
          .catch((err) => {
            this.$q.notify(t('workDetails.deleteHistoryFailed'), err.message)
            console.error(err)
          })
      })
    },

    openCollectionCard () {
      this.$refs.libraryActions?.openCollectionDialog()
    },

    openEditMetaFromManage () {
      this.showManageDialog = false
      this.showEditMetaDialog = true
    },

    clearHistoryFromManage () {
      this.showManageDialog = false
      this.clearThisHistroy()
    },

    async toggleArchiveFromManage () {
      if (this.togglingArchive) return
      this.togglingArchive = true
      try {
        await this.$refs.libraryActions?.toggleArchive()
      } finally {
        this.togglingArchive = false
      }
    },

    async scanWorkFile () {
      if (this.scanningFiles) return
      this.scanningFiles = true
      try {
        const response = await this.$axios.post(`/api/work/scan/${this.metadata.id}`)
        if (response.data.memo) {
          this.showManageDialog = false
          this.$router.go(0)
        }
      } catch (err) {
        console.error(err)
        this.showErrNotif(err.message || err)
      } finally {
        this.scanningFiles = false
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
  position: relative;
  overflow: hidden;
  padding: 20px 22px;
  background: var(--kikoeru-surface);
  border: 1px solid var(--work-divider);
  border-radius: var(--kikoeru-radius-md);
  box-shadow: var(--kikoeru-shadow-card);
}

.work-details-backdrop {
  position: absolute;
  inset: -24px -24px auto;
  height: 220px;
  background-size: cover;
  background-position: center;
  filter: blur(48px) saturate(1.25);
  opacity: 0.14;
  transform: translateZ(0) scale(1.08);
  will-change: transform;
  contain: strict;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9) 0%, transparent 100%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9) 0%, transparent 100%);
}

.body--dark .work-details-backdrop {
  opacity: 0.22;
}

.work-skeleton-pill {
  border-radius: var(--kikoeru-radius-sm);
}

.work-details-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
  align-items: start;
  gap: 20px 26px;
}

.work-media-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.work-cover-frame {
  border-radius: var(--kikoeru-radius-md);
  overflow: hidden;
  border: 1px solid var(--work-divider);
  box-shadow: var(--kikoeru-shadow-card);
}

.work-cover {
  width: 100%;
  display: block;
  border-radius: var(--kikoeru-radius-md);
  overflow: hidden;
}

.work-playback-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.work-play-btn {
  width: 100%;
  min-height: 42px;
  border-radius: var(--kikoeru-radius-sm);
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.work-playback-caption {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: var(--kikoeru-radius-sm);
  background: var(--work-chip);
  border: 1px solid var(--work-divider);
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--work-muted);
  min-width: 0;
}

.work-playback-caption--active {
  background: var(--kikoeru-active-bg);
  border-color: rgba(var(--kikoeru-accent-rgb), 0.28);
  color: var(--kikoeru-accent-text);
}

.work-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--q-primary);
  flex-shrink: 0;
}

.work-playback-caption-icon {
  color: var(--kikoeru-accent-text);
  flex-shrink: 0;
}

.work-playback-caption-label {
  flex-shrink: 0;
  font-weight: 500;
}

.work-playback-caption-track {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--kikoeru-text);
}

.work-playback-caption--active .work-playback-caption-track {
  color: inherit;
}

.work-playback-caption-time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--kikoeru-accent-text);
}

.work-missing-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--kikoeru-radius-sm);
  border: 1px solid color-mix(in srgb, var(--kikoeru-danger) 35%, transparent);
  background: color-mix(in srgb, var(--kikoeru-danger) 10%, transparent);
  color: var(--kikoeru-danger);
  font-size: 13px;
  line-height: 1.45;
}

.work-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.work-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.005em;
  color: var(--kikoeru-text);
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.work-title a {
  color: inherit;
}

/* 交互行与纯只读档案行分离 */
.work-info-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--work-divider);
}

.work-interactive-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
}

.work-archive-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 18px;
}

.work-kv-item {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  line-height: 20px;
  white-space: nowrap;
}

.work-kv-key {
  font-size: 12.5px;
  color: var(--work-muted);
}

.work-kv-val {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--kikoeru-text);
}

.work-kv-val--accent {
  color: var(--kikoeru-accent-text);
}

.work-kv-val--danger {
  color: var(--kikoeru-danger);
}

.work-rating-count {
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: var(--work-muted);
}

.work-interactive-links {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  flex-shrink: 0;
}

.work-link-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border-radius: 5px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: color .15s ease, border-color .15s ease, background-color .15s ease;
}

.work-code-pill {
  border: 1px solid var(--work-divider);
  background: var(--work-chip);
  color: var(--work-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.work-code-pill:hover,
.work-code-pill:focus-visible {
  color: var(--kikoeru-accent-text);
  border-color: rgba(var(--kikoeru-accent-rgb), 0.45);
  background: rgba(var(--kikoeru-accent-rgb), 0.08);
  outline: none;
}

.work-store-pill {
  color: var(--kikoeru-accent-text);
  background: rgba(var(--kikoeru-accent-rgb), 0.1);
  border: 1px solid rgba(var(--kikoeru-accent-rgb), 0.24);
}

.work-store-pill:hover,
.work-store-pill:focus-visible {
  background: rgba(var(--kikoeru-accent-rgb), 0.18);
  border-color: rgba(var(--kikoeru-accent-rgb), 0.42);
  outline: none;
}

.work-stats-group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-height: 24px;
  min-width: 0;
}

.work-field-label {
  color: var(--work-muted);
  font-size: 12.5px;
  line-height: 18px;
  font-weight: 500;
}

.work-rating-stars {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  transform: translateY(-0.5px);
}

.work-rating-stars :deep(.q-rating__icon) {
  color: var(--work-muted);
  opacity: 0.65;
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

.work-score {
  display: inline-flex;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
  cursor: help;
}

.work-tabular {
  font-variant-numeric: tabular-nums;
}

/* 统一可索引分类区 */
.work-facets-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.work-creators-row {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  gap: 8px 18px;
}

.work-creator-group {
  display: inline-flex;
  align-items: start;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
}

.work-detail-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 6px 10px;
}

.work-row-label {
  min-width: 36px;
  padding-top: 4px;
  color: var(--work-muted);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}

.work-row-label--inline {
  min-width: 0;
}

.work-facets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.work-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  min-height: 28px;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  transition: color .15s ease, background-color .15s ease, border-color .15s ease;
}

.work-chip--creator {
  color: var(--kikoeru-accent-text);
  background: rgba(var(--kikoeru-accent-rgb), 0.11);
  border: 1px solid rgba(var(--kikoeru-accent-rgb), 0.22);
  font-weight: 500;
}

.work-chip--creator:hover {
  background: rgba(var(--kikoeru-accent-rgb), 0.19);
  border-color: rgba(var(--kikoeru-accent-rgb), 0.42);
}

.work-chip--tag {
  color: var(--kikoeru-text);
  background: var(--work-chip);
  border: 1px solid var(--work-divider);
}

.work-chip--tag:hover {
  color: var(--kikoeru-accent-text);
  border-color: rgba(var(--kikoeru-accent-rgb), 0.45);
  background: rgba(var(--kikoeru-accent-rgb), 0.08);
}

.work-review-note {
  padding: 9px 12px;
  border-radius: var(--kikoeru-radius-sm);
  background: var(--work-chip);
  border: 1px solid var(--work-divider);
  border-left: 3px solid var(--q-primary);
}

.work-review-note-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.work-review-note-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--kikoeru-accent-text);
}

.work-review-edit-btn {
  color: var(--work-muted);
  font-size: 12px;
  min-height: 24px;
  padding: 0 6px;
}

.work-review-edit-btn:hover {
  color: var(--kikoeru-accent-text);
}

.work-review-note-body {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--kikoeru-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* 右侧底部操作区（宽屏单行/双行自适应，窄屏上下清晰堆叠） */
.work-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
  margin-top: 6px;
  padding-top: 16px;
  border-top: 1px solid var(--work-divider);
}

.work-progress {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  flex: 0 0 auto;
}

.work-progress > .work-field-label {
  flex-shrink: 0;
}

.work-progress-toggle {
  flex: 0 0 auto;
  padding: 2px;
  background: var(--work-chip);
  border: 1px solid var(--work-divider);
  border-radius: var(--kikoeru-radius-sm);
  box-shadow: none;
}

.work-progress-toggle :deep(.q-btn) {
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 30px;
  padding: 2px 9px;
  border-radius: 4px !important;
  font-size: 12.5px;
  color: var(--work-muted);
}

.work-progress-toggle :deep(.q-btn[aria-pressed='true']) {
  font-weight: 600;
}

.work-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.work-tool-pill {
  min-height: 34px;
  padding: 0 10px;
  border-radius: var(--kikoeru-radius-sm);
  border: 1px solid var(--work-divider);
  background: var(--work-chip);
  color: var(--kikoeru-text);
  font-size: 12.5px;
  font-weight: 500;
  transition: color .15s ease, border-color .15s ease, background-color .15s ease;
}

.work-tool-pill :deep(.q-icon) {
  font-size: 16px;
  margin-right: 5px;
  color: var(--work-muted);
}

.work-tool-pill:hover,
.work-tool-pill:focus-visible {
  color: var(--kikoeru-accent-text);
  border-color: rgba(var(--kikoeru-accent-rgb), 0.42);
  background: rgba(var(--kikoeru-accent-rgb), 0.08);
}

.work-tool-pill:hover :deep(.q-icon),
.work-tool-pill:focus-visible :deep(.q-icon),
.work-tool-pill--active,
.work-tool-pill--active :deep(.q-icon) {
  color: var(--kikoeru-accent-text);
}

.work-tool-pill--active {
  border-color: rgba(var(--kikoeru-accent-rgb), 0.32);
  background: rgba(var(--kikoeru-accent-rgb), 0.1);
}

.work-manage-card {
  width: min(460px, calc(100vw - 28px));
  overflow: hidden;
}

.work-manage-body {
  gap: 12px !important;
}

.work-manage-actions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.work-manage-danger-section {
  padding-top: 12px;
  border-top: 1px solid var(--kikoeru-border);
}

.work-manage-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
  color: var(--kikoeru-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color .15s ease, background-color .15s ease;
}

.work-manage-item:hover:not(:disabled),
.work-manage-item:focus-visible {
  border-color: rgba(var(--kikoeru-accent-rgb), 0.45);
  background: rgba(var(--kikoeru-accent-rgb), 0.08);
  outline: none;
}

.work-manage-item:disabled {
  opacity: 0.65;
  cursor: wait;
}

.work-manage-item--active {
  border-color: rgba(var(--kikoeru-accent-rgb), 0.36);
  background: var(--kikoeru-active-bg);
}

.work-manage-item--danger:hover:not(:disabled),
.work-manage-item--danger:focus-visible {
  border-color: color-mix(in srgb, var(--kikoeru-danger) 48%, transparent);
  background: color-mix(in srgb, var(--kikoeru-danger) 10%, transparent);
}

.work-manage-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--kikoeru-surface);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-accent-text);
  flex-shrink: 0;
}

.work-manage-item-icon--danger {
  color: var(--kikoeru-danger);
  border-color: color-mix(in srgb, var(--kikoeru-danger) 28%, transparent);
}

.work-manage-item-content {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.work-manage-item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.work-manage-item-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.work-manage-item--danger .work-manage-item-title {
  color: var(--kikoeru-danger);
}

.work-manage-item-desc {
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--kikoeru-muted);
}

.work-manage-status-pill {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(var(--kikoeru-accent-rgb), 0.16);
  color: var(--kikoeru-accent-text);
  font-size: 11px;
  font-weight: 600;
}

.work-manage-item-arrow {
  color: var(--kikoeru-muted);
  flex-shrink: 0;
}

@media (max-width: 1140px) {
  .work-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .work-progress {
    width: 100%;
    justify-content: space-between;
  }

  .work-progress-toggle {
    flex: 1 1 auto;
  }

  .work-progress-toggle :deep(.q-btn) {
    flex: 1 1 0;
    min-width: 0;
  }
}

@media (min-width: 700px) and (max-width: 959px) {
  .work-details {
    padding: 18px 20px;
  }

  .work-details-grid {
    grid-template-columns: minmax(0, 268px) minmax(0, 1fr);
    gap: 18px 20px;
  }

  .work-tools {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 699px) {
  .work-details {
    padding: 14px;
  }

  .work-details-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .work-media-col {
    max-width: 400px;
    width: 100%;
    justify-self: center;
  }

  .work-title {
    font-size: 18px;
  }

  .work-info {
    gap: 13px;
  }

  .work-info-meta {
    padding-bottom: 13px;
  }

  .work-facets-section {
    gap: 10px;
  }

  .work-actions {
    margin-top: 4px;
    padding-top: 13px;
  }

  .work-detail-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 5px;
  }

  .work-creator-group {
    flex-direction: column;
    gap: 5px;
  }

  .work-row-label {
    padding-top: 0;
  }

  .work-progress {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .work-tools {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .work-link-pill,
  .work-chip,
  .work-tool-pill,
  .work-manage-item {
    transition: none;
  }
}
</style>
