<template>
  <article class="favourite-work">
    <router-link :to="`/work/${metadata.id}`" class="favourite-work__cover" :aria-label="metadata.title">
      <q-img :key="coverUrl" :src="coverUrl" :ratio="4 / 3" />
    </router-link>

    <div class="favourite-work__main">
      <router-link :to="`/work/${metadata.id}`" class="favourite-work__title">{{ metadata.title }}</router-link>
      <div class="favourite-work__meta">
        <router-link v-if="metadata.circle" :to="`/works?circleId=${metadata.circle.id}`">{{ metadata.circle.name }}</router-link>
        <span v-if="metadata.release">{{ metadata.release }}</span>
        <router-link v-for="va in metadata.vas" :key="va.id" :to="`/works?vaId=${va.id}`">{{ va.name }}</router-link>
      </div>
      <div class="favourite-work__status">
        <q-rating v-if="!hideRating" v-model="rating" @update:model-value="setRating" size="20px" color="primary" icon="star_border" icon-selected="star" :aria-label="$t('favourites.rating')" />
        <span v-if="metadata.updated_at" class="favourite-work__date"><q-icon :name="mode === 'histroy' ? 'history' : 'schedule'" size="15px" />{{ metadata.updated_at }}</span>
        <span v-if="metadata.archived_at" class="favourite-work__badge"><q-icon name="inventory_2" />{{ $t('favListItem.archived') }}</span>
        <span v-if="metadata.files_missing" class="favourite-work__missing"><q-icon name="folder_off" />{{ $t('common.filesMissing') }}</span>
      </div>
    </div>

    <div class="favourite-work__actions">
      <LibraryActions :work-id="Number(metadata.id)" :archived="Boolean(metadata.archived_at)" @changed="$emit('reset')" />
    </div>

    <div v-if="mode === 'histroy' && historyTrack" class="favourite-work__detail favourite-work__resume">
      <div class="favourite-work__track">
        <div class="favourite-work__position"><q-icon name="headphones" size="18px" /><span>{{ metadata.state.index + 1 }} / {{ metadata.state.queue.length }}</span><span class="favourite-work__time">{{ humanReadableSeconds(metadata.state.seconds) }}</span></div>
        <div class="favourite-work__filename" :title="historyTrack.title">{{ historyTrack.title }}</div>
      </div>
      <q-btn unelevated no-caps color="primary" icon="play_arrow" :label="$t('favListItem.resume')" :disable="Boolean(metadata.files_missing)" class="favourite-work__play" @click="playHistroy(metadata.id, metadata.state)" />
    </div>

    <div v-if="mode === 'review'" class="favourite-work__detail favourite-work__review">
      <p v-if="metadata.review_text">{{ metadata.review_text }}</p>
      <q-btn flat no-caps dense color="primary" icon="edit" :label="$t('writeReview.title')" @click="showReviewDialog = true" />
    </div>

    <div v-if="mode === 'progress'" class="favourite-work__detail">
      <q-select v-model="progress" outlined dense emit-value map-options :label="$t('favourites.progress')" class="favourite-work__progress" :options="progressOptions" @update:model-value="setProgress" />
    </div>
    <WriteReview card-class="favourites-review-dialog" v-if="showReviewDialog" @closed="processReview" :workid="workid" :metadata="metadata" />
  </article>
</template>

<script>
import { t } from '../i18n'
import WriteReview from './WriteReview.vue'
import NotifyMixin from '../mixins/Notification.js'
import LibraryActions from './LibraryActions.vue'

export default {
  name: 'FavListItem',

  mixins: [NotifyMixin],

  components: {
    WriteReview,
    LibraryActions
  },

  props: {
      workid: {
        type: Number,
        required: true
      },
      metadata: {
        type: Object,
        required: true
      },
      mode: {
        type: String,
        default: 'review'
      }
  },

  data () {
    return {
      rating: 0,
      showReviewDialog: false,
      hideRating: false,
      progress: ''
    }
  },

  computed: {
    historyTrack () { return this.metadata.state?.queue?.[this.metadata.state.index] },
    progressOptions () {
      return ['marked', 'listening', 'listened', 'replay', 'postponed'].map(value => ({ value, label: t(`favListItem.${value}`) }))
    },
    coverUrl () {
      return this.$store.getters['AudioPlayer/coverUrl'](this.workid, '240x240')
    },
  },

  mounted() {
    // 可以用mounted因为初始化时metadata不为空
    this.setMetadata();
  },

  watch: {
    // 需要watch metadata 当父component刷新metadata时更新
    metadata () {
      this.setMetadata();
    }
  },

  methods: {
    humanReadableSeconds(seconds) {
      const hour = Math.floor(seconds / 3600)
      const minute = Math.floor(seconds / 60) % 60
      const sec = Math.floor(seconds) % 60

      const parts = []
      if (hour > 0) parts.push(t('favListItem.hours', { count: hour }))
      if (minute > 0) parts.push(t('favListItem.minutes', { count: minute }))
      parts.push(t('favListItem.seconds', { count: sec }))
      return parts.join(this.$i18n.locale === 'en' ? ' ' : '')
    },

    setMetadata () {
      if (this.metadata.userRating) {
        this.rating = this.metadata.userRating;
      } else {
        this.hideRating = true;
      }
      if (!this.rating) {
        this.hideRating = true;
      } else {
        this.hideRating = false;
      }

      this.progress = this.metadata.progress;
    },

    processReview (modified) {
      if (modified) {
        this.calledFromChild = true;
        this.$emit('reset');
      }
      this.showReviewDialog = false;
    },

    setRating (newRating) {
      // 取消标星可能是操作失误，所以不响应。应使用删除标记来删除打星
      if (newRating) {
        const submitPayload = {
          'user_name': this.$store.state.User.name, // 用户名不会被后端使用
          'work_id': this.metadata.id,
          'rating': newRating
        };
        this.submitRating(submitPayload);
      }
    },

    submitRating (payload) {
      const params = {
        starOnly: true
      }
      this.$axios.put('/api/review', payload, { params })
        .then((response) => {
          this.showSuccNotif(response.data.message)
        })
        .then(()=> this.$emit('reset'))
        .catch((error) => {
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    setProgress (newProgress) {
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
          this.showSuccNotif(response.data.message)
        })
        .then(()=> this.$emit('reset'))
        .catch((error) => {
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    playHistroy(workId, histroyState) {
      this.$store.commit('AudioPlayer/SET_QUEUE', {
        workId: workId,
        queue: histroyState.queue,
        index: histroyState.index,
        resetPlaying: false,
        resumeHistroySeconds: histroyState.seconds,
      })
      if (histroyState.playMode) this.$store.commit('AudioPlayer/SET_PLAY_MODE', histroyState.playMode)
      if (Object.prototype.hasOwnProperty.call(histroyState, 'playbackRate')) this.$store.commit('AudioPlayer/SET_PLAYBACK_RATE', histroyState.playbackRate)
      // this.$store.commit('AudioPlayer/SET_RESUME_HISTROY_SECONDS', histroyState.seconds)
    }
  }

}
</script>
