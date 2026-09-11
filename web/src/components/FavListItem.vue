<template>
  <q-item clickable class="row">
      <q-item-section class="col-auto" top> 
        <router-link :to="`/work/${metadata.id}`">
          <q-img :key="coverUrl" transition="fade" :src="coverUrl" style="height: 120px; width: 160px;" />
        </router-link>
      </q-item-section>


      <q-item-section class="q-gutter-y-xs column items-start" top v-on:click.self="showReviewDialog = true && mode != 'histroy' ">
        <q-item-label lines="2" class="text-body2">
          <router-link :to="`/work/${metadata.id}`" class="col-auto text-secondary">
            {{metadata.title}}
          </router-link>
        </q-item-label>

        <q-item-label v-if="metadata.files_missing" caption :class="$q.dark.isActive ? 'text-red-4' : 'text-negative'"><q-icon name="folder_off" /> {{ $t('common.filesMissing') }}</q-item-label>
        <div class="row q-gutter-x-sm col-auto" >
          <router-link :to="`/works?circleId=${metadata.circle.id}`" class="col-auto text-grey">
            {{metadata.circle.name}}
          </router-link>

          <span class="col-auto">/</span>
          <span class="col-auto text-grey"> {{metadata.release}}</span>
          <span class="col-auto">/</span>

          <router-link
            v-for="(va, index) in metadata.vas"
            :key=index
            :to="`/works?vaId=${va.id}`"
            class="col-auto text-primary"
          >
            {{ va.name }}
          </router-link>
        </div>

        <div class="row items-center q-gutter-x-xs">
          <q-rating
            v-if="!hideRating"
            v-model="rating"
            @update:model-value="setRating"
            size="sm"
            color="blue"
            icon="star_border"
            icon-selected="star"
            icon-half="star_half"
            class="col-auto"
          />
          <span class="col-auto text-grey ">{{metadata.updated_at}}</span>
        </div>

        <q-item-label class="q-pt-sm" v-if="mode === 'review'">
          <q-card class="my-card col-auto" @click="showReviewDialog = true" v-show="metadata.review_text" >
            <q-card-section class="q-pa-sm">
              <pre class="q-ma-none">{{metadata.review_text}}</pre>
            </q-card-section>
          </q-card>
        </q-item-label>

        <div v-if="mode === 'histroy'" class="full-width">
          <div class="full-width">
            <q-btn color="primary" :label="$t('favListItem.resume')"  class="full-width" @click="playHistroy(metadata.id, metadata.state)"/>
          </div>

          <!--
          <div>
            <span class="text-primary">历史：</span>
              <q-badge color="blue">
                {{ metadata.play_updated_at }}
              </q-badge>
          </div>
          -->

          <div>
            <span class="text-primary">{{ $t('favListItem.progress') }}</span>
            <q-badge color="purple">{{ metadata.state.index+1 }} / {{ metadata.state.queue.length }}</q-badge>
            <q-badge color="blue">{{ humanReadableSeconds(metadata.state.seconds) }}</q-badge>
            <span class="text-grey">
              {{ metadata.state.queue[metadata.state.index].title }}
            </span>
          </div>
        </div>

        <q-item-label class="q-pt-xs" v-if="mode === 'progress'">
          <q-btn-toggle
            v-if="mode === 'progress'"
            v-model="progress"
            @update:model-value="setProgress"
            dense
            no-caps
            rounded
            toggle-color="primary"
            color="white"
            text-color="black"
            class="q-pa-sm"
            :options="[
              {label: $t('favListItem.marked'), value: 'marked'},
              {label: $t('favListItem.listening'), value: 'listening'},
              {label: $t('favListItem.listened'), value: 'listened'},
              {label: $t('favListItem.replay'), value: 'replay'},
              {label: $t('favListItem.postponed'), value: 'postponed'}
            ]"
          />
          </q-item-label>
      </q-item-section>

      <q-item-section side top>
        <q-badge v-if="metadata.archived_at" color="grey-7" :label="$t('favListItem.archived')" class="q-mb-xs" />
        <LibraryActions :work-id="Number(metadata.id)" :archived="Boolean(metadata.archived_at)" @changed="$emit('reset')" />
      </q-item-section>

      <WriteReview v-if="showReviewDialog" @closed="processReview" :workid="workid" :metadata="metadata"></WriteReview>

  </q-item>
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
      const minute = Math.floor(seconds / 60)
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
