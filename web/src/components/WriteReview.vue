<template>
  <div>
    <q-dialog v-model="showReviewDialog" @hide="closeDialog">
      <q-card class="app-form-dialog review-dialog" :class="cardClass">
        <q-card-section class="kikoeru-dialog-header">
          <div class="kikoeru-dialog-title-group">
            <span class="kikoeru-dialog-icon">
              <q-icon name="rate_review" size="18px" />
            </span>
            <div class="kikoeru-dialog-title-text">
              <div class="kikoeru-dialog-title">{{ $t('writeReview.title') }}</div>
            </div>
          </div>
          <q-btn flat round dense icon="close" class="kikoeru-dialog-close" :aria-label="$t('common.close')" v-close-popup />
        </q-card-section>

        <q-card-section class="kikoeru-dialog-body">
          <div class="review-field">
            <div class="kikoeru-dialog-field-label">
              <span>{{ $t('writeReview.ratingLabel') }}</span>
              <span v-if="rating > 0" class="review-rating-badge">{{ rating }} / 5</span>
            </div>
            <div class="review-rating-row">
              <q-rating
                v-model="rating"
                size="26px"
                class="review-rating-stars"
                icon="star_border"
                icon-selected="star"
                icon-half="star_half"
              />
            </div>
          </div>

          <div class="review-field">
            <div class="kikoeru-dialog-field-label">{{ $t('writeReview.statusLabel') }}</div>
            <q-btn-toggle
              v-model="progress"
              no-caps
              unelevated
              toggle-color="primary"
              :options="[
                { label: $t('writeReview.marked'), value: 'marked' },
                { label: $t('writeReview.listening'), value: 'listening' },
                { label: $t('writeReview.listened'), value: 'listened' },
                { label: $t('writeReview.replay'), value: 'replay' },
                { label: $t('writeReview.postponed'), value: 'postponed' }
              ]"
            />
          </div>

          <div class="review-field">
            <div class="kikoeru-dialog-field-label">{{ $t('writeReview.commentLabel') }}</div>
            <q-input
              v-model="reviewText"
              outlined
              type="textarea"
              :rows="4"
              :placeholder="$t('writeReview.commentPlaceholder')"
            />
          </div>
        </q-card-section>

        <q-card-actions class="kikoeru-dialog-footer review-dialog-footer">
          <q-btn
            flat
            no-caps
            color="negative"
            icon="delete_outline"
            :label="$t('writeReview.deleteMark')"
            class="review-delete-btn"
            v-close-popup
            @click="deleteConfirm = true"
          />
          <div class="review-footer-right">
            <q-btn class="app-dialog-cancel" flat no-caps :label="$t('common.cancel')" v-close-popup @click="closeDialog()" />
            <q-btn unelevated no-caps color="primary" :label="$t('common.save')" v-close-popup @click="submitReview()" />
          </div>
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="deleteConfirm" persistent transition-show="scale" transition-hide="scale">
      <q-card class="app-form-dialog review-confirm-card">
        <q-card-section class="kikoeru-dialog-header">
          <div class="kikoeru-dialog-title-group">
            <span class="kikoeru-dialog-icon review-confirm-icon">
              <q-icon name="delete_outline" size="18px" />
            </span>
            <div class="kikoeru-dialog-title-text">
              <div class="kikoeru-dialog-title">{{ $t('writeReview.deleteMark') }}</div>
            </div>
          </div>
        </q-card-section>

        <q-card-section class="kikoeru-dialog-body">
          <div class="review-confirm-message">{{ $t('writeReview.deletePrompt') }}</div>
        </q-card-section>

        <q-card-actions class="kikoeru-dialog-footer">
          <q-btn class="app-dialog-cancel" flat no-caps :label="$t('common.cancel')" v-close-popup @click="closeDialog()" />
          <q-btn unelevated no-caps color="negative" :label="$t('common.delete')" v-close-popup @click="deleteReview()" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import NotifyMixin from '../mixins/Notification.js'

export default {
  name: 'WriteReview',

  mixins: [NotifyMixin],

  props: {
    cardClass: { type: String, default: '' },
    workid: {
      type: Number,
      required: true
    },
    metadata: {
      type: Object,
      default: null
    }
  },

  data () {
    return {
      showReviewDialog: true,
      deleteConfirm: false,
      rating: 0,
      reviewText: '',
      modified: false,
      progress: '',
    }
  },

  mounted () {
    if (this.metadata.userRating) {
      this.rating = this.metadata.userRating
    }
    this.progress = this.metadata.progress
    this.reviewText = this.metadata.review_text || ''
  },

  methods: {
    closeDialog () {
      if (!this.deleteConfirm) {
        if (this.modified) {
          this.$emit('closed', true)
        } else {
          this.$emit('closed', false)
        }
      }
    },

    reviewPayload () {
      return {
        user_name: this.$store.state.User.name, // 用户名不会被后端使用
        work_id: this.workid,
        rating: this.rating,
        review_text: this.reviewText,
        progress: this.progress
      }
    },

    submitReview () {
      const params = {
        starOnly: false
      }
      const payload = this.reviewPayload()
      this.$axios.put('/api/review', payload, { params })
        .then((response) => {
          this.modified = true
          this.showSuccNotif(response.data.message)
        })
        .then(() => this.closeDialog())
        .catch((error) => {
          if (error.response) {
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    deleteReview () {
      const params = {
        work_id: this.workid
      }
      this.$axios.delete('/api/review', { params })
        .then((response) => {
          this.modified = true
          this.showSuccNotif(response.data.message)
        })
        .then(() => this.closeDialog())
        .catch((error) => {
          if (error.response) {
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
.review-field {
  min-width: 0;
}

.review-rating-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
  border: 1px solid var(--kikoeru-border);
}

.review-rating-stars :deep(.q-rating__icon) {
  color: var(--kikoeru-muted);
  opacity: 0.65;
  text-shadow: none;
}

.review-rating-stars :deep(.q-rating__icon--active),
.review-rating-stars :deep(.q-rating__icon--hovered) {
  color: var(--kikoeru-accent-text);
  opacity: 1;
}

.review-rating-badge {
  padding: 1px 7px;
  border-radius: 4px;
  background: rgba(var(--kikoeru-accent-rgb), 0.14);
  color: var(--kikoeru-accent-text);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.review-dialog-footer {
  justify-content: space-between;
}

.review-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.review-confirm-card {
  width: min(380px, calc(100vw - 28px));
  overflow: hidden;
}

.review-confirm-icon {
  background: color-mix(in srgb, var(--kikoeru-danger) 12%, transparent);
  color: var(--kikoeru-danger);
}

.review-confirm-message {
  font-size: 14px;
  line-height: 1.6;
  color: var(--kikoeru-muted);
}
</style>
